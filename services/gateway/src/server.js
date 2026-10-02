import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { createRedis } from './redis.js';
import { createPool } from './db/pool.js';
import { loadValidator } from './contracts.js';
import { createHub } from './plugins/sse.js';
import { startSignalConsumer } from './consumers/signalConsumer.js';
import healthRoutes from './routes/health.js';
import signalRoutes from './routes/signals.js';
import stressRoutes from './routes/stress.js';
import { createQuantClient } from './orchestration/quantClient.js';
import { maybeTrigger } from './orchestration/stressTrigger.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const ctx = {
  config,
  log: app.log,
  redis: createRedis(config.redisUrl),
  pool: createPool(config.databaseUrl),
  hub: createHub(),
  validateSignal: loadValidator(config.contractsDir, 'signal'),
  quant: createQuantClient(config.quantUrl),
};
ctx.trigger = (signal) => maybeTrigger(ctx, signal);

await app.register(healthRoutes, ctx);
await app.register(signalRoutes, ctx);
await app.register(stressRoutes, ctx);

setInterval(() => ctx.hub.heartbeat(), 15000).unref();

startSignalConsumer(ctx).catch((err) => {
  app.log.error(err, 'signal consumer stopped');
  process.exit(1);
});

await app.listen({ port: config.port, host: '0.0.0.0' });
