import { createHash } from 'node:crypto';

export const contentHash = (text) =>
  createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
