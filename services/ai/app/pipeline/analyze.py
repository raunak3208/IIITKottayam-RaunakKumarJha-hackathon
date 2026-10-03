import hashlib
import json
import re
import uuid
from datetime import datetime
from pathlib import Path

import redis

from app import config
from app.agents.tools import Tools
from app.cache.semantic_cache import SemanticCache
from app.contracts import validator
from app.graph.escalation_graph import build_graph
from app.guardrails.input import is_suspicious
from app.llm.client import LLMClient
from app.models.embeddings import Embedder
from app.models.event_classifier import HEAD_FILE, EventClassifier
from app.models.sentiment import SentimentModel
from app.pipeline.clustering import EventStore
from app.pipeline.entity_linking import EntityLinker
from app.retrieval.analog_index import AnalogIndex
from app.scoring.impact import blend_with_analogs, impact_score
from app.scoring.market_confirmation import MarketConfirmation

SENTENCE = re.compile(r"\S.*?(?:[.!?](?=\s|$)|$)", re.S)
MAX_EVIDENCE = 300
MARKET_WIDE = {"Geopolitical", "Macroeconomic", "Regulatory Event", "Credit Event"}
CONFIDENCE_FACTOR = {"confirmed": 1.05, "unconfirmed": 0.9}
COUNTERS = [
    "cache_hit", "cache_miss", "cache_flip", "events_new", "events_joined",
    "escalated", "adjudicated", "abstained", "llm_error", "degraded", "injection_blocked",
]


