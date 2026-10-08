import json
from pathlib import Path

import numpy as np

from app import config
from app.guardrails.output import FENCE

SYSTEM = "You answer questions about historical stock market moves. Reply with one JSON object only."
MIN_GROUP = 10


def ask(llm, event):
    prompt = (
        f"On {event['date']}, did {event['symbol']} close higher or lower than on the previous "
        'trading day? Reply with JSON like {"direction": "up"} or {"direction": "down"}.'
    )
    raw = FENCE.sub("", llm.complete(SYSTEM, prompt, temperature=0.0, max_tokens=40).strip())
    return json.loads(raw[raw.find("{") : raw.rfind("}") + 1]).get("direction")


def run(llm):
    if not config.LLM_CUTOFF:
        print("leakage probe skipped: set LLM_CUTOFF to the model's training cutoff date")
        return None
    if not llm.configured:
        print("leakage probe skipped: no LLM configured")
        return None

    events = [
        json.loads(line)
        for line in Path(config.ANALOGS_PATH).read_text().splitlines()
        if line.strip()
    ]
    events = [e for e in events if e.get("reaction_1d_pct") is not None]
    if not events:
        print("leakage probe skipped: run app.retrieval.build_reactions first")
        return None

    groups = {"before_cutoff": [], "after_cutoff": []}
    for event in events:
        try:
            answer = ask(llm, event)
        except Exception:
            continue
        correct = answer == ("up" if event["reaction_1d_pct"] > 0 else "down")
        groups["before_cutoff" if event["date"] <= config.LLM_CUTOFF else "after_cutoff"].append(correct)

    out = {"cutoff": config.LLM_CUTOFF}
    for name, values in groups.items():
        out[name] = {"n": len(values), "accuracy": round(float(np.mean(values)), 3) if values else None}
    if out["before_cutoff"]["accuracy"] is not None and out["after_cutoff"]["accuracy"] is not None:
        out["gap"] = round(out["before_cutoff"]["accuracy"] - out["after_cutoff"]["accuracy"], 3)
    out["reliable"] = min(len(v) for v in groups.values()) >= MIN_GROUP
    return out
