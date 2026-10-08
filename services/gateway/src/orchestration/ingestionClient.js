import { call } from './http.js';

export function createIngestionClient(baseUrl) {
  return {
    baseUrl,
    chaos: () => call(`${baseUrl}/chaos`),
    setChaos: (connector, down) =>
      call(`${baseUrl}/chaos`, { method: 'POST', body: { connector, down } }),
  };
}
