import json
import time
from pathlib import Path

import numpy as np

from app import config
from app.graph.escalation_graph import build_graph
from app.llm.client import LLMClient
from eval.metrics import bootstrap_ci, macro_f1, time_split

SENTIMENT_BAND = 0.15
NEUTRAL_TIER1 = {"event_type": "Other", "sentiment": 0.0}


class Usage:
    def __init__(self):
        self.calls = self.tokens_in = self.tokens_out = 0

    def __call__(self, tokens_in, tokens_out):
        self.calls += 1
        self.tokens_in += tokens_in
        self.tokens_out += tokens_out


def sentiment_label(value):
    return "positive" if value > SENTIMENT_BAND else "negative" if value < -SENTIMENT_BAND else "neutral"


def predict(engine, graph, text, mode):
    started = time.perf_counter()
    tier1 = dict(NEUTRAL_TIER1)
    event_type, sentiment, escalated = None, None, False

    if mode != "llm_only":
        tier1 = engine.classify(text, engine.embedder.encode(text))
        event_type, sentiment = tier1["event_type"], tier1["sentiment"]
        confidence = (tier1["sentiment_conf"] * tier1["type_conf"]) ** 0.5
        escalated = mode == "cascade" and confidence < config.ESCALATE_CONFIDENCE
    else:
        escalated = True

    if escalated:
        result = graph.invoke({"text": text, "tier1": tier1, "tickers": []})
        if result.get("outcome") == "ok":
            event_type, sentiment = result["final"]["event_type"], result["final"]["sentiment"]
        elif event_type is None:
            event_type, sentiment = "Other", 0.0
    return event_type, sentiment, escalated, (time.perf_counter() - started) * 1000


def run(engine):
    path = Path(config.GOLD_PATH)
    if not path.exists():
        print(f"ablation skipped: {path} not found")
        return None

    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    _, test = time_split(rows)
    modes = ["tier1_only", "llm_only", "cascade"] if engine.llm.configured else ["tier1_only"]
    if len(modes) == 1:
        print("ablation: no LLM configured, running tier1_only")

    out = {"n_test": len(test), "modes": {}}
    for mode in modes:
        usage = Usage()
        graph = build_graph(LLMClient(recorder=usage), engine.analogs)
        predictions, latencies, escalations = [], [], 0
        for row in test:
            event_type, sentiment, escalated, ms = predict(engine, graph, row["text"], mode)
            predictions.append((event_type, sentiment))
            latencies.append(ms)
            escalations += escalated

        truth = [r["event_type"] for r in test]
        guess = [p[0] for p in predictions]
        low, high = bootstrap_ci(truth, guess)
        labelled = [(r["sentiment_label"], p[1]) for r, p in zip(test, predictions) if r.get("sentiment_label")]
        cost = (
            usage.tokens_in * config.LLM_PRICE_IN_PER_M + usage.tokens_out * config.LLM_PRICE_OUT_PER_M
        ) / 1e6
        out["modes"][mode] = {
            "event_macro_f1": round(macro_f1(truth, guess), 4),
            "event_macro_f1_ci": [round(low, 4), round(high, 4)],
            "sentiment_accuracy": round(
                float(np.mean([sentiment_label(v) == lab for lab, v in labelled])), 4
            ) if labelled else None,
            "mean_ms": round(float(np.mean(latencies)), 1),
            "p95_ms": round(float(np.percentile(latencies, 95)), 1),
            "escalation_rate": round(escalations / len(test), 3),
            "llm_calls": usage.calls,
            "tokens": usage.tokens_in + usage.tokens_out,
            "cost_per_item_usd": round(cost / len(test), 6),
        }
    return out
