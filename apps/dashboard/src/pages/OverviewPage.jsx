import React, { useEffect, useState } from 'react';
import { EmptyState, ErrorState, ImpactBar, Pill, SentimentBar, SkeletonRows } from '../components/ui.jsx';
import { dtStr, money, sentimentLabel, timeStr } from '../api/fmt.js';
import { usePolling } from '../api/usePolling.js';
import EventsPage from './EventsPage.jsx';

/* ── inline SVG charts ── */
function SentimentSparkline({ signals }) {
  if (!signals.length) return <EmptyState title="No data yet" hint="Signals will appear here as the engine processes them." />;
  const items = signals.slice(0, 40).reverse();
  const W = 300, H = 80, pad = 4;
  const ys = items.map((s) => s.sentiment);
  const minY = Math.min(-1, ...ys), maxY = Math.max(1, ...ys);
  const xStep = (W - pad * 2) / Math.max(items.length - 1, 1);
  const yMap = (v) => pad + ((maxY - v) / (maxY - minY)) * (H - pad * 2);
  const pts = items.map((s, i) => `${pad + i * xStep},${yMap(s.sentiment)}`).join(' ');
  const mid = yMap(0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" aria-label="Sentiment trend">
      <line x1={pad} y1={mid} x2={W - pad} y2={mid} stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3" />
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      {items.map((s, i) => (
        <circle
          key={i}
          cx={pad + i * xStep}
          cy={yMap(s.sentiment)}
          r="2"
          fill={s.sentiment > 0 ? 'var(--pos)' : s.sentiment < 0 ? 'var(--neg)' : 'var(--muted)'}
        />
      ))}
    </svg>
  );
}

function EventTypeChart({ signals }) {
  if (!signals.length) return null;
  const counts = {};
  signals.forEach((s) => { counts[s.event_type] = (counts[s.event_type] ?? 0) + 1; });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const colors = ['var(--accent)', 'var(--pos)', 'var(--warn)', 'var(--muted)', 'var(--neg)', '#4AADA8', '#A08AFF', '#FF8A65'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([type, n], i) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type}</span>
          <span style={{ fontWeight: 600 }}>{n}</span>
          <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{ width: `${(n / total) * 100}%`, height: '100%', background: colors[i % colors.length], borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SystemStatus({ sys }) {
  if (!sys) return null;
  const { services } = sys;
  const items = [
    ['Gateway', services.gateway?.ok ? 'ok' : 'degraded'],
    ['AI engine', !services.ai?.reachable ? 'unreachable' : services.ai?.ok ? 'ok' : 'degraded'],
    ['Ingestion', !services.ingestion?.reachable ? 'unreachable' : services.ingestion?.ok ? 'ok' : 'degraded'],
    ['Quant', !services.quant?.reachable ? 'unreachable' : services.quant?.ok ? 'ok' : 'degraded'],
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(([name, status]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`badge-dot ${status}`} />
          <span style={{ fontSize: 12 }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewPage({ signals, stress, setPage }) {
  const { data: sys } = usePolling('/v1/system', 8000);
  const { data: eventsData, loading: evLoading, error: evErr } = usePolling('/v1/events?limit=5', 10000);

  const hourAgo = Date.now() - 3600000;
  const recentSignals = signals.filter((s) => new Date(s.timestamp).getTime() > hourAgo);
  const highImpact = signals.filter((s) => s.impact >= 7).length;
  const avgSent = signals.length ? signals.reduce((sum, s) => sum + s.sentiment, 0) / signals.length : null;
  const activeEvents = eventsData?.items?.length ?? '-';

  return (
    <>
      <div className="page-header">
        <h1>Overview</h1>
        <div className="page-header-actions">
          <SystemStatus sys={sys} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4">
        <div className="kpi-card">
          <span className="kpi-label">Signals (last hour)</span>
          <span className="kpi-value">{recentSignals.length}</span>
          <span className="kpi-sub">of {signals.length} in view</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">High-impact events</span>
          <span className={`kpi-value ${highImpact > 0 ? 'neg' : ''}`}>{highImpact}</span>
          <span className="kpi-sub">impact &#8805; 7</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Average sentiment</span>
          <span className={`kpi-value ${avgSent === null ? '' : avgSent > 0.1 ? 'pos' : avgSent < -0.1 ? 'neg' : ''}`}>
            {avgSent === null ? '—' : `${avgSent > 0 ? '+' : ''}${avgSent.toFixed(2)}`}
          </span>
          <span className="kpi-sub">across signals in view</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Active events</span>
          <span className="kpi-value">{activeEvents}</span>
          <span className="kpi-sub">
            {stress ? `Latest stress: ${money.format(stress.loss)}` : 'No stress run yet'}
          </span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Sentiment trend</span>
            <span className="card-muted">last {Math.min(signals.length, 40)} signals</span>
          </div>
          <SentimentSparkline signals={signals} />
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Event type distribution</span>
          </div>
          {signals.length ? <EventTypeChart signals={signals} /> : <EmptyState title="No signals yet" hint="Waiting for the engine to process items." />}
        </div>
      </div>

      {/* Latest events + stress */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Latest events</span>
            <button className="btn-ghost btn btn-sm" onClick={() => setPage('events')}>View all</button>
          </div>
          {evLoading && <SkeletonRows rows={3} h={28} />}
          {evErr && <ErrorState msg={evErr} />}
          {!evLoading && !evErr && !eventsData?.items?.length && (
            <EmptyState title="No events yet" hint="Events are created when multiple corroborating signals arrive. Go to Signals to see raw data." />
          )}
          {eventsData?.items?.map((e) => (
            <div key={e.event_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.event_type}</span>
              <span className="muted">{e.tickers?.slice(0, 3).join(', ') || 'Market'}</span>
              <ImpactBar value={e.impact} />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Latest stress run</span>
            <button className="btn-ghost btn btn-sm" onClick={() => setPage('stress')}>View all</button>
          </div>
          {stress ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="stress-values">
                <div className="stress-value-card">
                  <div className="stress-value-label">Before</div>
                  <div className="stress-value-num">{money.format(stress.value_before)}</div>
                </div>
                <div className="stress-value-card">
                  <div className="stress-value-label">After</div>
                  <div className="stress-value-num">{money.format(stress.value_after)}</div>
                </div>
                <div className="stress-value-card">
                  <div className="stress-value-label">Loss</div>
                  <div className={`stress-value-num ${stress.loss < 0 ? 'neg' : 'pos'}`}>
                    {stress.loss < 0 ? '-' : '+'}{money.format(Math.abs(stress.loss))}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {stress.scenario?.name} &middot; {timeStr(stress.timestamp)} &middot;{' '}
                {stress.trigger?.manual ? 'manual' : `event: ${stress.trigger?.event_type}`}
              </div>
            </div>
          ) : (
            <EmptyState title="No stress run yet" hint="A stress test runs automatically when a high-impact event is detected, or you can trigger one manually from Stress test." />
          )}
        </div>
      </div>
    </>
  );
}
