import React, { useState } from 'react';
import { get, post } from '../api/http.js';
import { usePolling } from '../api/usePolling.js';

const state = (ok, reachable = true) => (!reachable ? 'unreachable' : ok ? 'ok' : 'degraded');

function Service({ name, status, children }) {
  return (
    <div className="card">
      <h3>
        {name} <span className={`pill ${status}`}>{status}</span>
      </h3>
      {children}
    </div>
  );
}

function Dlq({ stream, count, onChange }) {
  const [entries, setEntries] = useState(null);
  const [message, setMessage] = useState('');

  async function view() {
    setEntries((await get(`/v1/dlq?stream=${stream}`)).items);
  }

  async function replay() {
    const body = await post('/v1/dlq/replay', { stream });
    setMessage(`Replayed ${body.replayed}. Discarded ${body.discarded} with no payload to replay.`);
    setEntries(null);
    onChange();
  }

  return (
    <li>
      <span>
        {stream} dead letters <strong>{count}</strong>
      </span>
      <span className="controls">
        <button className="secondary" disabled={!count} onClick={view}>
          View
        </button>
        <button disabled={!count} onClick={replay}>
          Replay
        </button>
      </span>
      {message && <p className="muted">{message}</p>}
      {entries && (
        <ul className="plain small">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="muted">{e.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function SystemPanel() {
  const system = usePolling('/v1/system', 4000);
  const chaos = usePolling('/v1/chaos', 4000);
  const [failure, setFailure] = useState('');

  async function toggle(target, down) {
    setFailure('');
    try {
      await post('/v1/chaos', { target, down });
      chaos.reload();
      system.reload();
    } catch (err) {
      setFailure(err.message);
    }
  }

  const s = system.data;
  if (!s) return <p className="empty">{system.error || 'Loading system status.'}</p>;
  const { services, streams, stats, drift } = s;
  const faults = chaos.data
    ? [
        ['llm', 'Language model', chaos.data.llm_down],
        ['rss', 'News feeds', chaos.data.sources.rss],
        ['reddit', 'Reddit', chaos.data.sources.reddit],
      ]
    : [];

  return (
    <section aria-label="System">
      <h2>System health</h2>
      {(system.error || failure) && <p className="neg-text">{system.error || failure}</p>}

      <div className="grid">
        <Service name="Gateway" status={state(services.gateway.ok)}>
          <p className="muted">
            Redis {services.gateway.redis ? 'ok' : 'down'}, Postgres {services.gateway.postgres ? 'ok' : 'down'},{' '}
            {services.gateway.sse_clients} live clients
          </p>
        </Service>
        <Service name="AI engine" status={state(services.ai.ok, services.ai.reachable)}>
          <p className="muted">
            Models {services.ai.models_ready ? 'ready' : 'loading'}. Language model{' '}
            {services.ai.llm ? (services.ai.llm.configured ? `breaker ${services.ai.llm.breaker}` : 'not configured') : '-'}
            {services.ai.llm?.forced_down && ', taken down by fault injection'}
          </p>
        </Service>
        <Service name="Ingestion" status={state(services.ingestion.ok, services.ingestion.reachable)}>
          {Object.entries(services.ingestion.connectors).map(([name, c]) => (
            <p key={name} className="muted">
              {name}: fetched {c.fetched ?? 0}, new {c.published ?? 0}, failures {c.failures}
              {c.error && ` (${c.error})`}
              {services.ingestion.disabled.includes(name) && ' [disabled]'}
            </p>
          ))}
        </Service>
        <Service name="Quant" status={state(services.quant.ok, services.quant.reachable)}>
          <p className="muted">Portfolio and stress engine</p>
        </Service>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Streams</h3>
          <p className="muted">
            Collected items {streams.raw_items}. Waiting for the engine {streams.raw_backlog ?? '-'}. Items awaiting
            review {streams.review_queue}.
          </p>
          <ul className="plain">
            <Dlq stream="raw" count={streams.raw_dlq} onChange={system.reload} />
            <Dlq stream="signals" count={streams.signals_dlq} onChange={system.reload} />
          </ul>
        </div>

        <div className="card">
          <h3>Fault injection</h3>
          <p className="muted">Take a dependency down to see the system degrade and recover.</p>
          <ul className="plain">
            {faults.map(([target, label, down]) => (
              <li key={target}>
                <span>
                  {label}{' '}
                  <span className={`pill ${down === null ? 'unreachable' : down ? 'degraded' : 'ok'}`}>
                    {down === null ? 'unreachable' : down ? 'down' : 'up'}
                  </span>
                </span>
                <button className={down ? '' : 'danger'} disabled={down === null} onClick={() => toggle(target, !down)}>
                  {down ? 'Restore' : 'Take down'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {stats && (
        <div className="grid">
          <div className="card">
            <h3>Pipeline</h3>
            <dl className="facts">
              <div><dt>Signals emitted</dt><dd>{stats.signals_emitted}</dd></div>
              <div><dt>Events created</dt><dd>{stats.events_new}</dd></div>
              <div><dt>Items joined to events</dt><dd>{stats.events_joined}</dd></div>
              <div><dt>Cache hit rate</dt><dd>{Math.round(stats.cache_hit_rate * 100)}%</dd></div>
              <div><dt>Meaning flips blocked</dt><dd>{stats.cache_flip}</dd></div>
              <div><dt>Escalated to LLM</dt><dd>{stats.escalated}</dd></div>
              <div><dt>Adjudicated</dt><dd>{stats.adjudicated}</dd></div>
              <div><dt>Abstained</dt><dd>{stats.abstained}</dd></div>
              <div><dt>Degraded signals</dt><dd>{stats.degraded}</dd></div>
              <div><dt>Injection attempts blocked</dt><dd>{stats.injection_blocked}</dd></div>
            </dl>
          </div>

          <div className="card">
            <h3>Language model usage</h3>
            <dl className="facts">
              <div><dt>Calls</dt><dd>{stats.llm_calls}</dd></div>
              <div><dt>Tokens in / out</dt><dd>{stats.llm_tokens_in} / {stats.llm_tokens_out}</dd></div>
              <div><dt>Calls per signal</dt><dd>{stats.llm_calls_per_signal}</dd></div>
              <div><dt>Cost</dt><dd>${stats.llm_cost_usd}</dd></div>
              <div><dt>Cost per signal</dt><dd>${stats.cost_per_signal_usd}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {stats && (
        <div className="card">
          <h3>Latency by path</h3>
          {Object.keys(stats.latency_ms).length === 0 ? (
            <p className="muted">No signals processed yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Path</th>
                  <th className="num">Items</th>
                  <th className="num">p50 ms</th>
                  <th className="num">p95 ms</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.latency_ms).map(([tier, l]) => (
                  <tr key={tier}>
                    <td className="cap">{tier}</td>
                    <td className="num">{l.n}</td>
                    <td className="num">{l.p50}</td>
                    <td className="num">{l.p95}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {drift && (
        <div className="card">
          <h3>
            Drift <span className={`pill ${drift.status === 'alert' ? 'degraded' : 'ok'}`}>{drift.status.replace('_', ' ')}</span>
          </h3>
          {drift.status === 'warming_up' ? (
            <p className="muted">
              Collecting data: {drift.signals_seen} of {drift.window * 2} signals needed.
            </p>
          ) : (
            <>
              <p className="muted">
                Sentiment shift {drift.metrics.sentiment_psi}, confidence change {drift.metrics.confidence_shift}
                {drift.metrics.cache_hit_rate_shift !== undefined && `, cache hit rate change ${drift.metrics.cache_hit_rate_shift}`}
              </p>
              {drift.alerts.map((a) => (
                <p key={a} className="neg-text">{a}</p>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
