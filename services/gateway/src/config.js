import { existsSync } from 'node:fs';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://riskpulse:riskpulse@localhost:5432/riskpulse',
  contractsDir:
    process.env.CONTRACTS_DIR ?? new URL('../../../contracts', import.meta.url).pathname,
  aiUrl: process.env.AI_URL ?? 'http://localhost:8000',
  stressMinSources: Number(process.env.STRESS_MIN_SOURCES ?? 2),
  quantUrl: process.env.QUANT_URL ?? 'http://localhost:8001',
  eventWindowHours: Number(process.env.CLUSTER_WINDOW_HOURS ?? 48),
  stressCooldownSec: Number(process.env.STRESS_COOLDOWN_SEC ?? 300),
  ingestionUrl: process.env.INGESTION_URL ?? 'http://localhost:3001',
  goldPath: process.env.GOLD_PATH ?? new URL('../../../data/gold/gold_events.jsonl', import.meta.url).pathname,
  replayDir: process.env.REPLAY_DIR ?? new URL('../../../data/replay', import.meta.url).pathname,
  resultsDir:
    process.env.RESULTS_DIR ??
    (existsSync('/srv/eval/results')
      ? '/srv/eval/results'
      : new URL('../../../eval/results', import.meta.url).pathname),
  rawStream: 'raw.items',
  rawDlq: 'raw.dlq',
  reviewStream: 'review.queue',
  signalStream: 'signals.v1',
  dlqStream: 'signals.dlq',
  consumerGroup: 'gateway',
};
