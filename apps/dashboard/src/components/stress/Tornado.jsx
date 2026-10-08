import React, { useState } from 'react';
import { post } from '../../api/http.js';
import { FACTORS, money, signed } from './format.js';

const label = (key) => FACTORS.find((f) => f.key === key)?.label ?? key;

export default function Tornado({ scenarioId, tickers }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      setResult(await post('/v1/stress/sensitivity', { scenario_id: scenarioId, tickers }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const widest = result
    ? Math.max(...result.factors.flatMap((f) => [Math.abs(f.low_delta), Math.abs(f.high_delta)]), 1)
    : 1;

  return (
    <div className="tool">
      <h3>Sensitivity</h3>
      <p className="muted">Change in portfolio value when each shock is halved or increased by half.</p>
      <button onClick={run} disabled={busy}>
        {busy ? 'Running' : 'Run sensitivity'}
      </button>
      {error && <p className="neg-text">{error}</p>}
      {result && (
        <div className="tornado">
          {result.factors.map((f) => (
            <div key={f.factor} className="tornado-row">
              <span>{label(f.factor)}</span>
              <div className="tornado-bars">
                {[f.low_delta, f.high_delta].map((delta, i) => (
                  <span
                    key={i}
                    className={`tornado-bar ${delta < 0 ? 'neg' : 'pos'}`}
                    style={{ width: `${(Math.abs(delta) / widest) * 45}%`, [delta < 0 ? 'right' : 'left']: '50%' }}
                    title={signed(delta)}
                  />
                ))}
              </div>
              <span className="muted">
                {signed(f.low_delta)} / {signed(f.high_delta)}
              </span>
            </div>
          ))}
          <p className="muted">Base change {money.format(result.base_change)}.</p>
        </div>
      )}
    </div>
  );
}
