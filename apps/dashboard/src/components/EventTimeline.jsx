import React, { useEffect, useState } from 'react';
import DossierView from './DossierView.jsx';

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour12: false });

export default function EventTimeline() {
  const [events, setEvents] = useState([]);
  const [dossier, setDossier] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/v1/events?limit=12')
        .then((res) => res.json())
        .then((body) => {
          if (!cancelled) setEvents(body.items);
        })
        .catch(() => {});

    load();
    const timer = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  async function investigate(id) {
    setBusy(id);
    setError('');
    try {
      const res = await fetch(`/v1/events/${id}/investigate`, { method: 'POST' });
      if (!res.ok) throw new Error(`request failed (${res.status})`);
      setDossier(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  if (!events.length) return <p className="empty">No events yet.</p>;

  return (
    <>
      {error && <p className="neg-text">{error}</p>}
      {dossier && <DossierView dossier={dossier} onClose={() => setDossier(null)} />}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Last seen</th>
              <th>Event</th>
              <th>Ticker</th>
              <th className="num">Signals</th>
              <th className="num">Sources</th>
              <th className="num">Impact</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.event_id}>
                <td>{time(e.last_seen)}</td>
                <td>{e.event_type}</td>
                <td>{e.tickers.length ? e.tickers.join(', ') : 'Market-wide'}</td>
                <td className="num">{e.signal_count}</td>
                <td className="num">{e.source_count}</td>
                <td className="num">{e.impact.toFixed(1)}</td>
                <td className="cap">{e.status}</td>
                <td>
                  <button onClick={() => investigate(e.event_id)} disabled={busy === e.event_id}>
                    {busy === e.event_id ? 'Working' : 'Investigate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
