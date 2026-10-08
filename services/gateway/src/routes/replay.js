import { sendError } from '../orchestration/http.js';

export default async function replayRoutes(app, { replay }) {
  app.get('/v1/replay', async () => ({ files: await replay.list(), state: replay.state() }));

  app.post(
    '/v1/replay/record',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            limit: { type: 'integer', minimum: 5, maximum: 2000, default: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return await replay.record(req.body.name, req.body.limit);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  app.post(
    '/v1/replay/start',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            speed: { type: 'number', minimum: 0.5, maximum: 100, default: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        await replay.start(req.body.name, req.body.speed);
        return replay.state();
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  app.post('/v1/replay/stop', async () => {
    replay.stop();
    return replay.state();
  });
}