class Engine:
    def __init__(self):
        self.ready = False
        self.validator = validator("signal")
        self.redis = redis.Redis.from_url(config.REDIS_URL, decode_responses=True)
        self.llm = LLMClient()

    def load(self):
        artifacts = Path(config.ARTIFACTS_DIR)
        self.linker = EntityLinker(config.ALIAS_TABLE)
        self.embedder = Embedder(config.EMBEDDING_MODEL)
        self.sentiment = SentimentModel(config.SENTIMENT_MODEL, artifacts / "calibration.json")
        self.classifier = EventClassifier(config.EVENT_MODEL, artifacts / HEAD_FILE)
        self.cache = SemanticCache(
            redis.Redis.from_url(config.REDIS_URL),
            config.CACHE_THRESHOLD,
            config.CACHE_TTL_SEC,
            config.EMBED_DIM,
            on_flip=lambda: self.count("cache_flip"),
        )
        self.market = MarketConfirmation(self.redis)
        self.events = EventStore(config.DATABASE_URL)
        self.analogs = AnalogIndex(config.ANALOGS_PATH, self.embedder)
        self.graph = build_graph(self.llm, self.analogs)
        self.tools = Tools(self.analogs, self.redis)
        self.ready = True

    def count(self, name):
        self.redis.incr(f"stats:{name}")

    def stats(self):
        values = {name: int(self.redis.get(f"stats:{name}") or 0) for name in COUNTERS}
        lookups = values["cache_hit"] + values["cache_miss"]
        values["cache_hit_rate"] = round(values["cache_hit"] / lookups, 3) if lookups else 0.0
        values["llm"] = self.llm.status()
        return values

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

    def classify(self, text, embedding):
        sentiment, sentiment_conf = self.sentiment.score(text)
        event_type, type_conf = self.classifier.classify(text, embedding)
        return {
            "sentiment": sentiment,
            "sentiment_conf": sentiment_conf,
            "event_type": event_type,
            "type_conf": type_conf,
            "adjudicated": False,
        }

    def score(self, item, tickers, analysis, match, source, analogs=None):
        event_type, type_conf = analysis["event_type"], analysis["type_conf"]
        if match and type_conf <= match["type_conf"]:
            event_type, type_conf = match["event_type"], match["type_conf"]
        market = self.market.confirm(tickers, analysis["sentiment"])
        source_count = len(set(match["sources"]) | {source}) if match else 1

        impact = impact_score(
            event_type, analysis["sentiment"], type_conf, item["source"], source_count, market
        )
        if analogs:
            impact = blend_with_analogs(impact, analogs)
        confidence = (analysis["sentiment_conf"] * type_conf) ** 0.5
        confidence = min(confidence * CONFIDENCE_FACTOR.get(market, 1.0), 0.99)
        return {
            "market": market,
            "event_type": event_type,
            "type_conf": type_conf,
            "impact": impact,
            "confidence": confidence,
        }

    def needs_escalation(self, state):
        return state["confidence"] < config.ESCALATE_CONFIDENCE or state["impact"] >= config.ESCALATE_IMPACT

    def to_review(self, item, tickers, analysis, reason):
        entry = {"item": item, "tickers": tickers, "tier1": analysis, "reason": reason}
        self.redis.xadd(
            config.REVIEW_STREAM, {"data": json.dumps(entry)}, maxlen=1000, approximate=True
        )

    def analyze(self, item, persist=True):
        text = item["text"]
        tickers = self.linker.link(text)
        embedding = self.embedder.encode(text)

        analysis, _ = self.cache.lookup(embedding, tickers, text)
        cached = analysis is not None
        self.count("cache_hit" if cached else "cache_miss")
        if not cached:
            analysis = self.classify(text, embedding)
        if not tickers and analysis["event_type"] not in MARKET_WIDE:
            return None

        stamp = datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00"))
        source = item.get("source_name") or item["source"]
        match = self.events.find(embedding, tickers, stamp)
        state = self.score(item, tickers, analysis, match, source)

        evidence, degraded, outcome = None, False, None
        if not analysis.get("adjudicated") and self.needs_escalation(state):
            if is_suspicious(text):
                self.count("injection_blocked")
            else:
                self.count("escalated")
                result = self.graph.invoke({"text": text, "tier1": analysis, "tickers": tickers})
                outcome = result.get("outcome")
                if outcome == "ok":
                    final = result["final"]
                    analysis = {
                        "sentiment": final["sentiment"],
                        "sentiment_conf": final["confidence"],
                        "event_type": final["event_type"],
                        "type_conf": final["confidence"],
                        "adjudicated": True,
                    }
                    evidence = result.get("quote")
                    state = self.score(item, tickers, analysis, match, source, result.get("analogs"))
                    self.count("adjudicated")
                elif outcome == "abstain":
                    self.count("abstained")
                    self.to_review(item, tickers, analysis, result.get("reason", ""))
                    if state["confidence"] < config.ABSTAIN_FLOOR:
                        return None
                    state["confidence"] *= config.ABSTAIN_PENALTY
                else:
                    degraded = True
                    self.count("llm_error")
                    self.count("degraded")

        if persist and not cached and not degraded and outcome != "abstain":
            self.cache.store(embedding, tickers, text, analysis)

        evidence = evidence or self.evidence(text, tickers)
        if evidence is None:
            return None

        if persist:
            event_id = self.events.save(
                match, embedding, tickers, state["event_type"], state["type_conf"], source,
                stamp, analysis["sentiment"], state["confidence"], state["impact"],
            )
            self.count("events_joined" if match else "events_new")
        elif match:
            event_id = match["event_id"]
        else:
            event_id = "evt-" + hashlib.sha1(text.encode()).hexdigest()[:10]

        signal = {
            "schema_version": "1",
            "signal_id": str(uuid.uuid4()),
            "event_id": event_id,
            "timestamp": item["timestamp"],
            "source": item["source"],
            "tickers": tickers,
            "sentiment": round(analysis["sentiment"], 3),
            "event_type": state["event_type"],
            "impact": state["impact"],
            "confidence": round(state["confidence"], 2),
            "evidence_span": evidence,
            "market_confirmation": state["market"],
            "degraded": degraded,
        }
        if item.get("source_name"):
            signal["source_name"] = item["source_name"]
        if item.get("url"):
            signal["url"] = item["url"]

        self.validator.validate(signal)
        return signal
