import http from 'node:http';
import Redis from 'ioredis';
import { config } from './config.js';
import { pollRss } from './connectors/rss.js';
import { pollReddit } from './connectors/reddit.js';
import { normalizeItem } from './normalize/normalize.js';
import { publishIfNew } from './queue/streams.js';

const redis = new Redis(config.redisUrl);

const MAX_BACKOFF = 8;

const connectors = [
  { name: 'rss', intervalMs: config.rssIntervalMs, poll: pollRss },
  { name: 'reddit', intervalMs: config.redditIntervalMs, poll: pollReddit },
];

const status = {};
const timers = {};
const disabled = new Set();

async function run(connector) {
  clearTimeout(timers[connector.name]);
  const lastRun = new Date().toISOString();
  const failures = status[connector.name]?.failures ?? 0;

  try {
    if (disabled.has(connector.name)) throw new Error('source disabled by fault injection');
    const items = await connector.poll();
    let published = 0;
    for (const raw of items) {
      const item = normalizeItem(raw);
      if (item && (await publishIfNew(redis, item))) published += 1;
    }
    status[connector.name] = { lastRun, fetched: items.length, published, failures: 0, error: null };
  } catch (err) {
    status[connector.name] = { lastRun, failures: failures + 1, error: err.message };
    console.error(`${connector.name}: ${err.message}`);
  }

  const backoff = Math.min(2 ** status[connector.name].failures, MAX_BACKOFF);
  timers[connector.name] = setTimeout(() => run(connector), connector.intervalMs * backoff);
}

for (const connector of connectors) run(connector);

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
  });

const send = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    const ok = (await redis.ping().catch(() => null)) === 'PONG';
    return send(res, ok ? 200 : 503, {
      status: ok ? 'ok' : 'degraded',
      connectors: status,
      disabled: [...disabled],
    });
  }

  if (req.url === '/chaos' && req.method === 'GET') return send(res, 200, { disabled: [...disabled] });

  if (req.url === '/chaos' && req.method === 'POST') {
    try {
      const { connector, down } = await readBody(req);
      const target = connectors.find((c) => c.name === connector);
      if (!target || typeof down !== 'boolean') return send(res, 400, { error: 'invalid request' });
      if (down) disabled.add(connector);
      else {
        disabled.delete(connector);
        run(target);
      }
      return send(res, 200, { disabled: [...disabled] });
    } catch {
      return send(res, 400, { error: 'invalid request' });
    }
  }

  res.writeHead(404).end();
});

server.listen(config.port, () => console.log(`ingestion listening on ${config.port}`));
