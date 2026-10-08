import React, { useState } from 'react';
import EvaluationPanel from './components/EvaluationPanel.jsx';
import EventTimeline from './components/EventTimeline.jsx';
import LivePage from './components/LivePage.jsx';
import ReplayPanel from './components/ReplayPanel.jsx';
import ReviewPanel from './components/ReviewPanel.jsx';
import StressPanel from './components/StressPanel.jsx';
import SystemPanel from './components/SystemPanel.jsx';
import { useLiveFeed } from './api/useLiveFeed.js';

const TABS = ['Live', 'Events', 'Stress', 'Review', 'Replay', 'System', 'Evaluation'];

export default function App() {
  const [tab, setTab] = useState('Live');
  const [filters, setFilters] = useState({ ticker: '', eventType: '', minImpact: '' });
  const { signals, stress, setStress, status } = useLiveFeed(filters);

  return (
    <main>
      <header>
        <h1>RiskPulse</h1>
        <span className={`status ${status}`}>{status}</span>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'tab active' : 'tab'}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'Live' && <LivePage signals={signals} filters={filters} setFilters={setFilters} />}
      {tab === 'Events' && (
        <section aria-label="Events">
          <h2>Events</h2>
          <EventTimeline />
        </section>
      )}
      {tab === 'Stress' && <StressPanel stress={stress} onRun={setStress} />}
      {tab === 'Review' && <ReviewPanel />}
      {tab === 'Replay' && <ReplayPanel />}
      {tab === 'System' && <SystemPanel />}
      {tab === 'Evaluation' && <EvaluationPanel />}
    </main>
  );
}
