import { useEffect, useRef, useState } from 'react';
import { get } from './http.js';

const MAX_ITEMS = 200;

const matches = (signal, f) =>
  (!f.ticker || signal.tickers.includes(f.ticker)) &&
  (!f.eventType || signal.event_type === f.eventType) &&
  signal.impact >= (Number(f.minImpact) || 0);

function query(f) {
  const params = new URLSearchParams({ limit: '100' });
  if (f.ticker) params.set('ticker', f.ticker);
  if (f.eventType) params.set('event_type', f.eventType);
  if (f.minImpact) params.set('min_impact', f.minImpact);
  return params.toString();
}

export function useLiveFeed(filters) {
  const [signals, setSignals] = useState([]);
  const [stress, setStress] = useState(null);
  const [status, setStatus] = useState('connecting');
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    let cancelled = false;
    get(`/v1/signals?${query(filters)}`)
      .then((body) => {
        if (!cancelled) setSignals(body.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filters.ticker, filters.eventType, filters.minImpact]);

  useEffect(() => {
    let cancelled = false;
    get('/v1/stress?limit=1')
      .then((body) => {
        if (!cancelled) setStress((prev) => prev ?? body.items[0] ?? null);
      })
      .catch(() => {});

    const source = new EventSource('/v1/signals/stream');
    source.onopen = () => setStatus('live');
    source.onerror = () => setStatus('reconnecting');
    source.addEventListener('signal', (event) => {
      const signal = JSON.parse(event.data);
      if (!matches(signal, filtersRef.current)) return;
      setSignals((prev) =>
        [signal, ...prev.filter((s) => s.signal_id !== signal.signal_id)].slice(0, MAX_ITEMS),
      );
    });
    source.addEventListener('stress', (event) => setStress(JSON.parse(event.data)));

    return () => {
      cancelled = true;
      source.close();
    };
  }, []);

  return { signals, stress, setStress, status };
}
