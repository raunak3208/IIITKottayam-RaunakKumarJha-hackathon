import hashlib
import json
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

import redis
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field

from app import config
from app.agents import adapter
from app.jobs import JobRunner
from app.pipeline import consumer
from app.pipeline.analyze import Engine

engine = Engine()
runner = JobRunner(engine=engine, on_success=lambda name: engine.reload_artifacts() if engine.ready else None)
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
    return {
        "status": "ok" if ok else "degraded",
        "redis": redis_ok,
        "models_ready": engine.ready,
        "llm": engine.llm.status(),
    }


class ChaosRequest(BaseModel):
    llm_down: bool


class InvestigateRequest(BaseModel):
    event_id: str


@app.get("/v1/chaos")
def get_chaos():
    return {"llm_down": engine.llm.forced_down}


@app.post("/v1/chaos")
def set_chaos(request: ChaosRequest):
    engine.llm.forced_down = request.llm_down
    return {"llm_down": engine.llm.forced_down}


@app.post("/v1/investigate")
def investigate(request: InvestigateRequest):
    if not engine.ready:
        raise HTTPException(503, "models are still loading")
    key = f"dossier:{request.event_id}"
    cached = engine.redis.get(key)
    if cached:
        return json.loads(cached)
    try:
        dossier = adapter.investigate(request.event_id, engine.events, engine.tools)
    except adapter.EventNotFound:
        raise HTTPException(404, "unknown event")
    engine.redis.set(key, json.dumps(dossier), ex=600)
    return dossier


@app.get("/v1/jobs")
def jobs():
    return {"items": runner.snapshot()}


@app.post("/v1/jobs/{name}")
def start_job(name: str):
    try:
        runner.start(name)
    except KeyError:
        raise HTTPException(404, "unknown job")
    except RuntimeError as err:
        raise HTTPException(409, str(err))
    return {"started": name}


@app.get("/v1/drift")
def drift():
    if not engine.ready:
        raise HTTPException(503, "models are still loading")
    return engine.drift.report()


@app.get("/v1/stats")
def stats():
    return engine.stats()


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
    signal = engine.analyze(item, persist=False)
    if signal is None:
        raise HTTPException(422, "no market-relevant content found")
    return signal
