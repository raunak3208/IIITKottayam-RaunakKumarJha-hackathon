"""
ARIA research tools.
Uses Tavily for search and BeautifulSoup for scraping.
"""

import requests
from bs4 import BeautifulSoup
from langchain.tools import tool
from tavily import TavilyClient

from app import config


def _get_tavily() -> TavilyClient:
    """Lazy Tavily client — raises clearly if key is missing at call time, not import time."""
    if not config.TAVILY_API_KEY:
        raise RuntimeError(
            "TAVILY_API_KEY is not set. Add it to your .env file to use the web_search tool."
        )
    return TavilyClient(api_key=config.TAVILY_API_KEY)


@tool
def web_search(query: str) -> str:
    """Search the web for recent and reliable information on a topic. Returns titles, URLs and snippets."""
    results = _get_tavily().search(query=query, max_results=5)

    out = []
    for r in results["results"]:
        out.append(
            f"Title: {r['title']}\nURL: {r['url']}\nSnippet: {r['content'][:300]}\n"
        )

    return "\n----\n".join(out)


@tool
def scrape_url(url: str) -> str:
    """Scrape and return clean text content from a given URL for deeper reading."""
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True)[:3000]
    except Exception as e:
        return f"Could not scrape URL: {str(e)}"