import React, { useState } from 'react';
import { useLiveFeed } from './api/useLiveFeed.js';
import { useMeta } from './api/useMeta.js';
import { ToastProvider } from './api/toast.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import SignalsPage from './pages/SignalsPage.jsx';
import EventsPage from './pages/EventsPage.jsx';
import StressPage from './pages/StressPage.jsx';
import ReviewPage from './pages/ReviewPage.jsx';
import ReplayPage from './pages/ReplayPage.jsx';
import SystemPage from './pages/SystemPage.jsx';
import EvaluationPage from './pages/EvaluationPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import ResearchPage from './pages/ResearchPage.jsx';

const NAV = [
  { group: 'Dashboard', items: [
    { id: 'overview', label: 'Overview', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )},
    { id: 'signals', label: 'Signals', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 12L6 7l3 4 2-6 3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )},
    { id: 'events', label: 'Events', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )},
    { id: 'stress', label: 'Stress test', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 13L8 3l5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 9.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )},
  ]},
  { group: 'Operations', items: [
    { id: 'research', label: 'ARIA Research', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )},
    { id: 'review', label: 'Review', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M13 3H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3l2 2 2-2h3a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )},
    { id: 'replay', label: 'Replay', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 3a1 1 0 0 1 1.6-.8l8 5a1 1 0 0 1 0 1.6l-8 5A1 1 0 0 1 3 13V3Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )},
    { id: 'system', label: 'System', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )},
    { id: 'evaluation', label: 'Evaluation', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 3h12M2 7h8M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )},
  ]},
];

function Sidebar({ page, setPage, collapsed, setCollapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Navigation">
      <div
        className="sidebar-brand"
        onClick={() => setPage('landing')}
        style={{ cursor: 'pointer' }}
        title="Return to Landing Page"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect width="20" height="20" rx="4" fill="var(--accent)" />
          <path d="M4 14L8 8l3 5 2-8 3 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {!collapsed && <span className="brand-text">RiskPulse</span>}
        <button
          className="sidebar-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(!collapsed);
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {collapsed
              ? <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M11 7H3M7 3L3 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        </button>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV.map((group) => (
          <div key={group.group} className="nav-group">
            <div className="nav-group-label" aria-hidden="true">{group.group}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                <span className="nav-item-label">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function TopBar({ status, systemData, onSystem, onHome }) {
  const svc = systemData?.services;
  const llmBreaker = svc?.ai?.llm?.breaker ?? '-';
  return (
    <header className="topbar">
      <span className="topbar-title">AI/NLP Risk Intelligence Platform</span>
      <div className="topbar-badges">
        <div className="badge" title={`SSE feed: ${status}`}>
          <span className={`badge-dot ${status}`} />
          <span>Feed: {status}</span>
        </div>
        {svc && (
          <div className="badge" title={`LLM circuit breaker: ${llmBreaker}`}>
            <span className={`badge-dot ${llmBreaker === 'closed' ? 'ok' : 'open'}`} />
            <span>LLM: {llmBreaker}</span>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onHome} aria-label="Go to landing page">
          Website
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onSystem} aria-label="Go to system health">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          System
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const [page, setPage] = useState('landing');
  const [collapsed, setCollapsed] = useState(false);
  const [filters, setFilters] = useState({ ticker: '', eventType: '', minImpact: '' });
  const { signals, stress, setStress, status, systemData } = useLiveFeed(filters);
  const meta = useMeta();

  const pageProps = { signals, stress, setStress, filters, setFilters, meta, setPage };

  if (page === 'landing') {
    return (
      <ToastProvider>
        <LandingPage setPage={setPage} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="main-area">
        <TopBar status={status} systemData={systemData} onSystem={() => setPage('system')} onHome={() => setPage('landing')} />
        <main className="page" id="main-content">
          {page === 'overview' && <OverviewPage {...pageProps} />}
          {page === 'signals' && <SignalsPage {...pageProps} />}
          {page === 'events' && <EventsPage {...pageProps} />}
          {page === 'stress' && <StressPage {...pageProps} />}
          {page === 'research' && <ResearchPage {...pageProps} />}
          {page === 'review' && <ReviewPage meta={meta} />}
          {page === 'replay' && <ReplayPage />}
          {page === 'system' && <SystemPage />}
          {page === 'evaluation' && <EvaluationPage />}
        </main>
      </div>
    </ToastProvider>
  );
}
