import json
from datetime import datetime, timezone
from pathlib import Path

from app import config
from app.cache.semantic_cache import meaning_flip
from app.guardrails.input import is_suspicious
from app.guardrails.output import parse_adjudication, verify_quote


def parses(raw):
    try:
        parse_adjudication(raw)
        return True
    except ValueError:
        return False


def check(row, engine):
    kind = row["kind"]
    if kind == "injection":
        return is_suspicious(row["text"]) == row["expect_blocked"]
    if kind == "flip":
        return meaning_flip(row["a"], row["b"]) == row["expect_flip"]
    if kind == "quote":
        return (verify_quote(row["quote"], row["source"]) is not None) == row["expect_valid"]
    if kind == "parse":
        return parses(row["raw"]) == row["expect_valid"]
    if kind == "pipeline":
        if engine is None:
            return None
        stamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        signal = engine.analyze(
            {"text": row["text"], "source": row["source"], "source_name": "adversarial", "timestamp": stamp},
            persist=False,
        )
        if row["expect"] == "no_signal":
            return signal is None
        return signal is None or signal["impact"] < config.ESCALATE_IMPACT
    return None


def run(engine=None):
    path = Path(config.ADVERSARIAL_PATH)
    if not path.exists():
        print(f"adversarial suite skipped: {path} not found")
        return None

    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    kinds, failed, skipped = {}, [], 0
    for row in rows:
        try:
            ok = check(row, engine)
        except Exception:
            ok = False
        if ok is None:
            skipped += 1
            continue
        entry = kinds.setdefault(row["kind"], {"passed": 0, "total": 0})
        entry["total"] += 1
        entry["passed"] += bool(ok)
        if not ok:
            failed.append(row["id"])

    total = sum(k["total"] for k in kinds.values())
    passed = sum(k["passed"] for k in kinds.values())
    for entry in kinds.values():
        entry["rate"] = round(entry["passed"] / entry["total"], 3)
    return {
        "kinds": kinds,
        "passed": passed,
        "total": total,
        "pass_rate": round(passed / total, 3) if total else None,
        "failed": failed,
        "skipped": skipped,
    }
