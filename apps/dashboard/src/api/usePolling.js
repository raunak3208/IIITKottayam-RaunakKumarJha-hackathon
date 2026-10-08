import { useCallback, useEffect, useState } from 'react';
import { get } from './http.js';

export function usePolling(path, intervalMs) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await get(path));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [path]);

  useEffect(() => {
    load();
    const timer = setInterval(load, intervalMs);
    return () => clearInterval(timer);
  }, [load, intervalMs]);

  return { data, error, reload: load };
}
