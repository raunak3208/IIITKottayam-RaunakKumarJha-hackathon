import numpy as np

WINDOW = 100
KEEP = 2 * WINDOW
BINS = np.linspace(-1, 1, 11)
PSI_ALERT = 0.2
CONFIDENCE_ALERT = 0.1
CACHE_ALERT = 0.2


def psi(reference, recent):
    ref = np.histogram(reference, bins=BINS)[0] / max(len(reference), 1)
    cur = np.histogram(recent, bins=BINS)[0] / max(len(recent), 1)
    ref, cur = np.clip(ref, 1e-4, None), np.clip(cur, 1e-4, None)
    return float(np.sum((cur - ref) * np.log(cur / ref)))


class DriftMonitor:
    def __init__(self, client):
        self.client = client

    def _push(self, key, value):
        pipe = self.client.pipeline()
        pipe.lpush(key, value)
        pipe.ltrim(key, 0, KEEP - 1)
        pipe.execute()

    def _windows(self, key):
        values = [float(v) for v in self.client.lrange(key, 0, KEEP - 1)]
        return values[:WINDOW], values[WINDOW:]

    def record_signal(self, sentiment, confidence):
        self._push("drift:sentiment", round(sentiment, 4))
        self._push("drift:confidence", round(confidence, 4))

    def record_cache(self, hit):
        self._push("drift:cache", 1 if hit else 0)

    def report(self):
        recent, reference = self._windows("drift:sentiment")
        if len(reference) < WINDOW:
            return {"status": "warming_up", "signals_seen": len(recent) + len(reference), "window": WINDOW}

        recent_conf, reference_conf = self._windows("drift:confidence")
        recent_cache, reference_cache = self._windows("drift:cache")
        metrics = {
            "sentiment_psi": round(psi(reference, recent), 3),
            "confidence_shift": round(float(np.mean(recent_conf) - np.mean(reference_conf)), 3),
        }
        if len(reference_cache) == WINDOW:
            metrics["cache_hit_rate_shift"] = round(
                float(np.mean(recent_cache) - np.mean(reference_cache)), 3
            )

        alerts = []
        if metrics["sentiment_psi"] > PSI_ALERT:
            alerts.append("sentiment distribution has shifted")
        if abs(metrics["confidence_shift"]) > CONFIDENCE_ALERT:
            alerts.append("mean confidence has shifted")
        if metrics.get("cache_hit_rate_shift", 0) < -CACHE_ALERT:
            alerts.append("cache hit rate has dropped")
        return {"status": "alert" if alerts else "ok", "window": WINDOW, "metrics": metrics, "alerts": alerts}
