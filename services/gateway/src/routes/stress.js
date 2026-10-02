import { listStressRuns } from '../db/queries/stress.js';
import { runStress } from '../orchestration/stressTrigger.js';

const listQuery = {
  type: 'object',
  properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
};

const runBody = {
  type: 'object',
  required: ['scenario_id'],
  properties: { scenario_id: { type: 'string' } },
};

export default async function stressRoutes(app, ctx) {
  app.get('/v1/scenarios', () => ctx.quant.scenarios());
  app.get('/v1/portfolio', () => ctx.quant.portfolio());

  app.get('/v1/stress', { schema: { querystring: listQuery } }, async (req) => ({
    items: await listStressRuns(ctx.pool, req.query.limit),
  }));

  app.post('/v1/stress/run', { schema: { body: runBody } }, async (req, reply) => {
    try {
      return await runStress(ctx, req.body.scenario_id);
    } catch (err) {
      if (err.status === 404) return reply.code(404).send({ error: 'unknown scenario' });
      throw err;
    }
  });
}
