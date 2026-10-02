import React, { useEffect, useState } from 'react';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

const signed = (value) => `${value > 0 ? '+' : ''}${money.format(value)}`;
const bp = (value) => `${value > 0 ? '+' : ''}${value} bp`;
const pct = (value) => `${value > 0 ? '+' : ''}${value}%`;

function Shocks({ shocks }) {
  const items = [
    ['Equities', pct(shocks.equity_pct)],
    ['Rates', bp(shocks.rate_bp)],
    ['Credit spreads', bp(shocks.credit_spread_bp)],
    ['FX', pct(shocks.fx_pct)],
  ];
  return (
    <dl className="shocks">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Trigger({ trigger }) {
  if (trigger.manual) return <p className="muted">Started manually.</p>;
  return (
    <div className="trigger">
      <p>
        <strong>{trigger.event_type}</strong> detected. Impact {trigger.impact.toFixed(1)}, confidence{' '}
        {Math.round(trigger.confidence * 100)}%.
      </p>
      <p className="muted">{trigger.evidence}</p>
    </div>
  );
}

function ClassTable({ run, exposure }) {
  const rows = run
    ? run.by_asset_class.map((r) => ({
        kind: r.asset_class,
        before: r.before,
        after: r.after,
        change: r.change,
        share: run.exposure.find((e) => e.asset_class === r.asset_class)?.share ?? 0,
      }))
    : exposure.map((e) => ({ kind: e.asset_class, before: e.value, share: e.share }));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Asset class</th>
            <th>Exposure</th>
            <th className="num">Before</th>
            {run && <th className="num">After</th>}
            {run && <th className="num">Change</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kind}>
              <td className="cap">{r.kind}</td>
              <td>
                <span className="bar">
                  <span className="bar-fill" style={{ width: `${r.share * 100}%` }} />
                </span>
                <span className="bar-label">{Math.round(r.share * 100)}%</span>
              </td>
              <td className="num">{money.format(r.before)}</td>
              {run && <td className="num">{money.format(r.after)}</td>}
              {run && (
                <td className={`num ${r.change < 0 ? 'neg-text' : 'pos-text'}`}>{signed(r.change)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StressPanel({ stress, onRun }) {
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState('');
  const [portfolio, setPortfolio] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/v1/scenarios')
      .then((res) => res.json())
      .then((body) => {
        setScenarios(body.items);
        setSelected(body.items[0]?.scenario_id ?? '');
      })
      .catch(() => {});
    fetch('/v1/portfolio')
      .then((res) => res.json())
      .then(setPortfolio)
      .catch(() => {});
  }, []);

  async function run() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/v1/stress/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario_id: selected }),
      });
      if (!res.ok) throw new Error(`request failed (${res.status})`);
      onRun(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Portfolio stress test">
      <div className="panel-head">
        <h2>Portfolio stress test</h2>
        <div className="controls">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Scenario">
            {scenarios.map((s) => (
              <option key={s.scenario_id} value={s.scenario_id}>
                {s.name}
              </option>
            ))}
          </select>
          <button onClick={run} disabled={busy || !selected}>
            {busy ? 'Running' : 'Run stress test'}
          </button>
        </div>
      </div>
      {error && <p className="neg-text">{error}</p>}

      {stress ? (
        <>
          <div className="values">
            <div>
              <span>Portfolio before</span>
              <strong>{money.format(stress.value_before)}</strong>
            </div>
            <div>
              <span>Portfolio after</span>
              <strong>{money.format(stress.value_after)}</strong>
            </div>
            <div>
              <span>Estimated loss</span>
              <strong className={stress.loss < 0 ? 'neg-text' : 'pos-text'}>
                {signed(stress.loss)} ({pct(stress.loss_pct)})
              </strong>
            </div>
          </div>
          <div className="scenario">
            <h3>{stress.scenario.name}</h3>
            <Shocks shocks={stress.scenario.shocks} />
            <Trigger trigger={stress.trigger} />
          </div>
          <ClassTable run={stress} />
        </>
      ) : (
        <>
          <p className="muted">
            No stress test has run yet. One starts automatically when an event meets a scenario trigger,
            or you can run one manually.
          </p>
          {portfolio && (
            <>
              <p>
                Portfolio value <strong>{money.format(portfolio.total_value)}</strong> across{' '}
                {portfolio.positions} positions.
              </p>
              <ClassTable exposure={portfolio.exposure} />
            </>
          )}
        </>
      )}
    </section>
  );
}
