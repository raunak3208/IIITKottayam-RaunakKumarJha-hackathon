import { appendFile, readFile } from 'node:fs/promises';

export function createGoldStore(path) {
  return {
    async append(row) {
      await appendFile(path, JSON.stringify(row) + '\n');
    },
    async stats() {
      let text;
      try {
        text = await readFile(path, 'utf8');
      } catch {
        return { count: 0, by_type: {} };
      }
      const byType = {};
      let count = 0;
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line);
          byType[row.event_type] = (byType[row.event_type] ?? 0) + 1;
          count += 1;
        } catch {
          continue;
        }
      }
      return { count, by_type: byType };
    },
  };
}
