import { listStressRuns } from '../db/queries/stress.js';
import { sendError } from '../orchestration/http.js';
import { runStress } from '../orchestration/stressTrigger.js';

const listQuery = {
  type: 'object',
  properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
};

const factors = ['equity_pct', 'rate_bp', 'credit_spread_bp', 'fx_pct'];

const shocksSchema = {
  type: 'object',
  required: factors,
  properties: Object.fromEntries(factors.map((f) => [f, { type: 'number' }])),
};

const runBody = {
  type: 'object',
  required: ['scenario_id'],
  properties: {
    scenario_id: { type: 'string' },
    shocks: shocksSchema,
    tickers: { type: 'array', items: { type: 'string' } },
  },
};

export default async function stressRoutes(app, ctx) {
  app.get('/v1/scenarios', () => ctx.quant.scenarios());
  app.get('/v1/portfolio', () => ctx.quant.portfolio());

  app.get('/v1/stress', { schema: { querystring: listQuery } }, async (req) => ({
    items: await listStressRuns(ctx.pool, req.query.limit),
  }));

  app.post('/v1/stress/run', { schema: { body: runBody } }, async (req, reply) => {
    const { scenario_id: scenarioId, shocks, tickers } = req.body;
    try {
      return await runStress(ctx, scenarioId, null, { shocks, tickers });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post(
    '/v1/stress/sensitivity',
    { schema: { body: runBody } },
    async (req, reply) => {
      try {
        return await ctx.quant.sensitivity(req.body);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  app.post(
    '/v1/stress/reverse',
    {
      schema: {
        body: {
          type: 'object',
          required: ['scenario_id', 'target_loss_pct'],
          properties: {
            scenario_id: { type: 'string' },
            target_loss_pct: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
            tickers: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return await ctx.quant.reverse(req.body);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );
}
