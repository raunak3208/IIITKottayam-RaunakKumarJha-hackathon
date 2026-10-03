import hashlib
import json
import logging

import httpx

from app import config

log = logging.getLogger("tools")


class Tools:
    def __init__(self, index, cache=None):
        self.index = index
        self.cache = cache
        self.http = httpx.Client(base_url=config.QUANT_URL, timeout=20)

    def analogs(self, query, k=3):
        return self.index.search(query, k)

    def portfolio(self):
        response = self.http.get("/v1/portfolio")
        response.raise_for_status()
        return response.json()

    def scenarios(self):
        response = self.http.get("/v1/scenarios")
        response.raise_for_status()
        return response.json()["items"]

    def stress(self, scenario_id, impact=None, confidence=None, tickers=None):
        response = self.http.post(
            "/v1/stress",
            json={
                "scenario_id": scenario_id,
                "impact": impact,
                "confidence": confidence,
                "tickers": tickers or [],
            },
        )
        response.raise_for_status()
        return response.json()

    def web_search(self, query, max_results=3):
        if not config.TAVILY_API_KEY:
            return []
        key = "tavily:" + hashlib.sha1(f"{max_results}|{query}".encode()).hexdigest()[:16]
        if self.cache is not None:
            cached = self.cache.get(key)
            if cached:
                return json.loads(cached)

        try:
            response = httpx.post(
                "https://api.tavily.com/search",
                headers={"Authorization": f"Bearer {config.TAVILY_API_KEY}"},
                json={
                    "query": query[:380],
                    "topic": "news",
                    "days": 7,
                    "search_depth": "basic",
                    "max_results": max_results,
                },
                timeout=20,
            )
            response.raise_for_status()
            results = [
                {"title": r["title"], "url": r["url"], "content": r.get("content", "")}
                for r in response.json().get("results", [])
            ]
        except Exception:
            log.exception("web search failed")
            return []

        if self.cache is not None:
            self.cache.set(key, json.dumps(results), ex=config.TAVILY_CACHE_TTL_SEC)
        return results
