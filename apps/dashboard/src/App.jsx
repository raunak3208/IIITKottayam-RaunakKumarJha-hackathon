import React from 'react';
import SignalFeed from './components/SignalFeed.jsx';
import StressPanel from './components/StressPanel.jsx';
import { useLiveFeed } from './api/useLiveFeed.js';

export default function App() {
  const { signals, stress, setStress, status } = useLiveFeed();

  const highImpact = signals.filter((s) => s.impact >= 7).length;
  const avgSentiment = signals.length
    ? signals.reduce((sum, s) => sum + s.sentiment, 0) / signals.length
    : 0;

  return (
    <main>
      <header>
        <h1>RiskPulse</h1>
        <span className={`status ${status}`}>{status}</span>
      </header>

      <section className="summary" aria-label="Summary">
        <div>
          <strong>{signals.length}</strong>
          <span>signals in view</span>
        </div>
        <div>
          <strong>{highImpact}</strong>
          <span>with impact 7 or above</span>
        </div>
        <div>
          <strong>{avgSentiment.toFixed(2)}</strong>
          <span>average sentiment</span>
        </div>
      </section>

      <StressPanel stress={stress} onRun={setStress} />

      <section aria-label="Signal feed" className="feed">
        <h2>Signal feed</h2>
        <SignalFeed signals={signals} />
      </section>
    </main>
  );
}
