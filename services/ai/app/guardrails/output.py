import json
import re

from app.scoring.impact import EVENT_TYPES

FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.M)
MIN_QUOTE = 15
MAX_QUOTE = 300


def parse_adjudication(raw):
    text = FENCE.sub("", raw.strip())
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in output")
    data = json.loads(text[start : end + 1])

    event_type = data.get("event_type")
    if event_type not in EVENT_TYPES:
        raise ValueError(f"unknown event_type {event_type!r}")
    quote = data.get("evidence_quote")
    if not isinstance(quote, str) or not MIN_QUOTE <= len(quote.strip()) <= MAX_QUOTE:
        raise ValueError("evidence_quote missing or out of range")

    try:
        sentiment, confidence = float(data["sentiment"]), float(data["confidence"])
    except (KeyError, TypeError, ValueError) as err:
        raise ValueError("sentiment or confidence missing") from err

    return {
        "event_type": event_type,
        "sentiment": min(1.0, max(-1.0, sentiment)),
        "confidence": min(1.0, max(0.0, confidence)),
        "evidence_quote": quote.strip(),
        "rationale": str(data.get("rationale", ""))[:300],
    }


def verify_quote(quote, source):
    words = quote.split()
    if not words:
        return None
    pattern = r"\s+".join(re.escape(w) for w in words)
    match = re.search(pattern, source, re.I)
    if not match:
        return None
    return {"text": match.group(), "start": match.start(), "end": match.end()}
