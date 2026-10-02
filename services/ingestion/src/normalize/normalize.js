import { contentHash } from './hash.js';

const MIN_LENGTH = 30;
const MAX_LENGTH = 2000;

const clean = (text) =>
  (text ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export function normalizeItem(raw) {
  const text = clean(raw.text).slice(0, MAX_LENGTH);
  if (text.length < MIN_LENGTH) return null;

  const parsed = new Date(raw.timestamp);
  const timestamp = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  return {
    item_id: contentHash(text),
    timestamp: timestamp.toISOString(),
    source: raw.source,
    source_name: raw.sourceName,
    url: raw.url,
    text,
  };
}
