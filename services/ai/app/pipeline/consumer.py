import json
import logging
import os
import socket
import time

import httpx
import psycopg
import redis

from app import config

log = logging.getLogger("consumer")

ATTEMPTS = 3
TRANSIENT = (redis.RedisError, psycopg.OperationalError, httpx.TransportError)


def _publish(client, signal):
    client.xadd(
        config.SIGNAL_STREAM, {"data": json.dumps(signal)}, maxlen=10000, approximate=True
    )


def _handle(client, engine, entry_id, fields):
    for attempt in range(ATTEMPTS):
        try:
            signal = engine.analyze(json.loads(fields["data"]))
            if signal:
                _publish(client, signal)
            break
        except TRANSIENT as err:
            if attempt < ATTEMPTS - 1:
                time.sleep(0.5 * 2**attempt)
                continue
            log.exception("item %s failed after retries", entry_id)
            client.xadd(config.DLQ_STREAM, {"reason": str(err), "data": fields.get("data", "")})
        except Exception as err:
            log.exception("item %s failed", entry_id)
            client.xadd(config.DLQ_STREAM, {"reason": str(err), "data": fields.get("data", "")})
            break
    client.xack(config.RAW_STREAM, config.GROUP, entry_id)


def run(engine, stop):
    engine.load()
    client = redis.Redis.from_url(config.REDIS_URL, decode_responses=True)
    try:
        client.xgroup_create(config.RAW_STREAM, config.GROUP, id="0", mkstream=True)
    except redis.ResponseError as err:
        if "BUSYGROUP" not in str(err):
            raise

    consumer = os.getenv("CONSUMER_NAME") or socket.gethostname()
    cursor = "0"
    while not stop.is_set():
        try:
            batch = client.xreadgroup(
                config.GROUP, consumer, {config.RAW_STREAM: cursor}, count=10, block=5000
            )
        except redis.RedisError:
            log.exception("stream read failed")
            stop.wait(1)
            continue

        entries = [entry for _, items in batch or [] for entry in items]
        if cursor == "0" and not entries:
            cursor = ">"
            continue
        for entry_id, fields in entries:
            _handle(client, engine, entry_id, fields)
