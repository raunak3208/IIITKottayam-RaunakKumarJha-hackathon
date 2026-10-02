from transformers import pipeline


class SentimentModel:
    def __init__(self, name):
        self.pipe = pipeline("text-classification", model=name, truncation=True, max_length=256)

    def score(self, text):
        result = self.pipe([text], top_k=None)
        scores = result[0]
        if isinstance(scores, dict):
            scores = result
        probs = {item["label"].lower(): item["score"] for item in scores}
        value = probs.get("positive", 0.0) - probs.get("negative", 0.0)
        return value, max(probs.values())
