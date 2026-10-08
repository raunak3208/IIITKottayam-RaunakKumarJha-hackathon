export async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? detail.message ?? `request failed (${res.status})`);
  }
  return res.json();
}

export const get = (path) => request(path);
export const post = (path, body = {}) => request(path, { method: 'POST', body });
