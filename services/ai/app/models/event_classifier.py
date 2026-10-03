from pathlib import Path

import joblib
from transformers import pipeline

LABELS = {
    "geopolitical events such as war, sanctions or trade restrictions": "Geopolitical",
    "macroeconomic news such as interest rates, inflation or employment": "Macroeconomic",
    "credit events such as downgrades, defaults or bankruptcy": "Credit Event",
    "mergers and acquisitions": "Merger/Acquisition",
    "a product launch or new product announcement": "Product Launch",
    "regulatory action, lawsuits or government investigations": "Regulatory Event",
    "company earnings results or guidance": "Earnings",
    "general news with no clear market event": "Other",
}

MIN_CONFIDENCE = 0.30
HEAD_FILE = "event_head.joblib"


class ZeroShotClassifier:
    def __init__(self, name):
        self.pipe = pipeline("zero-shot-classification", model=name)

    def classify(self, text):
        result = self.pipe(
            text[:1000],
            candidate_labels=list(LABELS),
            hypothesis_template="This text is about {}.",
        )
        label, score = LABELS[result["labels"][0]], result["scores"][0]
        if score < MIN_CONFIDENCE:
            return "Other", score
        return label, score


class EventClassifier:
    def __init__(self, zero_shot_name, head_path):
        path = Path(head_path)
        self.head = joblib.load(path) if path.exists() else None
        self.zero_shot = None if self.head else ZeroShotClassifier(zero_shot_name)

    def classify(self, text, embedding):
        if self.head is None:
            return self.zero_shot.classify(text)
        probs = self.head.predict_proba(embedding.reshape(1, -1))[0]
        best = int(probs.argmax())
        return str(self.head.classes_[best]), float(probs[best])
