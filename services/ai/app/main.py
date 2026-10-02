import hashlib
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

import redis
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field

from app import config
from app.pipeline import consumer
from app.pipeline.analyze import Engine

engine = Engine()
client = redis.Redis.from_url(config.REDIS_URL)


@asynccontextmanager
async def lifespan(app):
    stop = threading.Event()
    threading.Thread(target=consumer.run, args=(engine, stop), daemon=True).start()
    yield
    stop.set()


app = FastAPI(title="riskpulse-ai", lifespan=lifespan)


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=20, max_length=5000)
    source: Literal["news", "social", "filing"] = "news"


@app.get("/health")
def health(response: Response):
    try:
        redis_ok = bool(client.ping())
    except redis.RedisError:
        redis_ok = False
    ok = redis_ok and engine.ready
    response.status_code = 200 if ok else 503
    return {"status": "ok" if ok else "degraded", "redis": redis_ok, "models_ready": engine.ready}


@app.post("/v1/analyze")
def analyze(request: AnalyzeRequest):
    if not engine.ready:
        raise HTTPException(503, "models are still loading")
    item = {
        "item_id": hashlib.sha256(request.text.encode()).hexdigest(),
        "text": request.text,
        "source": request.source,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }
    signal = engine.analyze(item)
    if signal is None:
        raise HTTPException(422, "no market-relevant content found")
    return signal
