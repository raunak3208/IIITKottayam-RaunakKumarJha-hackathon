import json
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


def softmax(logits, temperature=1.0):
    z = logits / temperature
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


class SentimentModel:
    def __init__(self, name, calibration_path):
        self.tokenizer = AutoTokenizer.from_pretrained(name)
        self.model = AutoModelForSequenceClassification.from_pretrained(name).eval()
        config = self.model.config
        self.labels = [config.id2label[i].lower() for i in range(config.num_labels)]
        path = Path(calibration_path)
        self.temperature = json.loads(path.read_text())["temperature"] if path.exists() else 1.0

    def logits(self, texts):
        batch = self.tokenizer(
            texts, padding=True, truncation=True, max_length=256, return_tensors="pt"
        )
        with torch.no_grad():
            return self.model(**batch).logits.numpy()

    def score(self, text):
        probs = softmax(self.logits([text]), self.temperature)[0]
        by_label = dict(zip(self.labels, probs))
        value = by_label.get("positive", 0.0) - by_label.get("negative", 0.0)
        return float(value), float(probs.max())
