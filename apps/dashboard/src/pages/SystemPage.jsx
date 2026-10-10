import React, { useState } from 'react';
import { EmptyState, ErrorState, FactRow, Modal, Pill } from '../components/ui.jsx';
import { usePolling } from '../api/usePolling.js';
import { useToast } from '../api/toast.jsx';

/* ── inline SVG latency bar chart ── */
function LatencyChart({ latency_ms }) {
  const entries = Object.entries(latency_ms);
  if (!entries.length) return <EmptyState title="No signals processed yet" hint="Latency data will appear after the engine processes its first items." />;
  const maxP95 = Math.max(...entries.map(([, l]) => l.p95 ?? 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(([tier, l]) => (
        <div key={tier} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{tier}</span>
          <div style={{ position: 'relative', height: 10, background: 'var(--border)', borderRadius: 5 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${((l.p50 ?? 0) / maxP95) * 100}%`, background: 'var(--accent)', borderRadius: 5, opacity: 0.7 }} />
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${((l.p95 ?? 0) / maxP95) * 100}%`, background: 'var(--accent)', borderRadius: 5, opacity: 0.3 }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
            p50 {l.p50}ms / p95 {l.p95}ms
          </span>
        </div>
      ))}
    </div>
  );
}

function ServiceCard({ name, status, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{name}</span>
        <Pill status={status}>{status}</Pill>
      </div>
      {children}
    </div>
  );
}

function DlqRow({ stream, count, onReload }) {
  const [entries, setEntries] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function view() {
    const r = await fetch(`/v1/dlq?stream=${stream}`);
    const body = await r.json();
    setEntries(body.items ?? []);
  }

  async function replay() {
    setBusy(true);
    try {
      const r = await fetch('/v1/dlq/replay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stream }) });
      const body = await r.json();
      toast(`Replayed ${body.replayed}. Discarded ${body.discarded} with no payload.`);
      setEntries(null);
      onReload();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 13 }}>
          <span className="muted">{stream}</span> dead letters &nbsp;
          <strong style={{ color: count > 0 ? 'var(--neg)' : 'var(--muted)' }}>{count}</strong>
        </span>
        <button className="btn btn-sm" disabled={!count} onClick={view}>View</button>
        <button className="btn btn-sm" disabled={!count || busy} onClick={replay}>Replay</button>
      </div>
      {entries?.length === 0 && <p className="muted small">No entries.</p>}
      {entries?.map((e) => (
        <div key={e.id} className="muted small" style={{ paddingLeft: 12 }}>{e.reason}</div>
      ))}
    </div>
  );
}

function FaultRow({ label, down, onToggle, disabled }) {
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const status = down === null ? 'unreachable' : down ? 'degraded' : 'ok';
  const text = down === null ? 'unreachable' : down ? 'down' : 'up';

  function handleClick() {
    if (!down) setConfirm(true);
    else onToggle();
  }

  return (
    <>
      {confirm && (
        <Modal
          title={`Take down ${label}?`}
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn-danger btn" onClick={() => { onToggle(); setConfirm(false); }}>
                Take down
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            This will simulate a failure of <strong>{label}</strong>. The system should degrade gracefully and recover when you restore it.
          </p>
        </Modal>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill status={status}>{text}</Pill>
        <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
        <button
          className={`btn btn-sm ${!down && down !== null ? 'btn-danger' : ''}`}
          disabled={down === null || disabled}
          onClick={handleClick}
        >
          {down ? 'Restore' : 'Take down'}
        </button>
      </div>
    </>
  );
}

const svcState = (ok, reachable = true) => !reachable ? 'unreachable' : ok ? 'ok' : 'degraded';

export default function SystemPage() {
  const sys = usePolling('/v1/system', 4000);
  const chaos = usePolling('/v1/chaos', 4000);
  const toast = useToast();

  async function toggle(target, down) {
    try {
      const r = await fetch('/v1/chaos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target, down }) });
      if (!r.ok) throw new Error(`${r.status}`);
      chaos.reload(); sys.reload();
      toast(`${target} ${down ? 'taken down' : 'restored'}.`);
    } catch (e) { toast(e.message, 'error'); }
  }

  const s = sys.data;
  const faults = chaos.data
    ? [
        ['llm', 'Language model', chaos.data.llm_down],
        ['rss', 'News feeds', chaos.data.sources?.rss],
        ['reddit', 'Reddit', chaos.data.sources?.reddit],
      ]
    : [];

  return (
    <>
      <div className="page-header">
        <h1>System health</h1>
        <button className="btn btn-sm" onClick={() => { sys.reload(); chaos.reload(); }}>Refresh</button>
      </div>

      {sys.error && <ErrorState msg={sys.error} />}
      {!s && !sys.error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      )}

      {s && (
        <>
          {/* Service cards */}
          <div className="grid-2">
            <ServiceCard name="Gateway" status={svcState(s.services.gateway.ok)}>
              <div className="facts">
                <FactRow label="Redis" value={s.services.gateway.redis ? 'ok' : 'down'} valueClass={s.services.gateway.redis ? 'pos-text' : 'neg-text'} />
                <FactRow label="Postgres" value={s.services.gateway.postgres ? 'ok' : 'down'} valueClass={s.services.gateway.postgres ? 'pos-text' : 'neg-text'} />
                <FactRow label="SSE clients" value={s.services.gateway.sse_clients} />
              </div>
            </ServiceCard>

            <ServiceCard name="AI engine" status={svcState(s.services.ai.ok, s.services.ai.reachable)}>
              <div className="facts">
                <FactRow label="Models" value={s.services.ai.models_ready ? 'ready' : 'loading'} valueClass={s.services.ai.models_ready ? 'pos-text' : 'warn-text'} />
                <FactRow label="LLM breaker" value={s.services.ai.llm?.breaker ?? '-'} valueClass={s.services.ai.llm?.breaker === 'closed' ? 'pos-text' : s.services.ai.llm?.breaker === 'open' ? 'neg-text' : ''} />
                {s.services.ai.llm?.forced_down && <FactRow label="Fault injection" value="forced down" valueClass="neg-text" />}
              </div>
            </ServiceCard>

            <ServiceCard name="Ingestion" status={svcState(s.services.ingestion.ok, s.services.ingestion.reachable)}>
              <div className="facts">
                {Object.entries(s.services.ingestion.connectors ?? {}).map(([name, c]) => (
                  <div key={name} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', width: 80, flexShrink: 0 }}>{name}</span>
                    <span style={{ fontSize: 12 }}>fetched {c.fetched ?? 0}, new {c.published ?? 0}, errors {c.failures}</span>
                    {s.services.ingestion.disabled?.includes(name) && <Pill status="degraded">disabled</Pill>}
                    {c.error && <span className="neg-text small">{c.error}</span>}
                  </div>
                ))}
              </div>
            </ServiceCard>

            <ServiceCard name="Quant" status={svcState(s.services.quant.ok, s.services.quant.reachable)}>
              <p className="muted small">Portfolio and stress engine</p>
            </ServiceCard>
          </div>

          {/* Streams + Fault injection */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><span className="card-title">Streams</span></div>
              <div className="facts" style={{ marginBottom: 16 }}>
                <FactRow label="Raw items collected" value={s.streams.raw_items} />
                <FactRow label="AI engine backlog" value={s.streams.raw_backlog ?? '-'} />
                <FactRow label="Awaiting review" value={s.streams.review_queue} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <DlqRow stream="raw" count={s.streams.raw_dlq} onReload={sys.reload} />
                <DlqRow stream="signals" count={s.streams.signals_dlq} onReload={sys.reload} />
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Fault injection</span></div>
              <p className="muted small" style={{ marginBottom: 12 }}>
                Take a dependency down to see the system degrade gracefully and recover.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {faults.map(([target, label, down]) => (
                  <FaultRow
                    key={target}
                    label={label}
                    down={down ?? null}
                    disabled={chaos.data === null}
                    onToggle={() => toggle(target, !down)}
                  />
                ))}
                {!chaos.data && <p className="muted small">Chaos API unreachable.</p>}
              </div>
            </div>
          </div>

          {/* Pipeline stats */}
          {s.stats && (
            <div className="grid-2">
              <div className="card">
                <div className="card-header"><span className="card-title">Pipeline</span></div>
                <div className="facts">
                  <FactRow label="Signals emitted" value={s.stats.signals_emitted} />
                  <FactRow label="Events created" value={s.stats.events_new} />
                  <FactRow label="Items joined to events" value={s.stats.events_joined} />
                  <FactRow label="Cache hit rate" value={`${Math.round(s.stats.cache_hit_rate * 100)}%`} />
                  <FactRow label="Meaning flips blocked" value={s.stats.cache_flip} />
                  <FactRow label="Escalated to LLM" value={s.stats.escalated} />
                  <FactRow label="Adjudicated" value={s.stats.adjudicated} />
                  <FactRow label="Abstained" value={s.stats.abstained} />
                  <FactRow label="Degraded signals" value={s.stats.degraded} />
                  <FactRow label="Injection attempts blocked" value={s.stats.injection_blocked} />
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">LLM usage &amp; cost</span></div>
                <div className="facts">
                  <FactRow label="Calls" value={s.stats.llm_calls} />
                  <FactRow label="Tokens in / out" value={`${s.stats.llm_tokens_in} / ${s.stats.llm_tokens_out}`} />
                  <FactRow label="Calls per signal" value={s.stats.llm_calls_per_signal} />
                  <FactRow label="Total cost" value={`$${s.stats.llm_cost_usd}`} />
                  <FactRow label="Cost per signal" value={`$${s.stats.cost_per_signal_usd}`} />
                </div>
              </div>
            </div>
          )}

          {/* Latency chart */}
          {s.stats && (
            <div className="card">
              <div className="card-header"><span className="card-title">Latency by path</span></div>
              <LatencyChart latency_ms={s.stats.latency_ms ?? {}} />
            </div>
          )}

          {/* Drift */}
          {s.drift && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Drift monitor</span>
                <Pill status={s.drift.status === 'alert' ? 'degraded' : 'ok'}>
                  {s.drift.status.replace('_', ' ')}
                </Pill>
              </div>
              {s.drift.status === 'warming_up' ? (
                <p className="muted small">
                  Collecting baseline: {s.drift.signals_seen} of {s.drift.window * 2} signals needed.
                </p>
              ) : (
                <div className="facts">
                  <FactRow label="Sentiment PSI" value={s.drift.metrics?.sentiment_psi} />
                  <FactRow label="Confidence shift" value={s.drift.metrics?.confidence_shift} />
                  {s.drift.metrics?.cache_hit_rate_shift !== undefined && (
                    <FactRow label="Cache hit rate shift" value={s.drift.metrics.cache_hit_rate_shift} />
                  )}
                  {s.drift.alerts?.map((a) => (
                    <div key={a} className="neg-text small">{a}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
