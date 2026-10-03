import json
import math
import re
from collections import Counter
from pathlib import Path

import numpy as np

TOKEN = re.compile(r"[a-z0-9]+")


class BM25:
    def __init__(self, docs, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.tf = [Counter(TOKEN.findall(d.lower())) for d in docs]
        self.lengths = np.array([sum(tf.values()) for tf in self.tf], dtype=float)
        self.avg = self.lengths.mean() if len(docs) else 1.0
        frequency = Counter(w for tf in self.tf for w in tf)
        n = len(docs)
        self.idf = {w: math.log(1 + (n - c + 0.5) / (c + 0.5)) for w, c in frequency.items()}

    def scores(self, query):
        words = TOKEN.findall(query.lower())
        out = np.zeros(len(self.tf))
        for i, tf in enumerate(self.tf):
            norm = self.k1 * (1 - self.b + self.b * self.lengths[i] / self.avg)
            for w in words:
                f = tf.get(w, 0)
                if f:
                    out[i] += self.idf[w] * f * (self.k1 + 1) / (f + norm)
        return out


def ranking(scores):
    return [int(i) for i in np.argsort(-scores)]


def rrf(rankings, k=60):
    fused = {}
    for order in rankings:
        for position, index in enumerate(order):
            fused[index] = fused.get(index, 0.0) + 1.0 / (k + position + 1)
    return sorted(fused, key=lambda i: -fused[i])


class AnalogIndex:
    def __init__(self, path, embedder):
        file = Path(path)
        lines = file.read_text().splitlines() if file.exists() else []
        self.events = [json.loads(line) for line in lines if line.strip()]
        docs = [f"{e['title']}. {e['summary']}" for e in self.events]
        self.embedder = embedder
        self.bm25 = BM25(docs)
        self.vectors = embedder.encode_many(docs) if docs else np.zeros((0, 1), dtype=np.float32)

    def search(self, query, k=3, mode="hybrid", embedding=None):
        if not self.events:
            return []
        if embedding is None:
            embedding = self.embedder.encode(query)
        sparse = ranking(self.bm25.scores(query))
        dense = ranking(self.vectors @ embedding)
        order = {"bm25": sparse, "dense": dense, "hybrid": rrf([sparse, dense])}[mode]
        return [self._view(self.events[i]) for i in order[:k]]

    @staticmethod
    def _view(event):
        keys = ("id", "date", "title", "event_type", "reaction_1d_pct", "reaction_5d_pct")
        return {k: event.get(k) for k in keys}
