import { config } from '../config.js';

let token = null;
let tokenExpiry = 0;

async function getToken() {
  const { clientId, clientSecret } = config.reddit;
  if (!clientId || !clientSecret) return null;
  if (token && Date.now() < tokenExpiry) return token;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'User-Agent': config.userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`reddit auth ${res.status}`);

  const body = await res.json();
  token = body.access_token;
  tokenExpiry = Date.now() + (body.expires_in - 60) * 1000;
  return token;
}

export async function pollReddit() {
  const bearer = await getToken();
  const base = bearer ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const suffix = bearer ? '' : '.json';
  const headers = { 'User-Agent': config.userAgent };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const items = [];
  for (const sub of config.reddit.subreddits) {
    try {
      const res = await fetch(
        `${base}/r/${sub}/new${suffix}?limit=${config.maxItemsPerPoll}&raw_json=1`,
        { headers },
      );
      if (!res.ok) throw new Error(`status ${res.status}`);

      const body = await res.json();
      for (const { data } of body.data.children) {
        if (data.stickied) continue;
        items.push({
          source: 'social',
          sourceName: `r/${sub}`,
          url: `https://www.reddit.com${data.permalink}`,
          timestamp: new Date(data.created_utc * 1000).toISOString(),
          text: `${data.title}. ${data.selftext ?? ''}`,
        });
      }
    } catch (err) {
      console.error(`reddit r/${sub}: ${err.message}`);
    }
  }

  return items;
}
