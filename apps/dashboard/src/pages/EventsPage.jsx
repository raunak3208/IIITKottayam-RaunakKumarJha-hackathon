import React, { useState } from 'react';
import { Drawer, EmptyState, ErrorState, ImpactBar, Pill, SkeletonRows } from '../components/ui.jsx';
import { dtStr, money, timeStr } from '../api/fmt.js';
import { usePolling } from '../api/usePolling.js';
import { useToast } from '../api/toast.jsx';

function DossierDrawer({ eventId, onClose }) {
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setLoading(true);
    fetch(`/v1/events/${eventId}/investigate`, { method: 'POST' })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setDossier)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <Drawer title="Event dossier" onClose={onClose}>
      {loading && <SkeletonRows rows={5} />}
      {error && <ErrorState msg={error} />}
      {dossier && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill status={dossier.status === 'confirmed' ? 'ok' : 'neutral'}>{dossier.status}</Pill>
            <span className="muted">Confidence: {Math.round(dossier.confidence * 100)}%</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{dossier.summary}</p>
          {dossier.claims?.length > 0 && (
            <div>
              <div className="card-muted" style={{ marginBottom: 8 }}>Claims &amp; evidence</div>
              <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dossier.claims.map((c, i) => (
                  <li key={i} style={{ fontSize: 13 }}>
                    {c.text}
                    {c.evidence?.map((e, j) => e.url ? (
                      <a key={j} href={e.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', marginLeft: 6 }}>source</a>
                    ) : null)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dossier.counter_evidence?.length > 0 && (
            <div>
              <div className="card-muted" style={{ marginBottom: 8 }}>Counter evidence</div>
              <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dossier.counter_evidence.map((t, i) => <li key={i} style={{ fontSize: 13 }}>{t}</li>)}
              </ul>
            </div>
          )}
          {dossier.analogs?.length > 0 && (
            <div>
              <div className="card-muted" style={{ marginBottom: 8 }}>Historical analogs</div>
              <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dossier.analogs.map((a, i) => (
                  <li key={i} style={{ fontSize: 13 }}>
                    {a.date} {a.title}
                    {a.reaction_pct !== undefined && ` (${a.reaction_pct > 0 ? '+' : ''}${a.reaction_pct}% next day)`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dossier.stress && (
            <div className="card-raised" style={{ padding: 12 }}>
              <div className="card-muted" style={{ marginBottom: 4 }}>Illustrative stress</div>
              <span style={{ fontSize: 13 }}>
                {money.format(dossier.stress.value_before)} → {money.format(dossier.stress.value_after)}
                {' '}({dossier.stress.scenario_id})
              </span>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function SignalsDrawer({ eventId, onClose }) {
  const { data, loading, error } = usePolling(`/v1/events/${eventId}/signals`, 0);
  return (
    <Drawer title="Member signals" onClose={onClose}>
      {loading && <SkeletonRows rows={4} />}
      {error && <ErrorState msg={error} />}
      {data?.items?.length === 0 && <EmptyState title="No signals" />}
      {data?.items?.map((s) => (
        <div key={s.signal_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{timeStr(s.timestamp)}</span>
            <span style={{ fontSize: 12 }}>{s.source_name ?? s.source}</span>
            <ImpactBar value={s.impact} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{s.evidence_span?.text}</p>
        </div>
      ))}
    </Drawer>
  );
}

export default function EventsPage({ setPage }) {
  const { data, loading, error, reload } = usePolling('/v1/events?limit=50', 8000);
  const [dossierEvent, setDossierEvent] = useState(null);
  const [signalsEvent, setSignalsEvent] = useState(null);
  const [sort, setSort] = useState({ col: 'last_seen', asc: false });
  const toast = useToast();

  const toggleSort = (col) => setSort((s) => s.col === col ? { col, asc: !s.asc } : { col, asc: false });
  const sortIcon = (col) => sort.col !== col ? '' : sort.asc ? ' ↑' : ' ↓';

  let rows = data?.items ?? [];
  if (sort.col) {
    rows = [...rows].sort((a, b) => {
      const va = a[sort.col], vb = b[sort.col];
      return sort.asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }

  return (
    <>
      {dossierEvent && <DossierDrawer eventId={dossierEvent} onClose={() => setDossierEvent(null)} />}
      {signalsEvent && <SignalsDrawer eventId={signalsEvent} onClose={() => setSignalsEvent(null)} />}

      <div className="page-header">
        <h1>Events</h1>
        <span className="muted">{rows.length} events</span>
      </div>

      {error && <ErrorState msg={error} />}
      {loading && <SkeletonRows rows={6} h={44} />}
      {!loading && rows.length === 0 && (
        <EmptyState
          title="No events yet"
          hint="Events are clusters of corroborating signals. They appear after multiple signals on the same topic are observed. Check the Signals page to confirm data is flowing."
        />
      )}
      {!loading && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('last_seen')}>Last seen{sortIcon('last_seen')}</th>
                <th className="sortable" onClick={() => toggleSort('event_type')}>Event type{sortIcon('event_type')}</th>
                <th>Tickers</th>
                <th className="sortable num" onClick={() => toggleSort('signal_count')}>Signals{sortIcon('signal_count')}</th>
                <th className="num">Sources</th>
                <th className="sortable num" onClick={() => toggleSort('impact')}>Impact{sortIcon('impact')}</th>
                <th>Status</th>
                <th>Sentiment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.event_id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{timeStr(e.last_seen)}</td>
                  <td>{e.event_type}</td>
                  <td className="muted overflow-hidden">{e.tickers?.length ? e.tickers.join(', ') : 'Market-wide'}</td>
                  <td className="num">{e.signal_count}</td>
                  <td className="num muted">{e.source_count ?? e.sources?.length ?? '-'}</td>
                  <td className="num"><ImpactBar value={e.impact} /></td>
                  <td>
                    <Pill status={e.status === 'confirmed' ? 'ok' : e.status === 'review' ? 'running' : 'neutral'}>
                      {e.status ?? '-'}
                    </Pill>
                  </td>
                  <td>
                    <span className={e.sentiment > 0.1 ? 'pos-text' : e.sentiment < -0.1 ? 'neg-text' : 'muted'}>
                      {e.sentiment > 0 ? '+' : ''}{e.sentiment?.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost btn btn-sm" onClick={() => setSignalsEvent(e.event_id)}>Signals</button>
                      <button className="btn btn-sm" onClick={() => setDossierEvent(e.event_id)}>Investigate</button>
                      {setPage && (
                        <button className="btn-ghost btn btn-sm" onClick={() => setPage('research')} title="Launch ARIA Multi-Agent Research">ARIA</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
