import { fail, sendError } from '../orchestration/http.js';

const RESOLVED = 'review:resolved';

const toObject = (flat) => {
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
};

export default async function reviewRoutes(app, { redis, config, gold, meta }) {
  const streams = { queue: config.reviewStream, recent: config.rawStream };

  function describe(list, id, flat) {
    const payload = JSON.parse(toObject(flat).data);
    const item = list === 'queue' ? payload.item : payload;
    return {
      id,
      list,
      text: item.text,
      timestamp: item.timestamp,
      origin: item.source,
      source_name: item.source_name ?? null,
      url: item.url ?? null,
      tickers: payload.tickers ?? [],
      suggestion: list === 'queue' ? payload.tier1 : null,
      reason: list === 'queue' ? payload.reason : null,
    };
  }

  app.get(
    '/v1/review',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            list: { type: 'string', enum: ['queue', 'recent'], default: 'queue' },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 15 },
          },
        },
      },
    },
    async (req) => {
      const { list, limit } = req.query;
      const rows = await redis.xrevrange(streams[list], '+', '-', 'COUNT', limit * 4);
      const done = rows.length ? await redis.smismember(RESOLVED, ...rows.map(([id]) => `${list}:${id}`)) : [];
      const items = rows
        .filter((_, i) => !done[i])
        .slice(0, limit)
        .map(([id, flat]) => describe(list, id, flat));
      return { items, gold: await gold.stats() };
    },
  );

  const resolveBody = {
    type: 'object',
    required: ['list', 'id'],
    properties: {
      list: { type: 'string', enum: ['queue', 'recent'] },
      id: { type: 'string' },
      event_type: { type: 'string' },
      sentiment_label: { type: 'string' },
    },
  };

  async function entry(list, id) {
    const rows = await redis.xrange(streams[list], id, id);
    if (!rows.length) throw fail(404, 'item no longer in the stream');
    return describe(list, rows[0][0], rows[0][1]);
  }

  app.post('/v1/review/resolve', { schema: { body: resolveBody } }, async (req, reply) => {
    const { list, id, event_type: eventType, sentiment_label: sentiment } = req.body;
    try {
      if (!meta.event_types.includes(eventType)) throw fail(400, 'unknown event type');
      if (!meta.sentiment_labels.includes(sentiment)) throw fail(400, 'unknown sentiment label');
      const item = await entry(list, id);
      await gold.append({
        id: `analyst-${id}`,
        date: String(item.timestamp).slice(0, 10),
        source: item.origin,
        text: item.text,
        tickers: item.tickers,
        sentiment_label: sentiment,
        event_type: eventType,
        labeler: 'analyst',
      });
      await redis.sadd(RESOLVED, `${list}:${id}`);
      return { saved: true, gold: await gold.stats() };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post(
    '/v1/review/skip',
    { schema: { body: { type: 'object', required: ['list', 'id'], properties: resolveBody.properties } } },
    async (req) => {
      await redis.sadd(RESOLVED, `${req.body.list}:${req.body.id}`);
      return { skipped: true };
    },
  );
}
