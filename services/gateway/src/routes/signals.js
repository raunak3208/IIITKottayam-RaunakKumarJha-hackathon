import { listSignals } from '../db/queries/signals.js';

const listQuery = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 500, default: 50 },
    ticker: { type: 'string' },
    event_type: { type: 'string' },
    min_impact: { type: 'number' },
  },
};

export default async function signalRoutes(app, { redis, pool, hub, validateSignal, config }) {
  app.get('/v1/signals', { schema: { querystring: listQuery } }, async (req) => {
    const { limit, ticker, event_type: eventType, min_impact: minImpact } = req.query;
    return { items: await listSignals(pool, { limit, ticker, eventType, minImpact }) };
  });

  app.get('/v1/signals/stream', (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    reply.raw.write(': connected\n\n');
    hub.add(reply.raw);
  });

  app.post('/v1/signals', async (req, reply) => {
    if (!validateSignal(req.body)) {
      return reply.code(400).send({ errors: validateSignal.errors });
    }
    await redis.xadd(config.signalStream, '*', 'data', JSON.stringify(req.body));
    return reply.code(202).send({ accepted: true });
  });
}
