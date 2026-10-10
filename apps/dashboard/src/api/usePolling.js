import { useCallback, useEffect, useRef, useState } from 'react';

export function usePolling(path, intervalMs) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async () => {
    try {
      const res = await fetch(pathRef.current);
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs, path]);

  return { data, error, loading, reload: load };
}
