export default async function healthRoutes(app, { redis, pool, hub }) {
  app.get('/health', async (req, reply) => {
    const checks = {};

    try {
      checks.redis = (await redis.ping()) === 'PONG' ? 'ok' : 'fail';
    } catch {
      checks.redis = 'fail';
    }

    try {
      await pool.query('SELECT 1');
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'fail';
    }

    const ok = Object.values(checks).every((v) => v === 'ok');
    return reply
      .code(ok ? 200 : 503)
      .send({ status: ok ? 'ok' : 'degraded', checks, sse_clients: hub.size() });
  });
}
