import React, { useState } from 'react';
import { Drawer, EmptyState, ImpactBar, Pill, SentimentBar } from '../components/ui.jsx';
import { dtStr, sentimentLabel } from '../api/fmt.js';

const MARKET = { confirmed: 'Confirmed', unconfirmed: 'Unconfirmed', pending: 'Pending', not_applicable: '-' };

function SignalDrawer({ signal, onClose }) {
  return (
    <Drawer title="Signal detail" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="card-muted" style={{ marginBottom: 4 }}>Text</div>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{signal.text || signal.evidence_span?.text}</p>
        </div>
        <div className="card raised" style={{ padding: 12 }}>
          <div className="card-muted" style={{ marginBottom: 6 }}>Evidence span</div>
          <p style={{ fontSize: 13, fontStyle: 'italic' }}>"{signal.evidence_span?.text}"</p>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div><div className="card-muted">Sentiment</div><SentimentBar value={signal.sentiment} /></div>
          <div><div className="card-muted">Impact</div><ImpactBar value={signal.impact} /></div>
          <div><div className="card-muted">Confidence</div><span style={{ fontSize: 13 }}>{Math.round(signal.confidence * 100)}%</span></div>
        </div>
        <div>
          <div className="card-muted">Event type</div>
          <span style={{ fontSize: 13 }}>{signal.event_type}</span>
        </div>
        <div>
          <div className="card-muted">Tickers</div>
          <span style={{ fontSize: 13 }}>{signal.tickers?.length ? signal.tickers.join(', ') : 'Market-wide'}</span>
        </div>
        <div>
          <div className="card-muted">Market confirmation</div>
          <Pill status={signal.market_confirmation === 'confirmed' ? 'ok' : 'neutral'}>{MARKET[signal.market_confirmation] ?? '-'}</Pill>
        </div>
        <div>
          <div className="card-muted">Source</div>
          <div style={{ fontSize: 13 }}>
            {signal.source_name ?? signal.source}
            {signal.url && <> &nbsp;<a href={signal.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Open source</a></>}
          </div>
        </div>
        <div>
          <div className="card-muted">Timestamp</div>
          <span style={{ fontSize: 13 }}>{dtStr(signal.timestamp)}</span>
        </div>
      </div>
    </Drawer>
  );
}

export default function SignalsPage({ signals, filters, setFilters, meta }) {
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ col: null, asc: false });
  const update = (k, v) => setFilters({ ...filters, [k]: v });

  let rows = [...signals];
  if (sort.col) {
    rows.sort((a, b) => {
      const va = a[sort.col], vb = b[sort.col];
      return sort.asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }

  const toggleSort = (col) => setSort((s) => s.col === col ? { col, asc: !s.asc } : { col, asc: false });
  const sortIcon = (col) => sort.col !== col ? '' : sort.asc ? ' ↑' : ' ↓';

  return (
    <>
      {selected && <SignalDrawer signal={selected} onClose={() => setSelected(null)} />}
      <div className="page-header">
        <h1>Signals</h1>
        <span className="muted">{signals.length} in view &middot; live via SSE</span>
      </div>

      <div className="filters-bar">
        <input
          placeholder="Ticker filter"
          value={filters.ticker}
          onChange={(e) => update('ticker', e.target.value.trim().toUpperCase())}
          aria-label="Filter by ticker"
          style={{ width: 120 }}
        />
        <select value={filters.eventType} onChange={(e) => update('eventType', e.target.value)} aria-label="Filter by event type">
          <option value="">All event types</option>
          {meta?.event_types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="number" min="0" max="10" step="0.5"
          placeholder="Min impact"
          value={filters.minImpact}
          onChange={(e) => update('minImpact', e.target.value)}
          aria-label="Minimum impact"
          style={{ width: 100 }}
        />
        {(filters.ticker || filters.eventType || filters.minImpact) && (
          <button className="btn-ghost btn btn-sm" onClick={() => setFilters({ ticker: '', eventType: '', minImpact: '' })}>
            Clear filters
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 24L12 14l6 8 4-12 6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          title="No signals yet"
          hint="Signals appear here as the engine processes items from the feeds. If the queue has items, check System to verify the AI engine is ready."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('timestamp')}>Time{sortIcon('timestamp')}</th>
                <th>Tickers</th>
                <th className="sortable" onClick={() => toggleSort('event_type')}>Event{sortIcon('event_type')}</th>
                <th>Sentiment</th>
                <th className="sortable num" onClick={() => toggleSort('impact')}>Impact{sortIcon('impact')}</th>
                <th className="num">Confidence</th>
                <th>Market</th>
                <th>Source</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.signal_id}
                  onClick={() => setSelected(s)}
                  style={{ cursor: 'pointer' }}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(s)}
                  className={selected?.signal_id === s.signal_id ? 'selected' : ''}
                >
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(s.timestamp).toLocaleTimeString([], { hour12: false })}</td>
                  <td>{s.tickers?.length ? s.tickers.slice(0, 3).join(', ') : <span className="muted">Market</span>}</td>
                  <td>{s.event_type}</td>
                  <td><SentimentBar value={s.sentiment} /></td>
                  <td className="num"><ImpactBar value={s.impact} /></td>
                  <td className="num muted">{Math.round(s.confidence * 100)}%</td>
                  <td>
                    <Pill status={s.market_confirmation === 'confirmed' ? 'ok' : 'neutral'}>
                      {MARKET[s.market_confirmation] ?? '-'}
                    </Pill>
                  </td>
                  <td className="muted overflow-hidden">{s.source_name ?? s.source}</td>
                  <td className="muted overflow-hidden">{s.evidence_span?.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
