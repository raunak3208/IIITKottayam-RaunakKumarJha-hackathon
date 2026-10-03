import uuid
from datetime import timedelta

import numpy as np
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app import config

SEARCH = """
    SELECT event_id, event_type, type_conf, tickers, signal_count, sources,
           sentiment, confidence, centroid, 1 - (centroid <=> %s) AS sim
    FROM events
    WHERE last_seen > %s
    ORDER BY centroid <=> %s
    LIMIT 5
"""

INSERT = """
    INSERT INTO events (event_id, event_type, type_conf, tickers, centroid, first_seen, last_seen,
                        signal_count, sources, impact, sentiment, confidence)
    VALUES (%s, %s, %s, %s, %s, %s, %s, 1, %s, %s, %s, %s)
"""

UPDATE = """
    UPDATE events
    SET event_type = %s, type_conf = %s, tickers = %s, centroid = %s,
        last_seen = GREATEST(last_seen, %s), signal_count = signal_count + 1, sources = %s,
        impact = GREATEST(impact, %s), sentiment = %s, confidence = %s
    WHERE event_id = %s
"""


GET = """
    SELECT event_id, event_type, tickers, first_seen, last_seen, signal_count, sources,
           impact, sentiment, confidence
    FROM events WHERE event_id = %s
"""


def _same_entities(a, b):
    return (not a and not b) or bool(set(a) & set(b))


class EventStore:
    def __init__(self, url):
        self.pool = ConnectionPool(
            url,
            min_size=1,
            max_size=4,
            configure=register_vector,
            kwargs={"autocommit": True},
            open=True,
        )

    def find(self, embedding, tickers, stamp):
        since = stamp - timedelta(hours=config.CLUSTER_WINDOW_HOURS)
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(SEARCH, (embedding, since, embedding))
            rows = cur.fetchall()
        for row in rows:
            if row["sim"] >= config.CLUSTER_THRESHOLD and _same_entities(tickers, row["tickers"]):
                return row
        return None

    def save(self, match, embedding, tickers, event_type, type_conf, source, stamp,
             sentiment, confidence, impact):
        with self.pool.connection() as conn:
            if match is None:
                event_id = "evt-" + uuid.uuid4().hex[:10]
                conn.execute(
                    INSERT,
                    (event_id, event_type, type_conf, sorted(tickers), embedding, stamp, stamp,
                     [source], impact, sentiment, confidence),
                )
                return event_id

            n = match["signal_count"]
            centroid = (match["centroid"] * n + embedding) / (n + 1)
            centroid = (centroid / np.linalg.norm(centroid)).astype(np.float32)
            conn.execute(
                UPDATE,
                (event_type, type_conf, sorted(set(match["tickers"]) | set(tickers)), centroid,
                 stamp, sorted(set(match["sources"]) | {source}), impact,
                 (match["sentiment"] * n + sentiment) / (n + 1),
                 (match["confidence"] * n + confidence) / (n + 1), match["event_id"]),
            )
            return match["event_id"]

    def get(self, event_id):
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(GET, (event_id,))
            row = cur.fetchone()
        if row is None:
            return None
        row["first_seen"] = row["first_seen"].isoformat()
        row["last_seen"] = row["last_seen"].isoformat()
        return row

    def signals(self, event_id, limit=50):
        with self.pool.connection() as conn:
            rows = conn.execute(
                "SELECT payload FROM signals WHERE event_id = %s ORDER BY ts DESC LIMIT %s",
                (event_id, limit),
            ).fetchall()
        return [row[0] for row in rows]
