import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CONTRACTS_DIR = os.getenv("CONTRACTS_DIR", "../../contracts")
ALIAS_TABLE = os.getenv("ALIAS_TABLE", "../../data/universe/sp100_alias_table.json")

SENTIMENT_MODEL = os.getenv("SENTIMENT_MODEL", "ProsusAI/finbert")
EVENT_MODEL = os.getenv("EVENT_MODEL", "MoritzLaurer/deberta-v3-base-zeroshot-v2.0")

RAW_STREAM = "raw.items"
SIGNAL_STREAM = "signals.v1"
DLQ_STREAM = "raw.dlq"
GROUP = "ai"
