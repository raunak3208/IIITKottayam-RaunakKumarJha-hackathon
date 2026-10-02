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

CREATE INDEX IF NOT EXISTS signals_ts_idx ON signals (ts DESC);
CREATE INDEX IF NOT EXISTS signals_event_idx ON signals (event_id);
CREATE INDEX IF NOT EXISTS signals_type_idx ON signals (event_type);
CREATE INDEX IF NOT EXISTS signals_tickers_idx ON signals USING GIN (tickers);

CREATE TABLE IF NOT EXISTS stress_runs (
  run_id      UUID PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL,
  scenario_id TEXT NOT NULL,
  event_type  TEXT,
  payload     JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS stress_runs_ts_idx ON stress_runs (ts DESC);
