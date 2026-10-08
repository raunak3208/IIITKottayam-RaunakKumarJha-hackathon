import React, { useState } from 'react';
import { post } from '../api/http.js';
import { usePolling } from '../api/usePolling.js';

export default function ReplayPanel() {
  const { data, error, reload } = usePolling('/v1/replay', 2000);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState(200);
  const [speed, setSpeed] = useState(10);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');

  async function act(fn, success) {
    setFailure('');
    try {
      await fn();
      setMessage(success);
      reload();
    } catch (err) {
      setFailure(err.message);
    }
  }

  const state = data?.state;

  return (
    <section aria-label="Replay">
      <h2>Replay</h2>
      <p className="muted">
        Record the items collected from the live feeds, then replay them through the same pipeline at any speed. This
        makes a demo repeatable without waiting for the news cycle.
      </p>
      {(error || failure) && <p className="neg-text">{error || failure}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="tool">
        <h3>Record</h3>
        <div className="controls">
          <input placeholder="Name, e.g. morning-session" value={name} onChange={(e) => setName(e.target.value)} aria-label="Replay name" />
          <input type="number" min="5" max="2000" value={limit} onChange={(e) => setLimit(Number(e.target.value))} aria-label="Items to record" />
          <button
            disabled={!name}
            onClick={() => act(() => post('/v1/replay/record', { name, limit }), `Recorded the latest ${limit} items as ${name}.`)}
          >
            Record latest items
          </button>
        </div>
      </div>

      <div className="tool">
        <h3>Recordings</h3>
        <div className="controls">
          <span className="muted">Speed</span>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Replay speed">
            {[1, 5, 10, 25, 100].map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>
        {data && data.files.length === 0 && <p className="empty">No recordings yet.</p>}
        <ul className="plain">
          {data?.files.map((f) => (
            <li key={f.name}>
              <span>
                <strong>{f.name}</strong> <span className="muted">{f.items} items</span>
              </span>
              <button
                disabled={state?.running}
                onClick={() => act(() => post('/v1/replay/start', { name: f.name, speed }), `Replaying ${f.name} at ${speed}x.`)}
              >
                Replay
              </button>
            </li>
          ))}
        </ul>
      </div>

      {state && (state.running || state.sent > 0) && (
        <div className="tool">
          <h3>{state.running ? 'Replaying' : 'Last replay'} {state.file}</h3>
          <progress max={state.total} value={state.sent} />
          <p className="muted">
            {state.sent} of {state.total} items sent at {state.speed}x.
            {state.error && ` Error: ${state.error}`}
          </p>
          {state.running && (
            <button className="secondary" onClick={() => act(() => post('/v1/replay/stop'), 'Replay stopped.')}>
              Stop
            </button>
          )}
        </div>
      )}
    </section>
  );
}
