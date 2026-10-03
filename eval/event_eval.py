import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix

from app import config
from app.models.embeddings import Embedder
from app.models.event_classifier import HEAD_FILE, ZeroShotClassifier
from eval.metrics import bootstrap_ci, macro_f1, time_split


def report(y_true, y_pred):
    labels = sorted(set(y_true) | set(y_pred))
    low, high = bootstrap_ci(y_true, y_pred)
    return {
        "macro_f1": round(macro_f1(y_true, y_pred), 4),
        "macro_f1_ci": [round(low, 4), round(high, 4)],
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "labels": labels,
        "confusion": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
    }


def run():
    path = Path(config.GOLD_PATH)
    if not path.exists():
        print(f"event eval skipped: {path} not found")
        return None

    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    _, test = time_split(rows)
    texts = [r["text"] for r in test]
    y = np.array([r["event_type"] for r in test])

    result = {"n_test": len(test)}
    head_path = Path(config.ARTIFACTS_DIR) / HEAD_FILE
    if head_path.exists():
        vectors = Embedder(config.EMBEDDING_MODEL).encode_many(texts)
        result["embedding_head"] = report(y, joblib.load(head_path).predict(vectors))

    zero_shot = ZeroShotClassifier(config.EVENT_MODEL)
    result["zero_shot"] = report(y, np.array([zero_shot.classify(t)[0] for t in texts]))
    return result
