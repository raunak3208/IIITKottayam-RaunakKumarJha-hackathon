import React from 'react';
import SignalFeed from './SignalFeed.jsx';
import { useMeta } from '../api/useMeta.js';

export default function LivePage({ signals, filters, setFilters }) {
  const meta = useMeta();
  const highImpact = signals.filter((s) => s.impact >= 7).length;
  const avgSentiment = signals.length
    ? signals.reduce((sum, s) => sum + s.sentiment, 0) / signals.length
    : 0;
  const update = (key, value) => setFilters({ ...filters, [key]: value });

  return (
    <>
      <section className="summary" aria-label="Summary">
        <div>
          <strong>{signals.length}</strong>
          <span>signals in view</span>
        </div>
        <div>
          <strong>{highImpact}</strong>
          <span>with impact 7 or above</span>
        </div>
        <div>
          <strong>{avgSentiment.toFixed(2)}</strong>
          <span>average sentiment</span>
        </div>
      </section>

      <div className="filters">
        <input
          placeholder="Ticker"
          value={filters.ticker}
          onChange={(e) => update('ticker', e.target.value.trim().toUpperCase())}
          aria-label="Ticker"
        />
        <select value={filters.eventType} onChange={(e) => update('eventType', e.target.value)} aria-label="Event type">
          <option value="">All event types</option>
          {meta?.event_types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          max="10"
          step="0.5"
          placeholder="Min impact"
          value={filters.minImpact}
          onChange={(e) => update('minImpact', e.target.value)}
          aria-label="Minimum impact"
        />
      </div>

      <SignalFeed signals={signals} />
    </>
  );
}
