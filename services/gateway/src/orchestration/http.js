export async function probe(url, timeoutMs = 3000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const body = await res.json().catch(() => null);
    return { reachable: true, ok: res.ok, status: res.status, body };
  } catch {
    return { reachable: false, ok: false, status: 0, body: null };
  }
}

export async function call(url, { method = 'GET', body, timeoutMs = 10000 } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const err = new Error(`${url} returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const fail = (status, message) => Object.assign(new Error(message), { status });

export function sendError(reply, err) {
  const status = [400, 404, 409, 422].includes(err.status) ? err.status : 502;
  return reply.code(status).send({ error: status === 502 ? 'upstream service unavailable' : err.message });
}
