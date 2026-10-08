import React from 'react';

const MARKET_LABEL = {
  confirmed: 'Confirmed',
  unconfirmed: 'Unconfirmed',
  pending: 'Pending',
  not_applicable: '-',
};

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour12: false });

function SentimentBar({ value }) {
  const width = `${Math.abs(value) * 50}%`;
  const side = value < 0 ? { right: '50%' } : { left: '50%' };
  return (
    <span className="sentiment" title={value.toFixed(2)}>
      <span className={`sentiment-fill ${value < 0 ? 'neg' : 'pos'}`} style={{ width, ...side }} />
      <span className="sentiment-value">{value.toFixed(2)}</span>
    </span>
  );
}

export default function SignalFeed({ signals }) {
  if (!signals.length) {
    return <p className="empty">No signals yet. They appear here as the engine publishes them.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Ticker</th>
            <th>Event</th>
            <th>Sentiment</th>
            <th className="num">Impact</th>
            <th className="num">Confidence</th>
            <th>Market</th>
            <th>Source</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => (
            <tr key={s.signal_id}>
              <td>{time(s.timestamp)}</td>
              <td>{s.tickers.length ? s.tickers.join(', ') : 'Market-wide'}</td>
              <td>{s.event_type}</td>
              <td><SentimentBar value={s.sentiment} /></td>
              <td className="num">{s.impact.toFixed(1)}</td>
              <td className="num">{Math.round(s.confidence * 100)}%</td>
              <td className={`market ${s.market_confirmation}`}>{MARKET_LABEL[s.market_confirmation]}</td>
              <td>{s.source_name ?? s.source}</td>
              <td className="evidence">{s.evidence_span.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
