import json
import logging
import os

import redis

from app import config

log = logging.getLogger("consumer")


def _handle(client, engine, entry_id, fields):
    try:
        signal = engine.analyze(json.loads(fields["data"]))
        if signal:
            client.xadd(
                config.SIGNAL_STREAM,
                {"data": json.dumps(signal)},
                maxlen=10000,
                approximate=True,
            )
    except Exception as err:
        log.exception("item %s failed", entry_id)
        client.xadd(config.DLQ_STREAM, {"reason": str(err), "data": fields.get("data", "")})
    client.xack(config.RAW_STREAM, config.GROUP, entry_id)


def run(engine, stop):
    engine.load()
    client = redis.Redis.from_url(config.REDIS_URL, decode_responses=True)
    try:
        client.xgroup_create(config.RAW_STREAM, config.GROUP, id="0", mkstream=True)
    except redis.ResponseError as err:
        if "BUSYGROUP" not in str(err):
            raise

    consumer = f"ai-{os.getpid()}"
    while not stop.is_set():
        try:
            batch = client.xreadgroup(
                config.GROUP, consumer, {config.RAW_STREAM: ">"}, count=10, block=5000
            )
        except redis.RedisError:
            log.exception("stream read failed")
            stop.wait(1)
            continue
        for _, entries in batch or []:
            for entry_id, fields in entries:
                _handle(client, engine, entry_id, fields)
