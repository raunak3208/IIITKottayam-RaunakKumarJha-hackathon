import Parser from 'rss-parser';
import { config } from '../config.js';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

let rateLimitedUntil = 0;
let oauthToken = null;
let tokenExpiresAt = 0;

async function getRedditToken() {
  if (oauthToken && Date.now() < tokenExpiresAt) return oauthToken;
  const auth = Buffer.from(`${config.reddit.clientId}:${config.reddit.clientSecret}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': config.userAgent || 'riskpulse/0.1',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`OAuth token failed: ${res.status}`);
  const data = await res.json();
  oauthToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return oauthToken;
}

async function pollViaOAuth(token) {
  const items = [];
  for (const sub of config.reddit.subreddits) {
    const url = `https://oauth.reddit.com/r/${sub}/new?limit=${config.maxItemsPerPoll}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': config.userAgent || 'riskpulse/0.1',
      },
    });
    if (!res.ok) continue;
    const data = await res.json();
    for (const post of data.data?.children ?? []) {
      const p = post.data;
      const text = `${p.title ?? ''}. ${p.selftext ?? ''}`.trim();
      if (!text || text === '.') continue;
      items.push({
        source: 'social',
        sourceName: `r/${sub}`,
        url: `https://reddit.com${p.permalink}`,
        timestamp: new Date(p.created_utc * 1000).toISOString(),
        text,
      });
    }
  }
  return items;
}

export async function pollReddit() {
  // If OAuth credentials exist, use official Reddit OAuth API
  if (config.reddit.clientId && config.reddit.clientSecret) {
    try {
      const token = await getRedditToken();
      return await pollViaOAuth(token);
    } catch (err) {
      console.warn(`[reddit] OAuth poll failed: ${err.message}`);
    }
  }

  // If public feed was previously rate-limited, skip quietly during cooldown
  if (Date.now() < rateLimitedUntil) {
    return [];
  }

  const items = [];
  let isRateLimited = false;

  for (const sub of config.reddit.subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/new/.rss`;
      const feed = await parser.parseURL(url);
      for (const entry of feed.items.slice(0, config.maxItemsPerPoll)) {
        const text = `${entry.title ?? ''}. ${entry.contentSnippet ?? entry.content ?? ''}`.trim();
        if (!text || text === '.') continue;
        items.push({
          source: 'social',
          sourceName: `r/${sub}`,
          url: entry.link,
          timestamp: entry.isoDate ?? entry.pubDate,
          text,
        });
      }
    } catch (err) {
      if (err.message?.includes('429')) {
        isRateLimited = true;
      } else {
        console.warn(`reddit r/${sub}: ${err.message}`);
      }
    }
  }

  if (isRateLimited) {
    rateLimitedUntil = Date.now() + 15 * 60 * 1000; // 15-minute cooldown
    console.log('[reddit] Public feed rate-limited (HTTP 429). Social polling paused for 15m; news wire RSS is active.');
  }

  return items;
}
