import Parser from 'rss-parser';
import { config } from '../config.js';

const parser = new Parser({ timeout: 15000, headers: { 'User-Agent': config.userAgent } });

export async function pollRss() {
  const items = [];

  for (const url of config.rssFeeds) {
    try {
      const feed = await parser.parseURL(url);
      const sourceName = feed.title ?? new URL(url).hostname;
      for (const entry of feed.items.slice(0, config.maxItemsPerPoll)) {
        items.push({
          source: 'news',
          sourceName,
          url: entry.link,
          timestamp: entry.isoDate ?? entry.pubDate,
          text: `${entry.title ?? ''}. ${entry.contentSnippet ?? entry.content ?? ''}`,
        });
      }
    } catch (err) {
      console.error(`rss ${url}: ${err.message}`);
    }
  }

  return items;
}
