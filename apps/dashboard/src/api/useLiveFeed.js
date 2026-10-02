import { useEffect, useState } from 'react';

const MAX_ITEMS = 200;

export function useLiveFeed() {
  const [signals, setSignals] = useState([]);
  const [stress, setStress] = useState(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    let cancelled = false;

    fetch('/v1/signals?limit=50')
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setSignals((prev) => (prev.length ? prev : body.items));
      })
      .catch(() => {});

    fetch('/v1/stress?limit=1')
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setStress((prev) => prev ?? body.items[0] ?? null);
      })
      .catch(() => {});

    const source = new EventSource('/v1/signals/stream');
    source.onopen = () => setStatus('live');
    source.onerror = () => setStatus('reconnecting');
    source.addEventListener('signal', (event) => {
      const signal = JSON.parse(event.data);
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
