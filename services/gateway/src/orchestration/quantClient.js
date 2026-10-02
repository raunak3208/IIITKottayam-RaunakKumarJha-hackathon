export function createQuantClient(baseUrl) {
  async function request(path, options) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = new Error(`quant ${path} returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  return {
    scenarios: () => request('/v1/scenarios'),
    portfolio: () => request('/v1/portfolio'),
    stress: (scenarioId) =>
      request('/v1/stress', { method: 'POST', body: JSON.stringify({ scenario_id: scenarioId }) }),
  };
}
