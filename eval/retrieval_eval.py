import json
from pathlib import Path

from app import config
from app.retrieval.analog_index import AnalogIndex

CUTOFFS = (1, 3, 5)


def run(embedder):
    path = Path(config.RETRIEVAL_QUERIES_PATH)
    if not path.exists():
        print(f"retrieval eval skipped: {path} not found")
        return None

    queries = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    index = AnalogIndex(config.ANALOGS_PATH, embedder)
    out = {"queries": len(queries)}
    for mode in ("bm25", "dense", "hybrid"):
        hits = {k: 0 for k in CUTOFFS}
        for q in queries:
            found = [r["id"] for r in index.search(q["query"], k=max(CUTOFFS), mode=mode)]
            for k in CUTOFFS:
                hits[k] += any(i in q["relevant"] for i in found[:k])
        out[mode] = {f"recall@{k}": round(hits[k] / len(queries), 3) for k in CUTOFFS}
    return out
