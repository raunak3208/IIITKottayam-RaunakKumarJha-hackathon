import hashlib
import re
import uuid

from app import config
from app.contracts import signal_validator
from app.models.event_classifier import EventClassifier
from app.models.sentiment import SentimentModel
from app.pipeline.entity_linking import EntityLinker
from app.scoring.impact import impact_score

SENTENCE = re.compile(r"\S.*?(?:[.!?](?=\s|$)|$)", re.S)
MAX_EVIDENCE = 300
MARKET_WIDE = {"Geopolitical", "Macroeconomic", "Regulatory Event", "Credit Event"}


class Engine:
    def __init__(self):
        self.ready = False
        self.validator = signal_validator()

    def load(self):
        self.linker = EntityLinker(config.ALIAS_TABLE)
        self.sentiment = SentimentModel(config.SENTIMENT_MODEL)
        self.classifier = EventClassifier(config.EVENT_MODEL)
        self.ready = True

    def evidence(self, text, tickers):
        spans = [m.span() for m in SENTENCE.finditer(text) if m.group().strip()]
        if not spans:
            return None
        start, end = spans[0]
        for s, e in spans:
            if set(tickers) & set(self.linker.link(text[s:e])):
                start, end = s, e
                break
        segment = text[start:end]
        start += len(segment) - len(segment.lstrip())
        end = min(start + len(segment.strip()), start + MAX_EVIDENCE)
        return {"text": text[start:end], "start": start, "end": end}

    def analyze(self, item):
        text = item["text"]
        tickers = self.linker.link(text)
        sentiment, sentiment_conf = self.sentiment.score(text)
        event_type, type_conf = self.classifier.classify(text)

        if not tickers and event_type not in MARKET_WIDE:
            return None
        evidence = self.evidence(text, tickers)
        if evidence is None:
            return None

        day = item["timestamp"][:10]
        key = f"{event_type}|{','.join(tickers)}|{day}"
        signal = {
            "schema_version": "1",
            "signal_id": str(uuid.uuid4()),
            "event_id": "evt-" + hashlib.sha1(key.encode()).hexdigest()[:10],
            "timestamp": item["timestamp"],
            "source": item["source"],
            "tickers": tickers,
            "sentiment": round(sentiment, 3),
            "event_type": event_type,
            "impact": impact_score(event_type, sentiment, type_conf, item["source"]),
            "confidence": round((sentiment_conf * type_conf) ** 0.5, 2),
            "evidence_span": evidence,
            "market_confirmation": "not_applicable",
            "degraded": False,
        }
        if item.get("source_name"):
            signal["source_name"] = item["source_name"]
        if item.get("url"):
            signal["url"] = item["url"]

        self.validator.validate(signal)
        return signal
