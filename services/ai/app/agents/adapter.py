import importlib
import logging
import uuid
from datetime import datetime, timezone

from app.contracts import validator

log = logging.getLogger("adapter")


class EventNotFound(Exception):
    pass


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _claim(signal):
    text = signal["evidence_span"]["text"]
    evidence = {"span": text}
    if signal.get("url"):
        evidence["url"] = signal["url"]
    return {"text": text, "evidence": [evidence]}


def baseline(event, signals, tools):
    top = sorted(signals, key=lambda s: -s["confidence"])[:3]
    scope = ", ".join(event["tickers"]) if event["tickers"] else "market-wide"
    query = " ".join(s["evidence_span"]["text"] for s in top) or event["event_type"]

    analogs = []
    for analog in tools.analogs(query):
        entry = {"title": analog["title"], "date": analog["date"]}
        if analog.get("reaction_1d_pct") is not None:
            entry["reaction_pct"] = analog["reaction_1d_pct"]
        analogs.append(entry)

    claims = [_claim(s) for s in top]
    for result in tools.web_search(f"{scope} {event['event_type']} {query}"):
        snippet = result["content"].strip()[:200]
        if snippet:
            claims.append(
                {
                    "text": f"Web coverage: {result['title']}",
                    "evidence": [{"url": result["url"], "span": snippet}],
                }
            )

    dossier = {
        "schema_version": "1",
        "dossier_id": "dos-" + uuid.uuid4().hex[:8],
        "event_id": event["event_id"],
        "created_at": _now(),
        "status": "partial",
        "summary": (
            f"{event['event_type']} event ({scope}). {event['signal_count']} signals from "
            f"{len(event['sources'])} sources between {event['first_seen']} and {event['last_seen']}. "
            f"Average sentiment {event['sentiment']:+.2f}, impact {event['impact']:.1f} of 10, "
            f"confidence {event['confidence']:.0%}."
        ),
        "corroboration": {"source_count": len(event["sources"]), "sources": event["sources"]},
        "analogs": analogs,
        "counter_evidence": [
            s["evidence_span"]["text"] for s in signals if s["sentiment"] * event["sentiment"] < 0
        ][:2],
        "claims": claims,
        "confidence": round(event["confidence"], 2),
    }

    try:
        portfolio = tools.portfolio()
        dossier["exposures"] = [
            {"asset_class": e["asset_class"], "exposure": e["value"]} for e in portfolio["exposure"]
        ]
        scenario = next(
            (s for s in tools.scenarios() if s["trigger"]["event_type"] == event["event_type"]), None
        )
        if scenario:
            run = tools.stress(
                scenario["scenario_id"], event["impact"], event["confidence"], event["tickers"]
            )
            dossier["stress"] = {
                "scenario_id": scenario["scenario_id"],
                "value_before": run["value_before"],
                "value_after": run["value_after"],
                "loss": run["loss"],
            }
    except Exception:
        log.exception("portfolio context unavailable")
    return dossier


def run_research(event, signals, tools):
    try:
        module = importlib.import_module("app.agents.aria")
    except ImportError:
        return None
    entry = getattr(module, "run", None)
    if entry is None:
        return None
    try:
        return entry(event=event, signals=signals, tools=tools)
    except Exception:
        log.exception("research pipeline failed")
        return None


def investigate(event_id, store, tools):
    event = store.get(event_id)
    if event is None:
        raise EventNotFound(event_id)
    signals = store.signals(event_id)

    dossier = baseline(event, signals, tools)
    research = run_research(event, signals, tools)
    if research:
        for key in ("summary", "claims", "counter_evidence"):
            if research.get(key):
                dossier[key] = research[key]
        if research.get("confidence") is not None:
            dossier["confidence"] = research["confidence"]
        dossier["status"] = "complete"

    validator("dossier").validate(dossier)
    return dossier
