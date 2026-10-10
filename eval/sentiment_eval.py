import numpy as np
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

from app.models.sentiment import softmax
from eval.metrics import bootstrap_ci, ece, fit_temperature, macro_f1, reliability_bins


def load_phrasebank():
    from datasets import load_dataset

    data = load_dataset(
        "takala/financial_phrasebank", "sentences_allagree", split="train", trust_remote_code=True
    )
    names = data.features["label"].names
    return [r["sentence"] for r in data], [names[r["label"]] for r in data]


def load_fiqa():
    from datasets import load_dataset

    data = load_dataset("TheFinAI/fiqa-sentiment-classification", split="train", trust_remote_code=True)
    texts, labels = [], []
    for row in data:
        score = row.get("sentiment_score", row.get("score"))
        texts.append(row.get("sentence", row.get("text")))
        labels.append("negative" if score < -0.1 else "positive" if score > 0.1 else "neutral")
    return texts, labels


LOADERS = {"phrasebank": load_phrasebank, "fiqa": load_fiqa}
NOTES = {"phrasebank": "FinBERT was fine-tuned on this dataset, so the score is optimistic"}


def logits_for(model, texts, batch=32):
    return np.concatenate([model.logits(texts[i : i + batch]) for i in range(0, len(texts), batch)])


def evaluate(name, model):
    texts, labels = LOADERS[name]()
    y = np.array([model.labels.index(label) for label in labels])
    logits = logits_for(model, texts)

    val, test = train_test_split(np.arange(len(y)), test_size=0.7, stratify=y, random_state=0)
    temperature = fit_temperature(logits[val], y[val])
    pred = logits[test].argmax(axis=1)
    low, high = bootstrap_ci(y[test], pred)

    return {
        "dataset": name,
        "n_test": int(len(test)),
        "macro_f1": round(macro_f1(y[test], pred), 4),
        "macro_f1_ci": [round(low, 4), round(high, 4)],
        "accuracy": round(float(accuracy_score(y[test], pred)), 4),
        "ece_before": round(ece(softmax(logits[test]), y[test]), 4),
        "ece_after": round(ece(softmax(logits[test], temperature), y[test]), 4),
        "temperature": round(temperature, 3),
        "reliability_before": reliability_bins(softmax(logits[test]), y[test]),
        "reliability_after": reliability_bins(softmax(logits[test], temperature), y[test]),
        "note": NOTES.get(name, ""),
    }
