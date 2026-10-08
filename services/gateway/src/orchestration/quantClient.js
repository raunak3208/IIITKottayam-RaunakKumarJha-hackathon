export function createQuantClient(baseUrl) {
  async function request(path, options) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      const err = new Error(typeof detail.detail === 'string' ? detail.detail : `quant ${path} returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  return {
    scenarios: () => request('/v1/scenarios'),
    portfolio: () => request('/v1/portfolio'),
    stress: (payload) => request('/v1/stress', { method: 'POST', body: JSON.stringify(payload) }),
    sensitivity: (payload) =>
      request('/v1/stress/sensitivity', { method: 'POST', body: JSON.stringify(payload) }),
    reverse: (payload) =>
      request('/v1/stress/reverse', { method: 'POST', body: JSON.stringify(payload) }),
  };
}
