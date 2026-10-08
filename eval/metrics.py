import numpy as np
from sklearn.metrics import f1_score


def macro_f1(y_true, y_pred):
    return float(f1_score(y_true, y_pred, average="macro", zero_division=0))


def bootstrap_ci(y_true, y_pred, n=1000, seed=0):
    rng = np.random.default_rng(seed)
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    scores = []
    for _ in range(n):
        idx = rng.integers(0, len(y_true), len(y_true))
        scores.append(macro_f1(y_true[idx], y_pred[idx]))
    return float(np.percentile(scores, 2.5)), float(np.percentile(scores, 97.5))


def time_split(rows, test_fraction=0.3, key="date"):
    ordered = sorted(rows, key=lambda r: r[key])
    cut = int(len(ordered) * (1 - test_fraction))
    return ordered[:cut], ordered[cut:]


def ece(probs, labels, bins=10):
    confidence = probs.max(axis=1)
    correct = probs.argmax(axis=1) == labels
    edges = np.linspace(0, 1, bins + 1)
    total = 0.0
    for low, high in zip(edges[:-1], edges[1:]):
        mask = (confidence > low) & (confidence <= high)
        if mask.any():
            total += mask.mean() * abs(correct[mask].mean() - confidence[mask].mean())
    return float(total)


def reliability_bins(probs, labels, bins=10):
    confidence = probs.max(axis=1)
    correct = probs.argmax(axis=1) == labels
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for low, high in zip(edges[:-1], edges[1:]):
        mask = (confidence > low) & (confidence <= high)
        if mask.any():
            out.append(
                {
                    "confidence": round(float(confidence[mask].mean()), 3),
                    "accuracy": round(float(correct[mask].mean()), 3),
                    "n": int(mask.sum()),
                }
            )
    return out


def fit_temperature(logits, labels):
    from app.models.sentiment import softmax

    best, best_loss = 1.0, float("inf")
    for t in np.linspace(0.5, 5.0, 91):
        probs = softmax(logits, t)
        loss = -np.log(probs[np.arange(len(labels)), labels] + 1e-12).mean()
        if loss < best_loss:
            best, best_loss = float(t), loss
    return best
