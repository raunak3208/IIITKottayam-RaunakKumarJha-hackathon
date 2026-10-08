import React, { useState } from 'react';
import { post } from '../../api/http.js';
import { FACTORS, money, pct } from './format.js';

export default function ReverseStress({ scenarioId, tickers }) {
  const [target, setTarget] = useState(15);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      setResult(await post('/v1/stress/reverse', { scenario_id: scenarioId, target_loss_pct: Number(target), tickers }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool">
      <h3>Reverse stress test</h3>
      <p className="muted">How severe would this scenario have to be to cost the portfolio a chosen share of its value?</p>
      <div className="controls">
        <input
          type="number"
          min="1"
          max="100"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Target loss percent"
        />
        <span className="muted">% loss</span>
        <button onClick={run} disabled={busy || !target}>
          {busy ? 'Running' : 'Find shock'}
        </button>
      </div>
      {error && <p className="neg-text">{error}</p>}
      {result && !result.reachable && (
        <p className="muted">
          Not reachable: even at {result.max_scale_tested}x the scenario the loss is only {result.loss_pct_at_max}%.
        </p>
      )}
      {result?.reachable && (
        <div>
          <p>
            A loss of <strong>{Math.abs(result.loss_pct)}%</strong> ({money.format(Math.abs(result.loss))}) needs{' '}
            <strong>{result.scale}x</strong> the scenario shocks:
          </p>
          <ul>
            {FACTORS.map((f) => (
              <li key={f.key}>
                {f.label}: {f.unit === '%' ? pct(result.shocks[f.key]) : `${result.shocks[f.key] > 0 ? '+' : ''}${result.shocks[f.key]} bp`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
