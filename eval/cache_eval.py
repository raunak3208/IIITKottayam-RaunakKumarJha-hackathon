import json
from pathlib import Path

import numpy as np

from app import config
from app.cache.semantic_cache import meaning_flip, scope_key
from app.models.embeddings import Embedder

THRESHOLDS = [0.80, 0.85, 0.90, 0.92, 0.95]
MODES = ["similarity_only", "with_scope", "with_scope_and_guard"]


def decide(mode, similarity, pair, threshold):
    if similarity < threshold:
        return False
    if mode != "similarity_only" and scope_key(pair["tickers_a"]) != scope_key(pair["tickers_b"]):
        return False
    if mode == "with_scope_and_guard" and meaning_flip(pair["a"], pair["b"]):
        return False
    return True


def run():
    path = Path(config.TRICKY_PAIRS_PATH)
    if not path.exists():
        print(f"cache eval skipped: {path} not found")
        return None

    pairs = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    embedder = Embedder(config.EMBEDDING_MODEL)
    a = embedder.encode_many([p["a"] for p in pairs])
    b = embedder.encode_many([p["b"] for p in pairs])
    similarities = (a * b).sum(axis=1)

    sweep = []
    for threshold in THRESHOLDS:
        row = {"threshold": threshold}
        for mode in MODES:
            hits = [decide(mode, s, p, threshold) for s, p in zip(similarities, pairs)]
            same = [h for h, p in zip(hits, pairs) if p["same"]]
            different = [h for h, p in zip(hits, pairs) if not p["same"]]
            row[mode] = {
                "hit_rate": round(float(np.mean(same)), 3),
                "false_hit_rate": round(float(np.mean(different)), 3),
            }
        sweep.append(row)
    return {"pairs": len(pairs), "sweep": sweep}
