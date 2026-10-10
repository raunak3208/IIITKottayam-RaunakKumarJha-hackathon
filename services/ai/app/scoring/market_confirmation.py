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
            import requests

            symbol = ticker.replace(".", "-")
            url = f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?range=4mo&interval=1d"
            res = requests.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                timeout=5,
            )
            if res.status_code != 200:
                return None
            data = res.json()
            results = data.get("chart", {}).get("result")
            if not results:
                return None
            quote = results[0].get("indicators", {}).get("quote", [{}])[0]
            raw_closes = quote.get("close", [])
            raw_volumes = quote.get("volume", [])
            closes, volumes = [], []
            for c, v in zip(raw_closes, raw_volumes):
                if c is not None and v is not None:
                    closes.append(float(c))
                    volumes.append(float(v))
            return compute_stats(closes, volumes)
        except Exception:
            return None

    def _stats(self, ticker):
        key = f"mkt:{ticker}"
        cached = self.client.get(key)
        if cached is not None:
            return json.loads(cached)
        stats = self._fetch(ticker)
        ttl = config.MARKET_CACHE_TTL_SEC if stats else 300
        self.client.set(key, json.dumps(stats), ex=ttl)
        return stats

    def confirm(self, tickers, sentiment):
        if abs(sentiment) < SCREAM:
            return "not_applicable"
        symbols = tickers[:3] or [MARKET_PROXY]
        stats = [s for s in (self._stats(t) for t in symbols) if s]
        return judge(sentiment, stats)
