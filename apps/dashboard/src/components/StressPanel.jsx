import React, { useEffect, useState } from 'react';
import { get, post } from '../api/http.js';
import Contagion from './stress/Contagion.jsx';
import ReverseStress from './stress/ReverseStress.jsx';
import Tornado from './stress/Tornado.jsx';
import WhatIf from './stress/WhatIf.jsx';
import { bp, money, pct, signed } from './stress/format.js';

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
  if (trigger.manual) {
    return <p className="muted">{trigger.what_if ? 'Started from the what-if controls.' : 'Started manually.'}</p>;
  }
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

const describe = (run) =>
  `${new Date(run.timestamp).toLocaleTimeString([], { hour12: false })}  ${run.scenario.name}  (${
    run.trigger.manual ? (run.trigger.what_if ? 'what-if' : 'manual') : 'event'
  })`;

export default function StressPanel({ stress, onRun }) {
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState('');
  const [portfolio, setPortfolio] = useState(null);
  const [history, setHistory] = useState([]);
  const [shown, setShown] = useState(null);
  const [tickerText, setTickerText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tickers = tickerText.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
  const scenario = scenarios.find((s) => s.scenario_id === selected);

  const loadHistory = () =>
    get('/v1/stress?limit=15')
      .then((body) => setHistory(body.items))
      .catch(() => {});

  useEffect(() => {
    get('/v1/scenarios')
      .then((body) => {
        setScenarios(body.items);
        setSelected(body.items[0]?.scenario_id ?? '');
      })
      .catch((err) => setError(err.message));
    get('/v1/portfolio').then(setPortfolio).catch((err) => setError(err.message));
    loadHistory();
  }, []);

  useEffect(() => {
    if (stress) {
      setShown(stress);
      loadHistory();
    }
  }, [stress]);

  function accept(run) {
    onRun(run);
    setShown(run);
    loadHistory();
  }

  async function runManual() {
    setBusy(true);
    setError('');
    try {
      accept(await post('/v1/stress/run', { scenario_id: selected, tickers }));
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
          <input
            placeholder="Affected tickers, e.g. JPM"
            value={tickerText}
            onChange={(e) => setTickerText(e.target.value)}
            aria-label="Affected tickers"
          />
          <button onClick={runManual} disabled={busy || !selected}>
            {busy ? 'Running' : 'Run stress test'}
          </button>
        </div>
      </div>
      {error && <p className="neg-text">{error}</p>}

      {history.length > 0 && (
        <div className="controls history">
          <span className="muted">Earlier runs</span>
          <select
            value={shown?.run_id ?? ''}
            onChange={(e) => setShown(history.find((r) => r.run_id === e.target.value))}
            aria-label="Earlier stress runs"
          >
            {history.map((r) => (
              <option key={r.run_id} value={r.run_id}>
                {describe(r)}
              </option>
            ))}
          </select>
        </div>
      )}

      {shown ? (
        <>
          <div className="values">
            <div>
              <span>Portfolio before</span>
              <strong>{money.format(shown.value_before)}</strong>
            </div>
            <div>
              <span>Portfolio after</span>
              <strong>{money.format(shown.value_after)}</strong>
            </div>
            {shown.risk && (
              <div>
                <span>Value at risk (95%)</span>
                <strong>{money.format(-shown.risk.var_95)}</strong>
              </div>
            )}
            {shown.risk && (
              <div>
                <span>Expected shortfall (95%)</span>
                <strong>{money.format(-shown.risk.es_95)}</strong>
              </div>
            )}
            <div>
              <span>Estimated loss</span>
              <strong className={shown.loss < 0 ? 'neg-text' : 'pos-text'}>
                {signed(shown.loss)} ({pct(shown.loss_pct)})
              </strong>
            </div>
          </div>
          <div className="scenario">
            <h3>{shown.scenario.name}</h3>
            <Shocks shocks={shown.shocks_applied ?? shown.scenario.shocks} />
            {shown.scale !== undefined && shown.scale !== 1 && (
              <p className="muted">
                Applied at {shown.scale}x of the scenario shocks, scaled by event impact and confidence.
              </p>
            )}
            <Trigger trigger={shown.trigger} />
          </div>
          <ClassTable run={shown} />
          <h3 className="sub">Contagion</h3>
          <Contagion contagion={shown.contagion} />
        </>
      ) : (
        <>
          <p className="muted">
            No stress test has run yet. One starts automatically when a well-corroborated event meets a scenario
            trigger, or you can run one manually.
          </p>
          {portfolio && (
            <>
              <p>
                Portfolio value <strong>{money.format(portfolio.total_value)}</strong> across {portfolio.positions}{' '}
                positions.
              </p>
              <ClassTable exposure={portfolio.exposure} />
            </>
          )}
        </>
      )}

      {scenario && (
        <div className="tools">
          <WhatIf scenario={scenario} tickers={tickers} onResult={accept} />
          <Tornado scenarioId={scenario.scenario_id} tickers={tickers} />
          <ReverseStress scenarioId={scenario.scenario_id} tickers={tickers} />
        </div>
      )}
    </section>
  );
}
