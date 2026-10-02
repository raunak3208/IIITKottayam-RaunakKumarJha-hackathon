import json
import re

CASHTAG = re.compile(r"\$([A-Z]{1,5}(?:\.[A-Z])?)\b")
BARE_TICKER = re.compile(r"\b[A-Z]{3,5}\b")


def _boundary(alias):
    return re.compile(r"(?<![A-Za-z0-9])" + re.escape(alias) + r"(?![A-Za-z0-9])")


class EntityLinker:
    def __init__(self, table_path):
        with open(table_path) as handle:
            table = json.load(handle)
        self.tickers = set(table)
        self.aliases = [(t, _boundary(a)) for t, names in table.items() for a in names]

    def link(self, text):
        found = set()
        for ticker, pattern in self.aliases:
            if pattern.search(text):
                found.add(ticker)
        for match in CASHTAG.findall(text):
            if match in self.tickers:
                found.add(match)
        for match in BARE_TICKER.findall(text):
            if match in self.tickers:
                found.add(match)
        return sorted(found)[:5]
