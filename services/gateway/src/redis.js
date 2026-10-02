import Redis from 'ioredis';

export const createRedis = (url) => new Redis(url, { maxRetriesPerRequest: null });
