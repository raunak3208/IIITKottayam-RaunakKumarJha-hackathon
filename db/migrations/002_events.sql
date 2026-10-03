CREATE TABLE IF NOT EXISTS events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  type_conf    REAL NOT NULL,
  tickers      TEXT[] NOT NULL,
  centroid     vector(384) NOT NULL,
  first_seen   TIMESTAMPTZ NOT NULL,
  last_seen    TIMESTAMPTZ NOT NULL,
  signal_count INTEGER NOT NULL,
  sources      TEXT[] NOT NULL,
  impact       REAL NOT NULL,
  sentiment    REAL NOT NULL,
  confidence   REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS events_last_seen_idx ON events (last_seen DESC);
CREATE INDEX IF NOT EXISTS events_centroid_idx ON events USING hnsw (centroid vector_cosine_ops);
