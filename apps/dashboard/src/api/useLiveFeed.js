import { useEffect, useRef, useState } from 'react';

const MAX = 200;
const matches = (s, f) =>
  (!f.ticker || s.tickers?.includes(f.ticker)) &&
  (!f.eventType || s.event_type === f.eventType) &&
  s.impact >= (Number(f.minImpact) || 0);

function qs(f) {
  const p = new URLSearchParams({ limit: '100' });
  if (f.ticker) p.set('ticker', f.ticker);
  if (f.eventType) p.set('event_type', f.eventType);
  if (f.minImpact) p.set('min_impact', f.minImpact);
  return p.toString();
}

export function useLiveFeed(filters) {
  const [signals, setSignals] = useState([]);
  const [stress, setStress] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [systemData, setSystemData] = useState(null);
  const fRef = useRef(filters);
  fRef.current = filters;

  useEffect(() => {
    let cancel = false;
    fetch(`/v1/signals?${qs(filters)}`)
      .then((r) => r.json())
      .then((b) => { if (!cancel) setSignals(b.items ?? []); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [filters.ticker, filters.eventType, filters.minImpact]);

  useEffect(() => {
    let cancel = false;
    fetch('/v1/stress?limit=1')
      .then((r) => r.json())
      .then((b) => { if (!cancel) setStress((p) => p ?? b.items?.[0] ?? null); })
      .catch(() => {});

    const pollSystem = () => fetch('/v1/system').then((r) => r.json()).then(setSystemData).catch(() => {});
    pollSystem();
    const sysTimer = setInterval(pollSystem, 8000);

    const es = new EventSource('/v1/signals/stream');
    es.onopen = () => setStatus('live');
    es.onerror = () => setStatus('reconnecting');
    es.addEventListener('signal', (e) => {
      const sig = JSON.parse(e.data);
      if (!matches(sig, fRef.current)) return;
      setSignals((prev) => [sig, ...prev.filter((s) => s.signal_id !== sig.signal_id)].slice(0, MAX));
    });
    es.addEventListener('stress', (e) => setStress(JSON.parse(e.data)));

    return () => { cancel = true; es.close(); clearInterval(sysTimer); };
  }, []);

  return { signals, stress, setStress, status, systemData };
}
