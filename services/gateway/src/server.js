import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
import eventRoutes from './routes/events.js';
import { createQuantClient } from './orchestration/quantClient.js';
import { createAiClient } from './orchestration/aiClient.js';
import { createIngestionClient } from './orchestration/ingestionClient.js';
import { createGoldStore } from './orchestration/goldStore.js';
import { createReplay } from './orchestration/replayRunner.js';
import systemRoutes from './routes/system.js';
import reviewRoutes from './routes/review.js';
import replayRoutes from './routes/replay.js';
import adminRoutes from './routes/admin.js';
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
  ai: createAiClient(config.aiUrl),
  ingestion: createIngestionClient(config.ingestionUrl),
  gold: createGoldStore(config.goldPath),
};
const signalSchema = JSON.parse(
  readFileSync(join(config.contractsDir, 'signal.v1.schema.json'), 'utf8'),
);
ctx.meta = {
  event_types: signalSchema.properties.event_type.enum,
  sentiment_labels: ['negative', 'neutral', 'positive'],
};
ctx.replay = createReplay({ redis: ctx.redis, dir: config.replayDir, rawStream: config.rawStream });
ctx.trigger = (signal) => maybeTrigger(ctx, signal);

await app.register(healthRoutes, ctx);
await app.register(signalRoutes, ctx);
await app.register(stressRoutes, ctx);
await app.register(eventRoutes, ctx);
await app.register(systemRoutes, ctx);
await app.register(reviewRoutes, ctx);
await app.register(replayRoutes, ctx);
await app.register(adminRoutes, ctx);

setInterval(() => ctx.hub.heartbeat(), 15000).unref();

startSignalConsumer(ctx).catch((err) => {
  app.log.error(err, 'signal consumer stopped');
  process.exit(1);
});

await app.listen({ port: config.port, host: '0.0.0.0' });
