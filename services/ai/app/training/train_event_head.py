import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import redis
from sklearn.linear_model import LogisticRegression

from app import config
from app.models.embeddings import Embedder
from app.models.event_classifier import HEAD_FILE, ZeroShotClassifier
from eval.metrics import time_split

GOLD_WEIGHT = 3.0


def pseudo_labelled(limit, min_conf, per_class):
    client = redis.Redis.from_url(config.REDIS_URL, decode_responses=True)
    zero_shot = ZeroShotClassifier(config.EVENT_MODEL)
    rows, counts = [], {}
    for _, fields in client.xrevrange(config.RAW_STREAM, count=limit):
        text = json.loads(fields["data"])["text"]
        label, confidence = zero_shot.classify(text)
        if confidence < min_conf or counts.get(label, 0) >= per_class:
            continue
        counts[label] = counts.get(label, 0) + 1
        rows.append((text, label, 1.0))
    return rows


def gold_train_rows():
    path = Path(config.GOLD_PATH)
    if not path.exists():
        return []
    gold = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    train, _ = time_split(gold)
    return [(r["text"], r["event_type"], GOLD_WEIGHT) for r in train]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=3000)
    parser.add_argument("--min-conf", type=float, default=0.6)
    parser.add_argument("--per-class", type=int, default=400)
    args = parser.parse_args()

    rows = gold_train_rows() + pseudo_labelled(args.limit, args.min_conf, args.per_class)
    labels = sorted({label for _, label, _ in rows})
    if len(labels) < 2:
        raise SystemExit("need examples from at least two event types to train")

    vectors = Embedder(config.EMBEDDING_MODEL).encode_many([text for text, _, _ in rows])
    head = LogisticRegression(max_iter=2000, C=4.0, class_weight="balanced")
    head.fit(vectors, np.array([label for _, label, _ in rows]), sample_weight=[w for _, _, w in rows])

    out = Path(config.ARTIFACTS_DIR) / HEAD_FILE
    out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(head, out)
    print(f"trained on {len(rows)} examples, classes: {labels}")
    print(f"saved {out}")


if __name__ == "__main__":
    main()
