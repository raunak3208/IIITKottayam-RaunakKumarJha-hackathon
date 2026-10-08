import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sendError } from '../orchestration/http.js';

export default async function adminRoutes(app, { ai, config }) {
  app.get('/v1/jobs', async (req, reply) => {
    try {
      return await ai.jobs();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/v1/jobs/:name', async (req, reply) => {
    try {
      return await ai.startJob(req.params.name);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  async function sendResult(reply, file, type) {
    try {
      const body = await readFile(join(config.resultsDir, file), 'utf8');
      return reply.type(type).send(body);
    } catch {
      return reply.code(404).send({ error: 'no results yet, run the evaluation first' });
    }
  }

  app.get('/v1/results/summary', (req, reply) => sendResult(reply, 'summary.json', 'application/json'));
  app.get('/v1/results/report', (req, reply) => sendResult(reply, 'report.html', 'text/html'));
}
