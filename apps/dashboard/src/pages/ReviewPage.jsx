import React, { useCallback, useEffect, useState } from 'react';
import { EmptyState, ErrorState, Pill } from '../components/ui.jsx';
import { useToast } from '../api/toast.jsx';

const sentLbl = (v) => v === undefined || v === null ? 'neutral' : v > 0.15 ? 'positive' : v < -0.15 ? 'negative' : 'neutral';

function GoldProgress({ gold }) {
  if (!gold) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">Gold set progress</span>
        <span className="card-muted">{gold.count} labelled</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(gold.by_type).map(([t, n]) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Pill status="neutral">{t}</Pill>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewItem({ item, meta, onDone }) {
  const [eventType, setEventType] = useState(item.suggestion?.event_type ?? 'Other');
  const [sentiment, setSentiment] = useState(sentLbl(item.suggestion?.sentiment));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  async function act(path, body) {
    setBusy(true); setError('');
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ list: item.list, id: item.id, ...body }) });
      if (!r.ok) throw new Error(`${r.status}`);
      onDone(await r.json());
      toast('Label saved.');
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <div className="review-item">
      <p className="review-text">{item.text}</p>
      <p className="muted">
        {item.source_name ?? item.origin} &middot; {new Date(item.timestamp).toLocaleString()}
        {item.tickers?.length > 0 && ` · ${item.tickers.join(', ')}`}
        {item.url && <> &middot; <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>source</a></>}
      </p>
      {item.reason && <p className="muted small">Sent for review: {item.reason}</p>}
      <div className="review-actions">
        <select value={eventType} onChange={(e) => setEventType(e.target.value)} aria-label="Event type" style={{ flex: 1, maxWidth: 200 }}>
          {meta.event_types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={sentiment} onChange={(e) => setSentiment(e.target.value)} aria-label="Sentiment">
          {meta.sentiment_labels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="btn-primary btn btn-sm" disabled={busy} onClick={() => act('/v1/review/resolve', { event_type: eventType, sentiment_label: sentiment })}>
          Save label
        </button>
        <button className="btn btn-sm" disabled={busy} onClick={() => act('/v1/review/skip', {})}>
          Skip
        </button>
      </div>
      {error && <div className="error-state" style={{ fontSize: 12 }}>{error}</div>}
    </div>
  );
}

export default function ReviewPage({ meta }) {
  const [list, setList] = useState('queue');
  const [items, setItems] = useState([]);
  const [gold, setGold] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`/v1/review?list=${list}&limit=10`);
      const body = await r.json();
      setItems(body.items ?? []);
      setGold(body.gold);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [list]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const isQueue = list === 'queue';

  return (
    <>
      <div className="page-header">
        <h1>Review &amp; labeling</h1>
        <div className="page-header-actions">
          <button className={`btn ${isQueue ? 'btn-primary' : ''}`} onClick={() => setList('queue')}>Needs review</button>
          <button className={`btn ${!isQueue ? 'btn-primary' : ''}`} onClick={() => setList('recent')}>Recent items</button>
        </div>
      </div>

      <p className="muted">
        {isQueue
          ? 'Items the system declined to score on its own — e.g. when the LLM and classifier disagreed. Label them and they go into the gold set.'
          : 'Latest collected items. Label them to grow the gold set used for training and evaluation.'}
      </p>

      <GoldProgress gold={gold} />
      {error && <ErrorState msg={error} />}
      {!loading && meta && items.length === 0 && (
        <EmptyState
          title="Nothing to review right now"
          hint={isQueue ? 'All items have been labelled or skipped. Items arrive here when the system is uncertain.' : 'No recent items have been collected yet. Check the Ingestion connectors in System.'}
        />
      )}
      {meta && items.map((item) => (
        <ReviewItem
          key={`${item.list}:${item.id}`}
          item={item}
          meta={meta}
          onDone={(body) => {
            setItems((prev) => prev.filter((i) => i.id !== item.id));
            if (body.gold) setGold(body.gold);
          }}
        />
      ))}
    </>
  );
}
