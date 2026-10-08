import React, { useEffect, useState } from 'react';
import { post } from '../../api/http.js';
import { FACTORS } from './format.js';

export default function WhatIf({ scenario, tickers, onResult }) {
  const [values, setValues] = useState(scenario.shocks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setValues(scenario.shocks), [scenario.scenario_id]);

  async function run() {
    setBusy(true);
    setError('');
    try {
      onResult(await post('/v1/stress/run', { scenario_id: scenario.scenario_id, shocks: values, tickers }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool">
      <h3>What-if</h3>
      <p className="muted">Set your own shocks and reprice the portfolio.</p>
      {FACTORS.map((f) => {
        const limit = Math.max(Math.abs(scenario.shocks[f.key]) * 2, f.span / 2);
        return (
          <label key={f.key} className="slider">
            <span>{f.label}</span>
            <input
              type="range"
              min={-limit}
              max={limit}
              step={f.step}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: Number(e.target.value) })}
            />
            <output>
              {values[f.key] > 0 ? '+' : ''}
              {values[f.key]} {f.unit}
            </output>
          </label>
        );
      })}
      <button onClick={run} disabled={busy}>
        {busy ? 'Running' : 'Run what-if'}
      </button>
      {error && <p className="neg-text">{error}</p>}
    </div>
  );
}
