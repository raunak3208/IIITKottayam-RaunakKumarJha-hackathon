import { probe, sendError } from '../orchestration/http.js';

const toObject = (flat) => {
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
};

async function groupInfo(redis, stream, name) {
  try {
    const groups = await redis.xinfo('GROUPS', stream);
    return groups.map(toObject).find((g) => g.name === name) ?? null;
  } catch {
    return null;
  }
}

const length = (redis, stream) => redis.xlen(stream).catch(() => 0);

export default async function systemRoutes(app, ctx) {
  const { redis, pool, hub, config, ai, ingestion } = ctx;
  const dlqStreams = { raw: config.rawDlq, signals: config.dlqStream };
  const dlqTargets = { raw: config.rawStream, signals: config.signalStream };

  app.get('/v1/meta', () => ctx.meta);

  app.get('/v1/system', async () => {
    const [aiHealth, aiStats, aiDrift, ingestionHealth, quantHealth, checks] = await Promise.all([
      probe(`${ai.baseUrl}/health`),
      probe(`${ai.baseUrl}/v1/stats`),
      probe(`${ai.baseUrl}/v1/drift`),
      probe(`${ingestion.baseUrl}/health`),
      probe(`${config.quantUrl}/health`),
      Promise.all([
        redis.ping().then((r) => r === 'PONG').catch(() => false),
        pool.query('SELECT 1').then(() => true).catch(() => false),
      ]),
    ]);
    const group = await groupInfo(redis, config.rawStream, 'ai');

    return {
      services: {
        gateway: { ok: checks[0] && checks[1], redis: checks[0], postgres: checks[1], sse_clients: hub.size() },
        ai: { reachable: aiHealth.reachable, ok: aiHealth.ok, ...(aiHealth.body ?? {}) },
        ingestion: {
          reachable: ingestionHealth.reachable,
          ok: ingestionHealth.ok,
          connectors: ingestionHealth.body?.connectors ?? {},
          disabled: ingestionHealth.body?.disabled ?? [],
        },
        quant: { reachable: quantHealth.reachable, ok: quantHealth.ok },
      },
      streams: {
        raw_items: await length(redis, config.rawStream),
        raw_backlog: group ? (group.lag ?? 0) + group.pending : null,
        raw_dlq: await length(redis, config.rawDlq),
        signals_dlq: await length(redis, config.dlqStream),
        review_queue: await length(redis, config.reviewStream),
      },
      stats: aiStats.ok ? aiStats.body : null,
      drift: aiDrift.ok ? aiDrift.body : null,
    };
  });

  app.get('/v1/chaos', async () => {
    const [llm, sources] = await Promise.allSettled([ai.chaos(), ingestion.chaos()]);
    const disabled = sources.status === 'fulfilled' ? sources.value.disabled : null;
    return {
      llm_down: llm.status === 'fulfilled' ? llm.value.llm_down : null,
      sources: {
        rss: disabled ? disabled.includes('rss') : null,
        reddit: disabled ? disabled.includes('reddit') : null,
      },
    };
  });

  app.post(
    '/v1/chaos',
    {
      schema: {
        body: {
          type: 'object',
          required: ['target', 'down'],
          properties: {
            target: { type: 'string', enum: ['llm', 'rss', 'reddit'] },
            down: { type: 'boolean' },
          },
        },
      },
    },
    async (req, reply) => {
      const { target, down } = req.body;
      try {
        if (target === 'llm') await ai.setChaos(down);
        else await ingestion.setChaos(target, down);
        return { target, down };
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  app.get(
    '/v1/dlq',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: { stream: { type: 'string', enum: ['raw', 'signals'], default: 'raw' } },
        },
      },
    },
    async (req) => {
      const rows = await redis.xrevrange(dlqStreams[req.query.stream], '+', '-', 'COUNT', 20);
      return {
        items: rows.map(([id, flat]) => {
          const fields = toObject(flat);
          return { id, reason: String(fields.reason ?? '').slice(0, 300), data: String(fields.data ?? '').slice(0, 300) };
        }),
      };
    },
  );

  app.post(
    '/v1/dlq/replay',
    {
      schema: {
        body: {
          type: 'object',
          required: ['stream'],
          properties: { stream: { type: 'string', enum: ['raw', 'signals'] } },
        },
      },
    },
    async (req) => {
      const source = dlqStreams[req.body.stream];
      const target = dlqTargets[req.body.stream];
      const rows = await redis.xrange(source, '-', '+', 'COUNT', 500);
      let replayed = 0;
      let discarded = 0;
      for (const [id, flat] of rows) {
        const { data } = toObject(flat);
        if (data) {
          await redis.xadd(target, '*', 'data', data);
          replayed += 1;
        } else {
          discarded += 1;
        }
        await redis.xdel(source, id);
      }
      return { replayed, discarded };
    },
  );
}
