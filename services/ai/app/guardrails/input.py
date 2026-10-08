import re

PATTERNS = [
    r"ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|rules)",
    r"disregard (the |all |any )?(previous|prior|above|system)",
    r"(reveal|show|print|repeat) (me )?(your |the )?(system )?(prompt|instructions)",
    r"\byou are now (an? |the |dan\b|in\b|my\b|unrestricted)",
    r"\bnew instructions\s*[:\-]",
    r"\boverride (the )?(rules|instructions|guardrails)\b",
    r"</?\s*(system|assistant|source|instructions?)\s*>",
    r"\bjailbreak\b",
]

COMPILED = [re.compile(p, re.I) for p in PATTERNS]


def is_suspicious(text):
    return any(p.search(text) for p in COMPILED)
