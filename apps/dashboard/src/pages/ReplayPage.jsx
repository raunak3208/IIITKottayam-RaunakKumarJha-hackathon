import React, { useState } from 'react';
import { EmptyState, ErrorState } from '../components/ui.jsx';
import { usePolling } from '../api/usePolling.js';
import { useToast } from '../api/toast.jsx';

export default function ReplayPage() {
  const { data, error, reload } = usePolling('/v1/replay', 2000);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState(200);
  const [speed, setSpeed] = useState(10);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function act(path, body, msg) {
    setBusy(true);
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      reload();
      toast(msg);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const state = data?.state;
  const pct = state && state.total > 0 ? (state.sent / state.total) * 100 : 0;

  return (
    <>
      <div className="page-header">
        <h1>Replay</h1>
      </div>
      <p className="muted" style={{ maxWidth: 580 }}>
        Record items collected from live feeds, then replay them through the same pipeline at any speed.
        Makes demos repeatable without waiting for the news cycle.
      </p>

      {error && <ErrorState msg={error} />}

      {/* Record */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Record snapshot</span>
        </div>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Save the latest N items from the raw stream as a named recording.
        </p>
        <div className="input-group">
          <input
            placeholder="Name, e.g. morning-session"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Recording name"
            style={{ flex: 1, maxWidth: 240 }}
          />
          <input
            type="number" min="5" max="2000"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            aria-label="Items to record"
            style={{ width: 90 }}
          />
          <span className="muted small">items</span>
          <button
            className="btn-primary btn"
            disabled={!name || busy}
            onClick={() => act('/v1/replay/record', { name, limit }, `Recorded ${limit} items as "${name}".`)}
          >
            Record
          </button>
        </div>
      </div>

      {/* Recordings list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recordings</span>
          <span className="muted small">Speed</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Replay speed"
            style={{ width: 90 }}
          >
            {[1, 5, 10, 25, 100].map((s) => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>
        </div>

        {data && data.files.length === 0 && (
          <EmptyState
            title="No recordings yet"
            hint='Use "Record snapshot" above to save the current live items. You can then replay them at any speed.'
          />
        )}

        {data?.files.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">Items</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.files.map((f) => (
                  <tr key={f.name}>
                    <td><strong>{f.name}</strong></td>
                    <td className="num muted">{f.items}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-sm"
                        disabled={state?.running || busy}
                        onClick={() => act('/v1/replay/start', { name: f.name, speed }, `Replaying "${f.name}" at ${speed}x.`)}
                      >
                        Replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active replay progress */}
      {state && (state.running || state.sent > 0) && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {state.running ? 'Replaying' : 'Last replay'}: {state.file}
            </span>
            <span className="muted small">{state.speed}x speed</span>
          </div>
          <div className="progress-track" style={{ marginBottom: 8 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="muted small">
              {state.sent} of {state.total} items sent
              {state.error && <span className="neg-text"> · Error: {state.error}</span>}
            </span>
            {state.running && (
              <button
                className="btn btn-sm"
                onClick={() => act('/v1/replay/stop', {}, 'Replay stopped.')}
              >
                Stop
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
