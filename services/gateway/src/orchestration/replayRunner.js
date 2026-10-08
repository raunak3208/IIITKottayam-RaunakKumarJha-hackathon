import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from './http.js';

const NAME = /^[a-z0-9][a-z0-9_-]{0,60}$/i;
const MAX_GAP_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parseLines = (text) =>
  text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));

export function createReplay({ redis, dir, rawStream }) {
  const state = { running: false, file: null, speed: 1, sent: 0, total: 0, error: null };

  function pathFor(name) {
    if (!NAME.test(name ?? '')) throw fail(400, 'invalid replay name');
    return join(dir, `${name}.jsonl`);
  }

  async function read(name) {
    try {
      return parseLines(await readFile(pathFor(name), 'utf8'));
    } catch (err) {
      if (err.status) throw err;
      throw fail(404, 'replay file not found');
    }
  }

  async function list() {
    let names = [];
    try {
      names = (await readdir(dir)).filter((f) => f.endsWith('.jsonl') && NAME.test(f.slice(0, -6)));
    } catch {
      return [];
    }
    const files = [];
    for (const file of names) {
      const items = parseLines(await readFile(join(dir, file), 'utf8'));
      files.push({ name: file.slice(0, -6), items: items.length });
    }
    return files;
  }

  async function record(name, limit) {
    const path = pathFor(name);
    const rows = await redis.xrevrange(rawStream, '+', '-', 'COUNT', limit);
    const items = rows
      .map(([, fields]) => JSON.parse(fields[fields.indexOf('data') + 1]))
      .reverse();
    if (!items.length) throw fail(409, 'there are no collected items to record yet');
    await mkdir(dir, { recursive: true });
    await writeFile(path, items.map((item) => JSON.stringify(item)).join('\n') + '\n');
    return { name, items: items.length };
  }

  async function play(items, speed) {
    let previous = Date.parse(items[0].timestamp);
    for (const item of items) {
      if (!state.running) return;
      const current = Date.parse(item.timestamp);
      const gap = Math.min(Math.max(current - previous, 0) / speed, MAX_GAP_MS);
      previous = current;
      await sleep(gap);
      if (!state.running) return;
      const replayed = {
        ...item,
        item_id: randomUUID().replaceAll('-', ''),
        timestamp: new Date().toISOString(),
      };
      await redis.xadd(rawStream, 'MAXLEN', '~', 50000, '*', 'data', JSON.stringify(replayed));
      state.sent += 1;
    }
  }

  async function start(name, speed) {
    if (state.running) throw fail(409, 'a replay is already running');
    const items = await read(name);
    if (!items.length) throw fail(409, 'replay file is empty');
    Object.assign(state, { running: true, file: name, speed, sent: 0, total: items.length, error: null });
    play(items, speed)
      .catch((err) => {
        state.error = err.message;
      })
      .finally(() => {
        state.running = false;
      });
  }

  return {
    list,
    record,
    start,
    stop: () => {
      state.running = false;
    },
    state: () => ({ ...state }),
  };
}
