import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://riskpulse:riskpulse@localhost:5432/riskpulse")
CONTRACTS_DIR = os.getenv("CONTRACTS_DIR", "../../contracts")
ALIAS_TABLE = os.getenv("ALIAS_TABLE", "../../data/universe/sp100_alias_table.json")
ARTIFACTS_DIR = os.getenv("ARTIFACTS_DIR", "../../artifacts")
GOLD_PATH = os.getenv("GOLD_PATH", "../../data/gold/gold_events.jsonl")
TRICKY_PAIRS_PATH = os.getenv("TRICKY_PAIRS_PATH", "../../data/gold/tricky_pairs.jsonl")

SENTIMENT_MODEL = os.getenv("SENTIMENT_MODEL", "ProsusAI/finbert")
EVENT_MODEL = os.getenv("EVENT_MODEL", "MoritzLaurer/deberta-v3-base-zeroshot-v2.0")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
EMBED_DIM = 384

CACHE_THRESHOLD = float(os.getenv("CACHE_THRESHOLD", "0.92"))
CACHE_TTL_SEC = 86400
CLUSTER_THRESHOLD = float(os.getenv("CLUSTER_THRESHOLD", "0.80"))
CLUSTER_WINDOW_HOURS = int(os.getenv("CLUSTER_WINDOW_HOURS", "48"))
MARKET_CACHE_TTL_SEC = 600

RAW_STREAM = "raw.items"
SIGNAL_STREAM = "signals.v1"
DLQ_STREAM = "raw.dlq"
GROUP = "ai"

ANALOGS_PATH = os.getenv("ANALOGS_PATH", "../../data/analogs/historical_events.jsonl")
QUANT_URL = os.getenv("QUANT_URL", "http://localhost:8001")

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mistral")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL") or {"mistral": "mistral-small-latest"}.get(LLM_PROVIDER, "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_SEND_TEMPERATURE = os.getenv("LLM_SEND_TEMPERATURE", "true") == "true"
LLM_JSON_MODE = os.getenv("LLM_JSON_MODE", "true" if LLM_PROVIDER == "mistral" else "false") == "true"
LLM_MIN_INTERVAL_SEC = float(os.getenv("LLM_MIN_INTERVAL_SEC", "1.1" if LLM_PROVIDER == "mistral" else "0"))
LLM_TIMEOUT_SEC = float(os.getenv("LLM_TIMEOUT_SEC", "30"))

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
TAVILY_CACHE_TTL_SEC = 3600

ESCALATE_CONFIDENCE = float(os.getenv("ESCALATE_CONFIDENCE", "0.65"))
ESCALATE_IMPACT = float(os.getenv("ESCALATE_IMPACT", "7.0"))
ABSTAIN_FLOOR = 0.5
ABSTAIN_PENALTY = 0.8
REVIEW_STREAM = "review.queue"
