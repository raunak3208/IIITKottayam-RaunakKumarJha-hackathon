import { getEvent, listEvents } from '../db/queries/events.js';

const listQuery = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
    min_sources: { type: 'integer', minimum: 1, default: 1 },
  },
};

export default async function eventRoutes(app, { pool, config, ai }) {
  app.get('/v1/events', { schema: { querystring: listQuery } }, async (req) => ({
    items: await listEvents(pool, {
      limit: req.query.limit,
      minSources: req.query.min_sources,
      windowHours: config.eventWindowHours,
    }),
  }));

  app.get('/v1/events/:id', async (req, reply) => {
    const event = await getEvent(pool, req.params.id, config.eventWindowHours);
    if (!event) return reply.code(404).send({ error: 'unknown event' });
    return event;
  });

  app.post('/v1/events/:id/investigate', async (req, reply) => {
    try {
      return await ai.investigate(req.params.id);
    } catch (err) {
      if (err.status === 404) return reply.code(404).send({ error: 'unknown event' });
      return reply.code(502).send({ error: 'investigation unavailable' });
    }
  });
}
