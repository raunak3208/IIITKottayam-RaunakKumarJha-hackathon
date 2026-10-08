import { call } from './http.js';

export function createAiClient(baseUrl) {
  const url = (path) => `${baseUrl}${path}`;
  return {
    baseUrl,
    investigate: (eventId) =>
      call(url('/v1/investigate'), { method: 'POST', body: { event_id: eventId }, timeoutMs: 120000 }),
    chaos: () => call(url('/v1/chaos')),
    setChaos: (llmDown) => call(url('/v1/chaos'), { method: 'POST', body: { llm_down: llmDown } }),
    jobs: () => call(url('/v1/jobs')),
    startJob: (name) => call(url(`/v1/jobs/${name}`), { method: 'POST' }),
  };
}
