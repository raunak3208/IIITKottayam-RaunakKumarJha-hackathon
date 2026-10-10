CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS signals (
  signal_id   UUID PRIMARY KEY,
  event_id    TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL,
  source      TEXT NOT NULL,
  tickers     TEXT[] NOT NULL,
  sentiment   REAL NOT NULL,
  event_type  TEXT NOT NULL,
  impact      REAL NOT NULL,
  confidence  REAL NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signals_ts_idx     ON signals (ts DESC);
CREATE INDEX IF NOT EXISTS signals_event_idx  ON signals (event_id);
CREATE INDEX IF NOT EXISTS signals_type_idx   ON signals (event_type);
CREATE INDEX IF NOT EXISTS signals_tickers_idx ON signals USING GIN (tickers);

CREATE TABLE IF NOT EXISTS events (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  type_conf     REAL NOT NULL DEFAULT 1.0,
  tickers       TEXT[] NOT NULL DEFAULT '{}',
  centroid      vector(384),
  first_seen    TIMESTAMPTZ NOT NULL,
  last_seen     TIMESTAMPTZ NOT NULL,
  signal_count  INTEGER NOT NULL DEFAULT 1,
  sources       TEXT[] NOT NULL DEFAULT '{}',
  impact        REAL NOT NULL DEFAULT 0,
  sentiment     REAL NOT NULL DEFAULT 0,
  confidence    REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS events_last_seen_idx ON events (last_seen DESC);
CREATE INDEX IF NOT EXISTS events_type_idx      ON events (event_type);
CREATE INDEX IF NOT EXISTS events_centroid_idx  ON events USING hnsw (centroid vector_cosine_ops);

CREATE TABLE IF NOT EXISTS stress_runs (
  run_id      UUID PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL,
  scenario_id TEXT NOT NULL,
  event_type  TEXT,
  payload     JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS stress_runs_ts_idx ON stress_runs (ts DESC);
