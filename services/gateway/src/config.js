export const config = {
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://riskpulse:riskpulse@localhost:5432/riskpulse',
  contractsDir:
    process.env.CONTRACTS_DIR ?? new URL('../../../contracts', import.meta.url).pathname,
  quantUrl: process.env.QUANT_URL ?? 'http://localhost:8001',
  stressCooldownSec: Number(process.env.STRESS_COOLDOWN_SEC ?? 300),
  signalStream: 'signals.v1',
  dlqStream: 'signals.dlq',
  consumerGroup: 'gateway',
};
