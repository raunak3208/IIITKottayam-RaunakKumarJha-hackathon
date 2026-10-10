import React, { useEffect, useState } from 'react';
import { EmptyState, ErrorState, Pill, SkeletonRows } from '../components/ui.jsx';
import { money, pct, bp, signed, timeStr, FACTORS } from '../api/fmt.js';
import { useToast } from '../api/toast.jsx';

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 2 });

/* Inline SVG donut chart for exposure */
function ExposureDonut({ exposure }) {
  if (!exposure?.length) return null;
  const colors = ['var(--accent)', 'var(--pos)', 'var(--warn)', 'var(--muted)'];
  const R = 50, cx = 60, cy = 60, total = exposure.reduce((s, e) => s + e.share, 0) || 1;
  let angle = -Math.PI / 2;
  const slices = exposure.map((e, i) => {
    const sweep = (e.share / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    angle += sweep;
    const x2 = cx + R * Math.cos(angle), y2 = cy + R * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { path: `M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z`, color: colors[i % colors.length], ...e };
  });
  return (
    <div className="donut-wrap">
      <svg width="120" height="120" viewBox="0 0 120 120" aria-label="Exposure by asset class">
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity=".85" />)}
        <circle cx={cx} cy={cy} r={R * 0.55} fill="var(--surface)" />
      </svg>
      <div className="donut-legend">
        {slices.map((s, i) => (
          <div key={i} className="donut-legend-item">
            <div className="donut-swatch" style={{ background: s.color }} />
            <span>{s.asset_class}</span>
            <span className="muted">{Math.round(s.share * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Inline SVG loss by asset class bar chart */
function LossChart({ byAssetClass }) {
  if (!byAssetClass?.length) return null;
  const max = Math.max(...byAssetClass.map((r) => Math.abs(r.change ?? 0)), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {byAssetClass.map((r) => (
        <div key={r.asset_class} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.asset_class}</span>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 0, height: '100%',
              width: `${(Math.abs(r.change) / max) * 100}%`,
              background: r.change < 0 ? 'var(--neg)' : 'var(--pos)',
              borderRadius: 4,
            }} />
          </div>
          <span className={`small ${r.change < 0 ? 'neg-text' : 'pos-text'}`} style={{ textAlign: 'right' }}>
            {signed(r.change)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Tornado SVG */
function TornadoChart({ factors }) {
  if (!factors?.length) return null;
  const widest = Math.max(...factors.flatMap((f) => [Math.abs(f.low_delta), Math.abs(f.high_delta)]), 1);
  const LABELS = { equity_pct: 'Equities', rate_bp: 'Rates', credit_spread_bp: 'Credit', fx_pct: 'FX' };
  return (
    <div className="tornado-chart">
      {factors.map((f) => (
        <div key={f.factor} className="tornado-row">
          <span className="muted">{LABELS[f.factor] ?? f.factor}</span>
          <div className="tornado-bars">
            <div className="tornado-center" />
            {[f.low_delta, f.high_delta].map((d, i) => (
              <div
                key={i}
                className={`tornado-bar ${d < 0 ? 'neg' : 'pos'}`}
                style={{ width: `${(Math.abs(d) / widest) * 45}%`, [d < 0 ? 'right' : 'left']: '50%' }}
                title={signed(d)}
              />
            ))}
          </div>
          <span className="muted" style={{ fontSize: 11, textAlign: 'right' }}>
            {signed(f.low_delta)} / {signed(f.high_delta)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ClassTable({ run, exposure }) {
  const rows = run
    ? run.by_asset_class.map((r) => ({ ...r, share: run.exposure?.find((e) => e.asset_class === r.asset_class)?.share ?? 0 }))
    : exposure?.map((e) => ({ asset_class: e.asset_class, before: e.value, share: e.share })) ?? [];
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Asset class</th>
            <th className="num">Share</th>
            <th className="num">Before</th>
            {run && <th className="num">After</th>}
            {run && <th className="num">Change</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.asset_class}>
              <td>{r.asset_class}</td>
              <td className="num muted">{Math.round(r.share * 100)}%</td>
              <td className="num">{moneyFmt.format(r.before)}</td>
              {run && <td className="num">{moneyFmt.format(r.after)}</td>}
              {run && (
                <td className={`num ${r.change < 0 ? 'neg-text' : 'pos-text'}`}>
                  {r.change < 0 ? '▼' : '▲'} {moneyFmt.format(Math.abs(r.change))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const descRun = (r) =>
  `${new Date(r.timestamp).toLocaleTimeString([], { hour12: false })}  ${r.scenario.name}  (${r.trigger.manual ? (r.trigger.what_if ? 'what-if' : 'manual') : 'event'})`;

export default function StressPage({ stress, setStress }) {
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState('');
  const [portfolio, setPortfolio] = useState(null);
  const [history, setHistory] = useState([]);
  const [shown, setShown] = useState(null);
  const [tickerText, setTickerText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [whatIfValues, setWhatIfValues] = useState(null);
  const [tornadoResult, setTornadoResult] = useState(null);
  const [reverseTarget, setReverseTarget] = useState(15);
  const [reverseResult, setReverseResult] = useState(null);
  const [tornadoBusy, setTornadoBusy] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [whatIfBusy, setWhatIfBusy] = useState(false);
  const toast = useToast();
  const tickers = tickerText.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
  const scenario = scenarios.find((s) => s.scenario_id === selected);

  const loadHistory = () =>
    fetch('/v1/stress?limit=15').then((r) => r.json()).then((b) => setHistory(b.items ?? [])).catch(() => {});

  useEffect(() => {
    fetch('/v1/scenarios').then((r) => r.json()).then((b) => {
      setScenarios(b.items ?? []);
      setSelected(b.items?.[0]?.scenario_id ?? '');
    }).catch((e) => setError(e.message));
    fetch('/v1/portfolio').then((r) => r.json()).then(setPortfolio).catch(() => {});
    loadHistory();
  }, []);

  useEffect(() => { if (scenario) setWhatIfValues(scenario.shocks); }, [scenario?.scenario_id]);
  useEffect(() => { if (stress) { setShown(stress); loadHistory(); } }, [stress]);

  async function runManual() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/v1/stress/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario_id: selected, tickers }) });
      if (!r.ok) throw new Error(`${r.status}`);
      const run = await r.json();
      setShown(run); setStress(run); loadHistory();
      toast('Stress test completed.');
    } catch (e) { setError(e.message); toast(e.message, 'error'); }
    finally { setBusy(false); }
  }

  async function runWhatIf() {
    setWhatIfBusy(true); setError('');
    try {
      const r = await fetch('/v1/stress/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario_id: selected, shocks: whatIfValues, tickers }) });
      if (!r.ok) throw new Error(`${r.status}`);
      const run = await r.json();
      setShown(run); setStress(run); loadHistory();
      toast('What-if run completed.');
    } catch (e) { toast(e.message, 'error'); }
    finally { setWhatIfBusy(false); }
  }

  async function runTornado() {
    setTornadoBusy(true); setTornadoResult(null);
    try {
      const r = await fetch('/v1/stress/sensitivity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario_id: selected, tickers }) });
      if (!r.ok) throw new Error(`${r.status}`);
      setTornadoResult(await r.json());
    } catch (e) { toast(e.message, 'error'); }
    finally { setTornadoBusy(false); }
  }

  async function runReverse() {
    setReverseBusy(true); setReverseResult(null);
    try {
      const r = await fetch('/v1/stress/reverse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario_id: selected, target_loss_pct: Number(reverseTarget), tickers }) });
      if (!r.ok) throw new Error(`${r.status}`);
      setReverseResult(await r.json());
    } catch (e) { toast(e.message, 'error'); }
    finally { setReverseBusy(false); }
  }

  return (
    <>
      <div className="page-header">
        <h1>Stress test</h1>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="card-header"><span className="card-title">Run scenario</span></div>
        <div className="input-group">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Scenario" style={{ flex: 1, maxWidth: 280 }}>
            {scenarios.map((s) => <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>)}
          </select>
          <input
            placeholder="Affected tickers, e.g. JPM, GS"
            value={tickerText}
            onChange={(e) => setTickerText(e.target.value)}
            style={{ flex: 1, maxWidth: 260 }}
            aria-label="Affected tickers"
          />
          <button className="btn-primary btn" onClick={runManual} disabled={busy || !selected}>
            {busy ? 'Running…' : 'Run stress test'}
          </button>
        </div>
        {error && <div className="error-state" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      {/* History picker */}
      {history.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="muted small">History</span>
          <select
            value={shown?.run_id ?? ''}
            onChange={(e) => setShown(history.find((r) => r.run_id === e.target.value))}
            aria-label="Earlier stress runs"
            style={{ flex: 1, maxWidth: 380 }}
          >
            {history.map((r) => <option key={r.run_id} value={r.run_id}>{descRun(r)}</option>)}
          </select>
        </div>
      )}

      {shown ? (
        <>
          {/* Result KPIs */}
          <div className="stress-values">
            <div className="stress-value-card">
              <div className="stress-value-label">Portfolio before</div>
              <div className="stress-value-num">{moneyFmt.format(shown.value_before)}</div>
            </div>
            <div className="stress-value-card">
              <div className="stress-value-label">Portfolio after</div>
              <div className="stress-value-num">{moneyFmt.format(shown.value_after)}</div>
            </div>
            {shown.risk && (
              <>
                <div className="stress-value-card">
                  <div className="stress-value-label">VaR 95%</div>
                  <div className="stress-value-num neg">{moneyFmt.format(-shown.risk.var_95)}</div>
                </div>
                <div className="stress-value-card">
                  <div className="stress-value-label">ES 95%</div>
                  <div className="stress-value-num neg">{moneyFmt.format(-shown.risk.es_95)}</div>
                </div>
              </>
            )}
            <div className="stress-value-card">
              <div className="stress-value-label">Estimated loss</div>
              <div className={`stress-value-num ${shown.loss < 0 ? 'neg' : 'pos'}`}>
                {shown.loss < 0 ? '▼' : '▲'} {moneyFmt.format(Math.abs(shown.loss))}
              </div>
            </div>
          </div>

          {/* Scenario info */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{shown.scenario.name}</span>
              {!shown.trigger.manual && (
                <Pill status="running">Event-triggered</Pill>
              )}
            </div>
            {!shown.trigger.manual ? (
              <p style={{ fontSize: 13 }}>
                <strong>{shown.trigger.event_type}</strong> detected &middot; Impact {shown.trigger.impact?.toFixed(1)} &middot; Confidence {Math.round((shown.trigger.confidence ?? 0) * 100)}%
                {shown.trigger.evidence && <span className="muted"> &middot; {shown.trigger.evidence}</span>}
              </p>
            ) : (
              <p className="muted small">{shown.trigger.what_if ? 'Started from what-if controls.' : 'Started manually.'}</p>
            )}
            {shown.scale !== undefined && shown.scale !== 1 && (
              <p className="muted small" style={{ marginTop: 6 }}>Applied at {shown.scale}x of the scenario shocks, scaled by event impact and confidence.</p>
            )}
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><span className="card-title">Loss by asset class</span></div>
              <LossChart byAssetClass={shown.by_asset_class} />
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Exposure donut</span></div>
              <ExposureDonut exposure={shown.exposure ?? portfolio?.exposure} />
            </div>
          </div>

          <ClassTable run={shown} />

          {shown.contagion?.epicenter?.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Contagion</span></div>
              <p className="muted small" style={{ marginBottom: 8 }}>
                Epicenter: {shown.contagion.epicenter.join(', ')} &middot; {shown.contagion.positions_amplified} positions amplified &middot; extra loss {moneyFmt.format(Math.abs(shown.contagion.extra_loss))}
              </p>
              {shown.contagion.affected.map((a) => (
                <div key={a.node} className="bar-row" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', width: 160, flexShrink: 0 }}>{a.node.replace('sector:', 'Sector ')}</span>
                  <div className="bar-track" style={{ flex: 1 }}>
                    <div className="bar-fill" style={{ width: `${a.exposure * 100}%` }} />
                  </div>
                  <span className="small" style={{ width: 40, textAlign: 'right' }}>{Math.round(a.exposure * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        portfolio && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Portfolio</span>
              <span className="card-muted">{portfolio.positions} positions &middot; {moneyFmt.format(portfolio.total_value)}</span>
            </div>
            <ExposureDonut exposure={portfolio.exposure} />
            <div style={{ marginTop: 16 }}>
              <ClassTable exposure={portfolio.exposure} />
            </div>
          </div>
        )
      )}

      {/* Tools */}
      {scenario && whatIfValues && (
        <div className="grid-2">
          {/* What-if */}
          <div className="card">
            <div className="card-header"><span className="card-title">What-if sliders</span></div>
            <p className="muted small" style={{ marginBottom: 12 }}>Set custom shocks and reprice the portfolio.</p>
            {FACTORS.map((f) => {
              const limit = Math.max(Math.abs(scenario.shocks[f.key]) * 2, f.span / 2);
              return (
                <div key={f.key} className="slider-row" style={{ marginBottom: 8 }}>
                  <label className="muted" style={{ fontSize: 12 }}>{f.label}</label>
                  <input
                    type="range" min={-limit} max={limit} step={f.step}
                    value={whatIfValues[f.key]}
                    onChange={(e) => setWhatIfValues({ ...whatIfValues, [f.key]: Number(e.target.value) })}
                  />
                  <span className="slider-output">
                    {whatIfValues[f.key] > 0 ? '+' : ''}{whatIfValues[f.key]} {f.unit}
                  </span>
                </div>
              );
            })}
            <button className="btn-primary btn" onClick={runWhatIf} disabled={whatIfBusy} style={{ marginTop: 8 }}>
              {whatIfBusy ? 'Running…' : 'Run what-if'}
            </button>
          </div>

          {/* Tornado */}
          <div className="card">
            <div className="card-header"><span className="card-title">Sensitivity tornado</span></div>
            <p className="muted small" style={{ marginBottom: 12 }}>Portfolio change when each shock is halved or increased by half.</p>
            <button className="btn btn-sm" onClick={runTornado} disabled={tornadoBusy}>
              {tornadoBusy ? 'Running…' : 'Run sensitivity'}
            </button>
            {tornadoResult && (
              <div style={{ marginTop: 12 }}>
                <TornadoChart factors={tornadoResult.factors} />
                <p className="muted small" style={{ marginTop: 8 }}>Base change: {moneyFmt.format(tornadoResult.base_change)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reverse stress */}
      {scenario && (
        <div className="card">
          <div className="card-header"><span className="card-title">Reverse stress test</span></div>
          <p className="muted small" style={{ marginBottom: 12 }}>How severe would this scenario need to be to cost the portfolio a chosen percentage?</p>
          <div className="input-group">
            <input type="number" min="1" max="100" value={reverseTarget} onChange={(e) => setReverseTarget(e.target.value)} style={{ width: 80 }} aria-label="Target loss %" />
            <span className="muted">% loss</span>
            <button className="btn btn-sm" onClick={runReverse} disabled={reverseBusy || !reverseTarget}>
              {reverseBusy ? 'Running…' : 'Find shock multiplier'}
            </button>
          </div>
          {reverseResult && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              {reverseResult.reachable ? (
                <>
                  <p>Needs <strong>{reverseResult.scale}x</strong> the scenario shocks for a <strong>{Math.abs(reverseResult.loss_pct)}%</strong> ({moneyFmt.format(Math.abs(reverseResult.loss))}) loss.</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {FACTORS.map((f) => (
                      <li key={f.key} className="muted small">
                        {f.label}: {reverseResult.shocks[f.key] > 0 ? '+' : ''}{reverseResult.shocks[f.key]} {f.unit}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">Not reachable: even at {reverseResult.max_scale_tested}x the loss is only {reverseResult.loss_pct_at_max}%.</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
