import { insertSignal } from '../db/queries/signals.js';

const BLOCK_MS = 5000;
const MAX_ATTEMPTS = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureGroup(redis, stream, group) {
  try {
    await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
  } catch (err) {
    if (!String(err.message).includes('BUSYGROUP')) throw err;
  }
}

async function toDlq({ redis, config }, id, reason, raw) {
  await redis.xadd(config.dlqStream, '*', 'reason', reason, 'source_id', id, 'data', raw ?? '');
  await redis.xack(config.signalStream, config.consumerGroup, id);
}

async function handle(ctx, id, fields) {
  const { redis, pool, hub, validateSignal, config, trigger, log } = ctx;
  const raw = fields[fields.indexOf('data') + 1];

  let signal;
  try {
    signal = JSON.parse(raw);
  } catch {
    return toDlq(ctx, id, 'invalid_json', raw);
  }

  if (!validateSignal(signal)) {
    return toDlq(ctx, id, JSON.stringify(validateSignal.errors), raw);
  }

  const inserted = await insertSignal(pool, signal);
  if (inserted) {
    hub.broadcast('signal', signal);
    trigger(signal).catch((err) => log.error(err, 'stress trigger failed'));
  }
  await redis.xack(config.signalStream, config.consumerGroup, id);
}

export async function startSignalConsumer(ctx) {
  const { config, log } = ctx;
  const redis = ctx.redis.duplicate();
  const consumer = `gateway-${process.pid}`;
  const failures = new Map();
  let readPending = true;

  await ensureGroup(redis, config.signalStream, config.consumerGroup);

  for (;;) {
    let response;
    try {
      response = await redis.xreadgroup(
        'GROUP', config.consumerGroup, consumer,
        'COUNT', 50,
        'BLOCK', BLOCK_MS,
        'STREAMS', config.signalStream, readPending ? '0' : '>',
      );
    } catch (err) {
      log.error(err, 'stream read failed');
      await sleep(1000);
      continue;
    }

    const entries = response ? response[0][1] : [];
    if (readPending && entries.length === 0) {
      readPending = false;
      continue;
    }

    for (const [id, fields] of entries) {
      try {
        await handle({ ...ctx, redis }, id, fields);
        failures.delete(id);
      } catch (err) {
        const attempts = (failures.get(id) ?? 0) + 1;
        failures.set(id, attempts);
        log.error(err, `signal ${id} failed (attempt ${attempts})`);
        if (attempts >= MAX_ATTEMPTS) {
          await toDlq({ redis, config }, id, `processing_failed: ${err.message}`);
          failures.delete(id);
        } else {
          readPending = true;
          await sleep(1000);
        }
      }
    }
  }
}
