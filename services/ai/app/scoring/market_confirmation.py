import json

import numpy as np

from app import config

MARKET_PROXY = "SPY"
SCREAM = 0.4
MIN_BARS = 40


def _z(value, base):
    spread = base.std(ddof=1)
    return float((value - base.mean()) / spread) if spread > 0 else 0.0


def compute_stats(closes, volumes):
    closes = np.asarray(closes, dtype=float)
    volumes = np.asarray(volumes, dtype=float)
    if len(closes) < MIN_BARS:
        return None
    returns = np.diff(closes) / closes[:-1]
    return {
        "ret_z": _z(returns[-1], returns[:-1]),
        "vol_z": _z(volumes[-1], volumes[:-1]),
    }


def judge(sentiment, stats):
    if abs(sentiment) < SCREAM:
        return "not_applicable"
    if not stats:
        return "pending"
    for s in stats:
        moved_with_text = abs(s["ret_z"]) >= 2 and np.sign(s["ret_z"]) == np.sign(sentiment)
        if moved_with_text or s["vol_z"] >= 2:
            return "confirmed"
    if all(abs(s["ret_z"]) < 1 and s["vol_z"] < 1 for s in stats):
        return "unconfirmed"
    return "pending"


class MarketConfirmation:
    def __init__(self, client):
        self.client = client

    def _fetch(self, ticker):
        try:
            import yfinance as yf

            history = yf.Ticker(ticker.replace(".", "-")).history(period="4mo", interval="1d")
            history = history.dropna(subset=["Close", "Volume"])
            return compute_stats(history["Close"].tolist(), history["Volume"].tolist())
        except Exception:
            return None

    def _stats(self, ticker):
        key = f"mkt:{ticker}"
        cached = self.client.get(key)
        if cached is not None:
            return json.loads(cached)
        stats = self._fetch(ticker)
        ttl = config.MARKET_CACHE_TTL_SEC if stats else 60
        self.client.set(key, json.dumps(stats), ex=ttl)
        return stats

    def confirm(self, tickers, sentiment):
        if abs(sentiment) < SCREAM:
            return "not_applicable"
        symbols = tickers[:3] or [MARKET_PROXY]
        stats = [s for s in (self._stats(t) for t in symbols) if s]
        return judge(sentiment, stats)
