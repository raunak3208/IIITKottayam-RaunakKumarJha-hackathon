const list = (value, fallback) =>
  value ? value.split(',').map((v) => v.trim()).filter(Boolean) : fallback;

export const config = {
  port: Number(process.env.PORT ?? 3001),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  rawStream: 'raw.items',
  seenTtlSec: 86400,
  maxItemsPerPoll: 50,
  userAgent: 'riskpulse/0.1 (hackathon project)',
  rssIntervalMs: Number(process.env.RSS_INTERVAL_MS ?? 120000),
  redditIntervalMs: Number(process.env.REDDIT_INTERVAL_MS ?? 90000),
  rssFeeds: list(process.env.RSS_FEEDS, [
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    'https://www.cnbc.com/id/10000664/device/rss/rss.html',
    'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    'https://finance.yahoo.com/news/rssindex',
  ]),
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID ?? '',
    clientSecret: process.env.REDDIT_CLIENT_SECRET ?? '',
    subreddits: list(process.env.REDDIT_SUBREDDITS, [
      'stocks',
      'investing',
      'StockMarket',
      'wallstreetbets',
    ]),
  },
};
