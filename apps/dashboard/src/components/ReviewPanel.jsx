import React, { useCallback, useEffect, useState } from 'react';
import { get, post } from '../api/http.js';
import { useMeta } from '../api/useMeta.js';

const sentimentLabel = (value) =>
  value === undefined || value === null ? 'neutral' : value > 0.15 ? 'positive' : value < -0.15 ? 'negative' : 'neutral';

function ReviewItem({ item, meta, onDone }) {
  const [eventType, setEventType] = useState(item.suggestion?.event_type ?? 'Other');
  const [sentiment, setSentiment] = useState(sentimentLabel(item.suggestion?.sentiment));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(path, body) {
    setBusy(true);
    setError('');
    try {
      onDone(await post(path, { list: item.list, id: item.id, ...body }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <article className="review-item">
      <p>{item.text}</p>
      <p className="muted">
        {item.source_name ?? item.origin} - {new Date(item.timestamp).toLocaleString()}
        {item.tickers.length > 0 && ` - ${item.tickers.join(', ')}`}
        {item.url && (
          <>
            {' - '}
            <a href={item.url} target="_blank" rel="noreferrer">
              source
            </a>
          </>
        )}
      </p>
      {item.reason && <p className="muted">Sent for review: {item.reason}</p>}
      <div className="controls">
        <select value={eventType} onChange={(e) => setEventType(e.target.value)} aria-label="Event type">
          {meta.event_types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={sentiment} onChange={(e) => setSentiment(e.target.value)} aria-label="Sentiment">
          {meta.sentiment_labels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button disabled={busy} onClick={() => act('/v1/review/resolve', { event_type: eventType, sentiment_label: sentiment })}>
          Save label
        </button>
        <button className="secondary" disabled={busy} onClick={() => act('/v1/review/skip', {})}>
          Skip
        </button>
      </div>
      {error && <p className="neg-text">{error}</p>}
    </article>
  );
}

export default function ReviewPanel() {
  const meta = useMeta();
  const [list, setList] = useState('queue');
  const [items, setItems] = useState([]);
  const [gold, setGold] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const body = await get(`/v1/review?list=${list}&limit=10`);
      setItems(body.items);
      setGold(body.gold);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [list]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <section aria-label="Review and labeling">
      <div className="panel-head">
        <h2>Review and labeling</h2>
        <div className="controls">
          <button className={list === 'queue' ? '' : 'secondary'} onClick={() => setList('queue')}>
            Needs review
          </button>
          <button className={list === 'recent' ? '' : 'secondary'} onClick={() => setList('recent')}>
            Recent items
          </button>
        </div>
      </div>
      <p className="muted">
        {list === 'queue'
          ? 'Items the system declined to score on its own, for example when the LLM and the second opinion disagreed.'
          : 'Latest collected items. Label them to build the gold set used for training and evaluation.'}{' '}
        Saved labels are appended to the gold set file.
      </p>
      {gold && (
        <p>
          Gold set: <strong>{gold.count}</strong> labelled
          {Object.keys(gold.by_type).length > 0 &&
            ` (${Object.entries(gold.by_type).map(([t, n]) => `${t} ${n}`).join(', ')})`}
        </p>
      )}
      {error && <p className="neg-text">{error}</p>}
      {meta && items.length === 0 && <p className="empty">Nothing to review here right now.</p>}
      {meta &&
        items.map((item) => (
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
    </section>
  );
}
