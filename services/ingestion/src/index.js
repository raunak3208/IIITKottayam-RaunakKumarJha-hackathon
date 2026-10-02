import http from 'node:http';
import Redis from 'ioredis';
import { config } from './config.js';
import { pollRss } from './connectors/rss.js';
import { pollReddit } from './connectors/reddit.js';
import { normalizeItem } from './normalize/normalize.js';
import { publishIfNew } from './queue/streams.js';

const redis = new Redis(config.redisUrl);

const connectors = [
  { name: 'rss', intervalMs: config.rssIntervalMs, poll: pollRss },
  { name: 'reddit', intervalMs: config.redditIntervalMs, poll: pollReddit },
];

const status = {};

async function run(connector) {
  const lastRun = new Date().toISOString();
  try {
    const items = await connector.poll();
    let published = 0;
    for (const raw of items) {
      const item = normalizeItem(raw);
      if (item && (await publishIfNew(redis, item))) published += 1;
    }
    status[connector.name] = { lastRun, fetched: items.length, published, error: null };
  } catch (err) {
    status[connector.name] = { ...status[connector.name], lastRun, error: err.message };
    console.error(`${connector.name}: ${err.message}`);
  }
}

for (const connector of connectors) {
  run(connector);
  setInterval(() => run(connector), connector.intervalMs);
}

const server = http.createServer(async (req, res) => {
  if (req.url !== '/health') {
    res.writeHead(404).end();
    return;
  }
  const ok = (await redis.ping().catch(() => null)) === 'PONG';
  res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: ok ? 'ok' : 'degraded', connectors: status }));
});

server.listen(config.port, () => console.log(`ingestion listening on ${config.port}`));
