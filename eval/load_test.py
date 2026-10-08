import argparse
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
import redis

from app import config

RESULTS = Path(__file__).parent / "results"
DRAIN_TIMEOUT = 300


def corpus():
    texts = []
    gold = Path(config.GOLD_PATH)
    if gold.exists():
        for line in gold.read_text().splitlines():
            if line.strip():
                row = json.loads(line)
                texts.append((row["text"], row.get("source", "news")))
    for line in Path(config.ANALOGS_PATH).read_text().splitlines():
        if line.strip():
            event = json.loads(line)
            texts.append((f"{event['title']}. {event['summary']}", "news"))
    return texts


def backlog(client):
    group = next(g for g in client.xinfo_groups(config.RAW_STREAM) if g["name"] == config.GROUP)
    return (group.get("lag") or 0) + group["pending"]


def publish(client, texts, cursor, count):
    pipe = client.pipeline()
    for i in range(count):
        text, source = texts[(cursor + i) % len(texts)]
        stamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        item = {
            "item_id": uuid.uuid4().hex,
            "timestamp": stamp,
            "source": source,
            "source_name": "loadtest",
            "text": text,
        }
        pipe.xadd(config.RAW_STREAM, {"data": json.dumps(item)})
    pipe.execute()
    return cursor + count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rate", type=int, default=1, help="steady items per second")
    parser.add_argument("--duration", type=int, default=30, help="steady phase seconds")
    parser.add_argument("--multiplier", type=int, default=10)
    parser.add_argument("--burst-duration", type=int, default=10)
    args = parser.parse_args()

    client = redis.Redis.from_url(config.REDIS_URL, decode_responses=True)
    for tier in ("cache", "tier1", "escalated", "degraded"):
        client.delete(f"latency:{tier}")

    texts = corpus()
    plan = [("steady", args.rate, args.duration), ("burst", args.rate * args.multiplier, args.burst_duration)]
    total = sum(rate * seconds for _, rate, seconds in plan)
    print(f"publishing {total} items from a corpus of {len(texts)}")

    cursor, peak, started = 0, 0, time.monotonic()
    for _, rate, seconds in plan:
        for _ in range(seconds):
            tick = time.monotonic()
            cursor = publish(client, texts, cursor, rate)
            peak = max(peak, backlog(client))
            time.sleep(max(0.0, 1 - (time.monotonic() - tick)))
    published_at = time.monotonic()

    while backlog(client) > 0 and time.monotonic() - published_at < DRAIN_TIMEOUT:
        peak = max(peak, backlog(client))
        time.sleep(1)
    finished = time.monotonic()

    stats = httpx.get("http://127.0.0.1:8000/v1/stats", timeout=10).json()
    result = {
        "steady_rate": args.rate,
        "burst_rate": args.rate * args.multiplier,
        "published": total,
        "reused_corpus_items": max(0, total - len(texts)),
        "peak_backlog": peak,
        "drain_seconds_after_publish": round(finished - published_at, 1),
        "throughput_per_s": round(total / (finished - started), 2),
        "drained": backlog(client) == 0,
        "latency_ms": stats["latency_ms"],
        "cache_hit_rate": stats["cache_hit_rate"],
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "load.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
