import json
from pathlib import Path

from sklearn.metrics import roc_auc_score

from app import config
from app.models.embeddings import Embedder

MODELS = {
    "bge-small-en-v1.5": "BAAI/bge-small-en-v1.5",
    "all-MiniLM-L6-v2": "sentence-transformers/all-MiniLM-L6-v2",
}


def run():
    path = Path(config.TRICKY_PAIRS_PATH)
    if not path.exists():
        print(f"embeddings eval skipped: {path} not found")
        return None

    pairs = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    same = [1 if p["same"] else 0 for p in pairs]
    out = {"pairs": len(pairs)}
    for name, model in MODELS.items():
        embedder = Embedder(model)
        a = embedder.encode_many([p["a"] for p in pairs])
        b = embedder.encode_many([p["b"] for p in pairs])
        sims = (a * b).sum(axis=1)
        mean_same = float(sims[[i for i, v in enumerate(same) if v]].mean())
        mean_different = float(sims[[i for i, v in enumerate(same) if not v]].mean())
        out[name] = {
            "auc": round(float(roc_auc_score(same, sims)), 3),
            "mean_same": round(mean_same, 3),
            "mean_different": round(mean_different, 3),
        }
    return out
