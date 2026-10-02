import { config } from '../config.js';

export async function publishIfNew(redis, item) {
  const fresh = await redis.set(`seen:${item.item_id}`, '1', 'EX', config.seenTtlSec, 'NX');
  if (!fresh) return false;
  await redis.xadd(config.rawStream, 'MAXLEN', '~', 50000, '*', 'data', JSON.stringify(item));
  return true;
}
