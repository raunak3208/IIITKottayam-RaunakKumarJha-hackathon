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


class EventClassifier:
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
