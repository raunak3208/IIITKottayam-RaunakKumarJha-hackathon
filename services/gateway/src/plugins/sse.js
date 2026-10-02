export function createHub() {
  const clients = new Set();

  return {
    add(res) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
    broadcast(event, data) {
      const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of clients) res.write(frame);
    },
    heartbeat() {
      for (const res of clients) res.write(': ping\n\n');
    },
    size: () => clients.size,
  };
}
