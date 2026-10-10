import React, { useState } from 'react';
import '../landing.css';
import { ARCHIVE_DOSSIERS, PRESET_TOPICS, runAriaPipeline } from '../api/aria.js';

// --- Brand Logo Glyph ---
const LogoIcon = () => (
  <div className="brand-glyph" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M3 13L7 7l3 5 2-8 3 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

// --- Cockpit Event Scenarios ---
// --- Live Intelligence Scenarios ---
const SCENARIOS = [
  {
    id: 'fomc-rate',
    name: 'Monetary Policy Shift',
    title: 'FOMC Liquidity Pivot & Rate Policy',
    eventType: 'Macroeconomic · Monetary Policy Shift',
    tickers: ['SPY', 'QQQ', 'JPM', 'TLT', 'HYG'],
    impact: 8.7,
    impactLabel: 'Severe Market Impact',
    confidence: 94,
    sentiment: -0.82,
    sentimentLabel: 'Strong Negative',
    quote: 'FOMC meeting minutes signal accelerated balance sheet runoff and restrictive liquidity persistence, prompting immediate upward yield pressure.',
    source: 'Federal Reserve Board & Bloomberg Wire',
    analog: 'June 2022 QT Pivot (-3.8% next-day reaction)',
    shockLoss: '-$5,620,000',
    shockPct: '-5.62%',
    postValue: '$94.38M',
    var95: '-$6.24M',
    contagion: 'Banks & Rate-Sensitive Equities',
  },
  {
    id: 'semi-export',
    name: 'Tech Trade Restrictions',
    title: 'Advanced Semiconductor Lithography Export Ban',
    eventType: 'Supply Chain · Geopolitical Tech Friction',
    tickers: ['NVDA', 'TSM', 'ASML', 'AMD', 'INTC'],
    impact: 8.1,
    impactLabel: 'High Market Impact',
    confidence: 91,
    sentiment: -0.74,
    sentimentLabel: 'Negative',
    quote: 'Regulatory restrictions on dual-use extreme ultraviolet sub-assemblies introduce multi-quarter lead time delays across advanced packaging.',
    source: 'BIS Trade Directive & Reuters Tech Wire',
    analog: 'Oct 2022 Export Controls (-4.1% semiconductor reaction)',
    shockLoss: '-$4,810,000',
    shockPct: '-4.81%',
    postValue: '$95.19M',
    var95: '-$5.35M',
    contagion: 'Cloud Infrastructure & Hardware',
  },
  {
    id: 'cre-banking',
    name: 'Commercial Real Estate',
    title: 'Commercial Real Estate Debt Stress',
    eventType: 'Credit Risk · Regional Banking Contagion',
    tickers: ['KRE', 'CBRE', 'JPM', 'BX', 'SPG'],
    impact: 7.8,
    impactLabel: 'Elevated Market Impact',
    confidence: 89,
    sentiment: -0.68,
    sentimentLabel: 'Negative',
    quote: 'Special servicing rates on Tier-2 metropolitan office debt hit 10-year peaks as refinancing hurdles trigger loan maturity extensions.',
    source: 'Trepp CMBS Bulletin & WSJ Banking',
    analog: 'March 2023 Regional Bank Stress (-5.2% KRE reaction)',
    shockLoss: '-$3,920,000',
    shockPct: '-3.92%',
    postValue: '$96.08M',
    var95: '-$4.65M',
    contagion: 'Mid-Cap Financials & REITs',
  },
];

// --- Workflow Stages Visual Transformation Data ---
const WORKFLOW_STAGES = [
  {
    id: 'ingest',
    number: '01',
    name: 'Ingest & Filter',
    summary: 'Continuous ingestion from financial wires, SEC EDGAR 8-K filings, and market discussions into streaming queues with sub-millisecond deduplication.',
    inputCard: {
      badge: 'Live Unstructured Feed',
      source: 'Bloomberg, Reuters & SEC EDGAR',
      headline: 'Fed Minutes: Restrictive policy stance warranted as core inflation proves sticky',
      snippet: 'Officials reiterated commitments to maintain balance sheet contraction until price stability is restored, prompting immediate upward yield pressure.',
      meta: 'Ingested in 18ms · Deduplicated via SHA-256 fingerprint',
    },
    outputCard: {
      badge: 'Sanitized Signal',
      title: 'Deduplicated & Entity-Mapped',
      attributes: [
        { label: 'Extraction Latency', value: '< 380 ms', tone: 'pos' },
        { label: 'Deduplication Status', value: 'Unique (Verified)', tone: 'pos' },
        { label: 'Mapped Tickers', value: '$SPY, $TLT, $JPM', tone: 'neutral' },
        { label: 'Target Pipeline', value: 'FinBERT Sentiment Engine', tone: 'neutral' },
      ],
      actionHint: 'Normalizes messy web feeds into clean, structured risk payloads in real time.',
    },
  },
  {
    id: 'analyze',
    number: '02',
    name: 'Analyze & Classify',
    summary: 'ProsusAI/FinBERT calculates token-level financial sentiment while zero-shot taxonomy classifiers map events across 14 institutional risk categories.',
    inputCard: {
      badge: 'NLP Evaluation Target',
      source: 'Central Bank Policy Wire',
      headline: '"...accelerated balance sheet runoff and restrictive liquidity persistence..."',
      snippet: 'Evaluates subtle monetary nuance, central bank tone, and forward-looking guidance to distinguish true market shocks from benign market noise.',
      meta: 'Tokenized Context Window: 512 tokens',
    },
    outputCard: {
      badge: 'Calibrated NLP Inference',
      title: 'FinBERT Sentiment & Category',
      attributes: [
        { label: 'Sentiment Score', value: '-0.82 (Strong Negative)', tone: 'neg' },
        { label: 'Event Classification', value: 'Monetary Policy Shift', tone: 'neutral' },
        { label: 'Model Confidence', value: '94.2% Calibrated', tone: 'pos' },
        { label: 'Evidence Span', value: 'Balance sheet runoff quote', tone: 'neutral' },
      ],
      actionHint: 'Trained on 50,000+ financial filings for high-precision institutional sentiment.',
    },
  },
  {
    id: 'impact',
    number: '03',
    name: 'Assess Impact & Cluster',
    summary: 'Generates 384-dimensional vector embeddings, searching Postgres/pgvector for historical precedents and multi-source corroboration.',
    inputCard: {
      badge: 'Corroboration Engine',
      source: '5 Independent Financial Wires',
      headline: 'Synchronized cross-validation across Reuters, Bloomberg, and SEC Form 8-K',
      snippet: 'Autonomous clustering groups related news articles into a single coherent event dossier, preventing duplicate alerts and filtering rumors.',
      meta: 'pgvector Cosine Search across 10+ Years of Market History',
    },
    outputCard: {
      badge: 'Corroborated Event Dossier',
      title: 'Multi-Source Cluster Verified',
      attributes: [
        { label: 'Cluster Status', value: 'Confirmed (5 Wires)', tone: 'pos' },
        { label: 'Market Impact Score', value: '8.7 / 10 (Severe)', tone: 'neg' },
        { label: 'Historical Analog', value: 'June 2022 QT Pivot', tone: 'neutral' },
        { label: 'Historical Reaction', value: '-3.8% S&P 500 next day', tone: 'neg' },
      ],
      actionHint: 'Filters social noise and flags genuine systemic events with empirical historical analogs.',
    },
  },
  {
    id: 'stress',
    number: '04',
    name: 'Portfolio Stress Test',
    summary: 'Quant engine executes deterministic factor shocks and 500-run Monte Carlo simulations across synthetic/firm portfolios, computing VaR95.',
    inputCard: {
      badge: 'Quantitative Factor Shock',
      source: 'Institutional Risk Model',
      headline: 'Simulated Macro Factor Shifts: Yields +25 bps, Tech Multiple -6%, Spreads +35 bps',
      snippet: 'Instantaneous multi-factor sensitivity propagation mapped across equities, fixed income, credit, and sector exposures.',
      meta: 'Portfolio Baseline: $100.0M Multi-Asset Institutional Fund',
    },
    outputCard: {
      badge: 'Capital Impact & Contagion',
      title: 'VaR 95% & Sector Transmission',
      attributes: [
        { label: 'Estimated Drawdown', value: '-$5,620,000 (-5.62%)', tone: 'neg' },
        { label: '1-Day VaR (95%)', value: '-$6,240,000', tone: 'neg' },
        { label: 'Epicenter Sector', value: 'Information Tech (0.74x)', tone: 'warn' },
        { label: 'Actionable Rebalancing', value: 'Duration & Tech Hedging', tone: 'pos' },
      ],
      actionHint: 'Empirical contagion matrices project spillover across banking, tech, and cyclical assets.',
    },
  },
];

// --- Stress Testing Scenarios ---
const STRESS_PRESETS = [
  {
    id: 'fomc-shock',
    title: 'Fed Rate Shock (+100 bps)',
    summary: 'Aggressive policy tightening with sharp upward shift in terminal rate expectations.',
    loss: '-$5,820,000',
    lossPct: '-5.82%',
    postValue: '$94,180,000',
    var95: '-$6,940,000',
    equities: -7.4,
    fixedIncome: -4.8,
    commodities: +2.1,
    cash: +0.2,
    epicenter: 'Technology (-7.4%)',
    contagion: '0.74x',
  },
  {
    id: 'tech-drawdown',
    title: 'Tech Multiple Contraction (-15%)',
    summary: 'Compressed growth multiples and reduced AI infrastructure capital expenditure spending.',
    loss: '-$7,420,000',
    lossPct: '-7.42%',
    postValue: '$92,580,000',
    var95: '-$8,650,000',
    equities: -11.2,
    fixedIncome: +1.4,
    commodities: -3.2,
    cash: 0.0,
    epicenter: 'Semiconductors (-14.8%)',
    contagion: '0.68x',
  },
  {
    id: 'energy-shock',
    title: 'Geopolitical Energy Spike (+30%)',
    summary: 'Critical maritime corridor disruption causing crude oil spike and freight surcharges.',
    loss: '-$3,410,000',
    lossPct: '-3.41%',
    postValue: '$96,590,000',
    var95: '-$4,520,000',
    equities: -4.1,
    fixedIncome: -2.9,
    commodities: +12.4,
    cash: 0.0,
    epicenter: 'Transportation & Airlines (-8.9%)',
    contagion: '0.54x',
  },
];

export default function LandingPage({ setPage }) {
  // Scenario state in hero cockpit
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const activeScenario = SCENARIOS[scenarioIdx];

  // Workflow inspector state
  const [activeWorkflowIdx, setActiveWorkflowIdx] = useState(0);
  const activeWorkflow = WORKFLOW_STAGES[activeWorkflowIdx];

  // Stress preset state
  const [stressPresetIdx, setStressPresetIdx] = useState(0);
  const activeStress = STRESS_PRESETS[stressPresetIdx];

  // ARIA Multi-Agent interactive lab state
  const [ariaTopic, setAriaTopic] = useState(PRESET_TOPICS[0].title);
  const [ariaRunning, setAriaRunning] = useState(false);
  const [ariaActiveNode, setAriaActiveNode] = useState(null);
  const [ariaTelemetry, setAriaTelemetry] = useState(null);
  const [ariaDossier, setAriaDossier] = useState(ARCHIVE_DOSSIERS[0]);

  const handleRunAria = async () => {
    if (!ariaTopic.trim() || ariaRunning) return;
    setAriaRunning(true);
    setAriaDossier(null);

    try {
      await runAriaPipeline(ariaTopic, (event) => {
        setAriaActiveNode(event.node);
        setAriaTelemetry(event.message);
        if (event.node === 'done' && event.dossier) {
          setAriaDossier(event.dossier);
        }
      });
    } finally {
      setAriaRunning(false);
      setAriaActiveNode(null);
    }
  };

  return (
    <div className="landing-shell">
      {/* ── Navigation ── */}
      <nav className="landing-navbar" aria-label="Main Navigation">
        <div className="landing-nav-inner">
          <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <LogoIcon />
            <span className="brand-title">RiskPulse</span>
            <div className="brand-badge">
              <span className="brand-badge-dot" />
              <span>LIVE INTEL STREAM</span>
            </div>
          </div>

          <div className="landing-nav-links">
            <a href="#cockpit" className="landing-nav-link">Intelligence Cockpit</a>
            <a href="#workflow" className="landing-nav-link">Pipeline</a>
            <a href="#action" className="landing-nav-link">Case Studies</a>
            <a href="#stress" className="landing-nav-link">Stress Engine</a>
            <a href="#aria" className="landing-nav-link">ARIA Multi-Agent</a>
          </div>

          <div className="landing-nav-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setPage('stress')}>
              Live Stress
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setPage('overview')}>
              Launch Terminal →
            </button>
          </div>
        </div>
      </nav>

      <div className="landing-content">
        {/* ── Hero Section ── */}
        <section className="landing-hero" id="cockpit">
          {/* Left Column: Messaging */}
          <div className="hero-messaging">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-ping" />
              <span>FINANCIAL RISK INTELLIGENCE PLATFORM · SUB-SECOND EXTRACTION</span>
            </div>

            <h1 className="hero-headline">
              See the Risk <br />
              <span className="hero-headline-accent">Before It Hits</span> the Market.
            </h1>

            <p className="hero-subhead">
              RiskPulse transforms fragmented global financial news, regulatory disclosures, and social chatter
              into institutional-grade risk signals. Powered by FinBERT and vector clustering, our engine
              detects emerging threats, quantifies transmission impact, and stress tests portfolio exposures
              before price discovery unfolds.
            </p>

            <div className="hero-cta-group">
              <button className="btn-hero-primary" onClick={() => setPage('overview')}>
                <span>Explore Risk Intelligence</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button className="btn-hero-secondary" onClick={() => setPage('stress')}>
                <span>View Live Analysis</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 13L8 3l5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.5 9.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Institutional Stat Bar */}
            <div className="hero-metric-bar">
              <div className="hero-metric-item">
                <span className="hero-metric-val">240K+</span>
                <span className="hero-metric-lbl">Signals / 24h</span>
              </div>
              <div className="hero-metric-item">
                <span className="hero-metric-val">&lt; 420ms</span>
                <span className="hero-metric-lbl">Extract Latency</span>
              </div>
              <div className="hero-metric-item">
                <span className="hero-metric-val">94.2%</span>
                <span className="hero-metric-lbl">Calibrated Precision</span>
              </div>
              <div className="hero-metric-item">
                <span className="hero-metric-val">14 Sectors</span>
                <span className="hero-metric-lbl">Contagion Matrix</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean, Institutional Live Intelligence Preview Card */}
          <div className="hero-preview-card">
            {/* Top Bar with Clean Scenario Switcher */}
            <div className="preview-topbar">
              <div className="preview-radar-tag">
                <span className="radar-live-dot" />
                <span>LIVE INTEL RADAR · CORROBORATION ENGINE</span>
              </div>

              <div className="preview-scenario-tabs" role="tablist" aria-label="Select Scenario">
                {SCENARIOS.map((s, idx) => (
                  <button
                    key={s.id}
                    className={`preview-tab-btn ${idx === scenarioIdx ? 'active' : ''}`}
                    onClick={() => setScenarioIdx(idx)}
                    role="tab"
                    aria-selected={idx === scenarioIdx}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Preview Card Content */}
            <div className="preview-body">
              {/* Event Header */}
              <div className="preview-event-header">
                <div>
                  <div className="preview-badge-row">
                    <span className="preview-category-badge">{activeScenario.eventType}</span>
                    <span className="preview-confidence-badge">{activeScenario.confidence}% Corroborated</span>
                  </div>
                  <h3 className="preview-event-title">{activeScenario.title}</h3>
                </div>
                <div className="preview-impact-badge">
                  <span className="preview-impact-score">{activeScenario.impact}</span>
                  <span className="preview-impact-label">{activeScenario.impactLabel}</span>
                </div>
              </div>

              {/* Key Insight Summary Quote */}
              <div className="preview-insight-box">
                <div className="preview-insight-quote">“{activeScenario.quote}”</div>
                <div className="preview-insight-source">
                  <span>Source Verification: {activeScenario.source}</span>
                </div>
              </div>

              {/* Key Quantitative Metrics */}
              <div className="preview-metrics-grid">
                <div className="preview-metric-box">
                  <span className="preview-metric-title">NLP Sentiment (FinBERT)</span>
                  <span className="preview-metric-value neg-text">{activeScenario.sentiment.toFixed(2)}</span>
                  <span className="preview-metric-sub">{activeScenario.sentimentLabel}</span>
                </div>
                <div className="preview-metric-box">
                  <span className="preview-metric-title">Simulated Shock</span>
                  <span className="preview-metric-value neg-text">{activeScenario.shockLoss}</span>
                  <span className="preview-metric-sub">{activeScenario.shockPct} on $100M AUM</span>
                </div>
                <div className="preview-metric-box">
                  <span className="preview-metric-title">1-Day VaR (95%)</span>
                  <span className="preview-metric-value neg-text">{activeScenario.var95}</span>
                  <span className="preview-metric-sub">Historical Simulation</span>
                </div>
              </div>

              {/* Impacted Tickers & Spillover */}
              <div className="preview-assets-row">
                <span className="preview-assets-label">Impacted Tickers:</span>
                <div className="preview-assets-chips">
                  {activeScenario.tickers.map((t) => (
                    <span key={t} className="preview-ticker-chip">${t}</span>
                  ))}
                </div>
                <span className="preview-contagion-note">Spillover: {activeScenario.contagion}</span>
              </div>

              {/* Bottom Analog Banner & Direct Action */}
              <div className="preview-footer-strip">
                <div className="preview-analog-info">
                  <span className="analog-icon">⚡</span>
                  <span>Historical Precedent: <strong>{activeScenario.analog}</strong></span>
                </div>
                <button className="btn-preview-action" onClick={() => setPage('overview')}>
                  <span>Open Risk Terminal</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust / Intelligence Strip ── */}
        <section className="capability-strip" aria-label="Core Capabilities">
          <div className="capability-grid">
            <div className="capability-col">
              <span className="cap-number">01 / INGESTION</span>
              <span className="cap-title">Multi-Source Feeds</span>
              <span className="cap-desc">Continuous ingestion of RSS wires, Reddit WSB, and SEC EDGAR 8-K filings with Redis Stream queues.</span>
            </div>
            <div className="capability-col">
              <span className="cap-number">02 / NLP ENSEMBLE</span>
              <span className="cap-title">Event-Driven Signals</span>
              <span className="cap-desc">FinBERT sentiment scoring paired with DeBERTa-v3 zero-shot taxonomy across 14 financial categories.</span>
            </div>
            <div className="capability-col">
              <span className="cap-number">03 / MEMORY GRAPH</span>
              <span className="cap-title">Vector Analogs</span>
              <span className="cap-desc">384-dimensional pgvector cosine indexing to match incoming signals against 10+ years of historical market shocks.</span>
            </div>
            <div className="capability-col">
              <span className="cap-number">04 / QUANTITATIVE</span>
              <span className="cap-title">Portfolio Stress Tests</span>
              <span className="cap-desc">Factor shocks, reverse stress testing, and empirical sector contagion matrices with VaR95 calculation.</span>
            </div>
            <div className="capability-col">
              <span className="cap-number">05 / AGENTIC</span>
              <span className="cap-title">ARIA Research</span>
              <span className="cap-desc">Autonomous 4-agent deep research pipeline (Search, Scrape, Synthesize, Critic) delivering verified dossiers.</span>
            </div>
          </div>
        </section>

        {/* ── Intelligence Workflow ── */}
        <section className="workflow-section" id="workflow">
          <div className="section-header">
            <div className="section-eyebrow">End-to-End Intelligence Workflow</div>
            <h2 className="section-title">From Unstructured Noise to Quantitative Risk.</h2>
            <p className="section-desc">
              Explore how raw headlines and filings transform into structured signals, vector clusters, and downstream portfolio factor shocks.
            </p>
          </div>

          {/* 4 Interactive Pipeline Steps */}
          <div className="workflow-pipeline">
            {WORKFLOW_STAGES.map((s, idx) => (
              <div
                key={s.id}
                className={`workflow-step-card ${idx === activeWorkflowIdx ? 'active' : ''}`}
                onClick={() => setActiveWorkflowIdx(idx)}
              >
                <div className="step-card-num">
                  <span>STAGE {s.number}</span>
                  {idx === activeWorkflowIdx && <span className="mono pos-text">INSPECTING</span>}
                </div>
                <div className="step-card-name">{s.name}</div>
                <div className="step-card-summary">{s.summary}</div>
              </div>
            ))}
          </div>

          {/* Visual Workflow Transformation */}
          <div className="workflow-visual-canvas">
            {/* Left: Unstructured Input Card */}
            <div className="visual-card input-card">
              <div className="visual-card-top">
                <span className="visual-card-pill neutral">{activeWorkflow.inputCard.badge}</span>
                <span className="visual-card-source">{activeWorkflow.inputCard.source}</span>
              </div>
              <h4 className="visual-card-headline">{activeWorkflow.inputCard.headline}</h4>
              <p className="visual-card-desc">{activeWorkflow.inputCard.snippet}</p>
              <div className="visual-card-footer">
                <span className="visual-meta-note">{activeWorkflow.inputCard.meta}</span>
              </div>
            </div>

            {/* Center: Visual Transformation Bridge */}
            <div className="visual-transform-bridge">
              <div className="bridge-line" />
              <div className="bridge-pill">
                <span className="bridge-icon">⚡</span>
                <span className="bridge-label">RiskPulse NLP &amp; Vector Engine</span>
              </div>
              <div className="bridge-line" />
            </div>

            {/* Right: Structured Output Card */}
            <div className="visual-card output-card">
              <div className="visual-card-top">
                <span className="visual-card-pill pos">{activeWorkflow.outputCard.badge}</span>
                <span className="visual-card-title-sm">{activeWorkflow.outputCard.title}</span>
              </div>
              <div className="visual-attr-grid">
                {activeWorkflow.outputCard.attributes.map((attr, i) => (
                  <div key={i} className="visual-attr-item">
                    <span className="visual-attr-label">{attr.label}</span>
                    <span className={`visual-attr-value ${attr.tone === 'neg' ? 'neg-text' : attr.tone === 'pos' ? 'pos-text' : attr.tone === 'warn' ? 'warn-text' : ''}`}>
                      {attr.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="visual-card-footer">
                <span className="visual-hint-text">{activeWorkflow.outputCard.actionHint}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Risk Intelligence in Action ── */}
        <section className="action-section" id="action">
          <div className="section-header">
            <div className="section-eyebrow">Product In Action</div>
            <h2 className="section-title">Anatomy of an Event-Driven Risk Signal.</h2>
            <p className="section-desc">
              See how a real-world macroeconomic announcement is ingested, verified against historical analogs, and applied to portfolio risk parameters.
            </p>
          </div>

          <div className="action-case-grid">
            {/* Step 1: Ingestion & Extraction */}
            <div className="action-card">
              <div className="action-card-header">
                <div className="action-card-step">Step 1 · Signal Extraction</div>
                <div className="action-card-title">Wire Feed Parsing &amp; Entity Span</div>
              </div>
              <div className="wire-text-display">
                "...Federal Reserve chair indicates that{' '}
                <span className="wire-highlight">policy rates will remain restrictive for longer</span>{' '}
                than futures markets currently price, citing{' '}
                <span className="wire-highlight">re-accelerating services inflation</span>{' '}
                and persistent labor market tightness..."
              </div>
              <div className="muted small" style={{ marginBottom: 12 }}>
                <strong>Extracted Entities:</strong> Federal Reserve (Central Bank), Inflation (Macro Factor), Rates (Yield Curve)
              </div>
              <div className="muted small">
                <strong>FinBERT Score:</strong> -0.82 (Negative) · <strong>DeBERTa Confidence:</strong> 94.2%
              </div>
            </div>

            {/* Step 2: Corroboration & Clustering */}
            <div className="action-card">
              <div className="action-card-header">
                <div className="action-card-step">Step 2 · Multi-Source Corroboration</div>
                <div className="action-card-title">Cluster Verification &amp; Noise Filter</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div className="analog-item">
                  <span className="mono">Reuters Newswire</span>
                  <span className="mono pos-text">CORROBORATED</span>
                </div>
                <div className="analog-item">
                  <span className="mono">Bloomberg Terminal</span>
                  <span className="mono pos-text">CORROBORATED</span>
                </div>
                <div className="analog-item">
                  <span className="mono">SEC Form 8-K Disclosures</span>
                  <span className="mono pos-text">CORROBORATED</span>
                </div>
                <div className="analog-item">
                  <span className="mono">Social Chatter (WSB)</span>
                  <span className="mono muted">NOISE FILTERED</span>
                </div>
              </div>
              <div className="muted small">
                Event promoted to <strong>CONFIRMED</strong> status after 3 distinct wire sources validated within a 15-minute rolling window.
              </div>
            </div>

            {/* Step 3: Historical Analogs Matching */}
            <div className="action-card">
              <div className="action-card-header">
                <div className="action-card-step">Step 3 · Historical Precedent Matching</div>
                <div className="action-card-title">Vector Analogs &amp; Market Reaction</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div className="analog-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>June 2022 QT Pivot</div>
                    <div className="muted small">Cosine Sim: 0.892</div>
                  </div>
                  <span className="mono neg-text">-3.8% (1-Day)</span>
                </div>
                <div className="analog-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>Dec 2018 Rate Tantrum</div>
                    <div className="muted small">Cosine Sim: 0.841</div>
                  </div>
                  <span className="mono neg-text">-2.9% (1-Day)</span>
                </div>
                <div className="analog-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>March 2023 SVB Crisis</div>
                    <div className="muted small">Cosine Sim: 0.795</div>
                  </div>
                  <span className="mono neg-text">-4.4% (1-Day)</span>
                </div>
              </div>
              <div className="muted small">
                Quant engine calibrates downstream factor shock based on the weighted mean of top 3 cosine-similar precedents.
              </div>
            </div>
          </div>
        </section>

        {/* ── Portfolio Stress Testing Showcase ── */}
        <section className="stress-section" id="stress">
          <div className="section-header">
            <div className="section-eyebrow">Quant Stress Engine</div>
            <h2 className="section-title">Simulate Portfolio Drawdowns Before They Materialize.</h2>
            <p className="section-desc">
              Run deterministic factor shocks, discover fund breaking points via Reverse Stress Testing, and evaluate cross-sector contagion transmission.
            </p>
          </div>

          <div className="stress-showcase-box">
            {/* Scenario Tabs */}
            <div className="stress-controls-bar">
              <div className="stress-scenario-tabs">
                {STRESS_PRESETS.map((p, idx) => (
                  <button
                    key={p.id}
                    className={`stress-tab-btn ${idx === stressPresetIdx ? 'active' : ''}`}
                    onClick={() => setStressPresetIdx(idx)}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
              <span className="mono muted small">SIMULATED STRESS RUN · BASELINE AUM: $100.0M</span>
            </div>

            <div className="stress-results-grid">
              {/* Left Column: KPI Cards & Asset Breakdown */}
              <div>
                <div className="stress-kpi-row">
                  <div className="stress-kpi-block">
                    <div className="stress-kpi-lbl">Simulated Loss</div>
                    <div className="stress-kpi-num neg">{activeStress.loss}</div>
                    <div className="muted small">{activeStress.lossPct} of portfolio</div>
                  </div>
                  <div className="stress-kpi-block">
                    <div className="stress-kpi-lbl">Post-Shock Value</div>
                    <div className="stress-kpi-num">{activeStress.postValue}</div>
                    <div className="muted small">Remaining Capital</div>
                  </div>
                  <div className="stress-kpi-block">
                    <div className="stress-kpi-lbl">VaR (95% 1-Day)</div>
                    <div className="stress-kpi-num neg">{activeStress.var95}</div>
                    <div className="muted small">Historical Simulation</div>
                  </div>
                </div>

                <div className="panel-label" style={{ marginBottom: 12 }}>
                  <span>Asset Class Allocation Impact</span>
                  <span className="mono text-muted">Delta %</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Equities (45% Allocation)', val: activeStress.equities },
                    { label: 'Fixed Income (35% Allocation)', val: activeStress.fixedIncome },
                    { label: 'Commodities (12% Allocation)', val: activeStress.commodities },
                    { label: 'Cash & Equivalents (8% Allocation)', val: activeStress.cash },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 60px', alignItems: 'center', gap: 12 }}>
                      <span className="small">{row.label}</span>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, position: 'relative' }}>
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            width: `${Math.min(Math.abs(row.val) * 7, 100)}%`,
                            background: row.val < 0 ? 'var(--neg)' : 'var(--pos)',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span className={`mono small ${row.val < 0 ? 'neg-text' : 'pos-text'}`} style={{ textAlign: 'right' }}>
                        {row.val > 0 ? '+' : ''}{row.val.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Contagion Exposure Matrix */}
              <div>
                <div className="panel-label" style={{ marginBottom: 12 }}>
                  <span>Contagion Matrix &amp; Reverse Stress Thresholds</span>
                  <span className="mono pos-text">Epicenter: {activeStress.epicenter}</span>
                </div>

                <table className="sector-matrix-table">
                  <thead>
                    <tr>
                      <th>Sector Node</th>
                      <th>Transmission</th>
                      <th>Max Drawdown</th>
                      <th>Risk Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Information Technology</td>
                      <td className="mono">Epicenter (1.0x)</td>
                      <td className="mono neg-text">-14.8%</td>
                      <td><span className="pill degraded">Severe</span></td>
                    </tr>
                    <tr>
                      <td>Financial Services</td>
                      <td className="mono">0.65x Spillover</td>
                      <td className="mono neg-text">-8.2%</td>
                      <td><span className="pill degraded">High</span></td>
                    </tr>
                    <tr>
                      <td>Consumer Discretionary</td>
                      <td className="mono">0.42x Spillover</td>
                      <td className="mono warn-text">-4.6%</td>
                      <td><span className="pill running">Elevated</span></td>
                    </tr>
                    <tr>
                      <td>Health Care &amp; Utilities</td>
                      <td className="mono">0.08x Defensive</td>
                      <td className="mono pos-text">-0.4%</td>
                      <td><span className="pill ok">Stable</span></td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 14, marginTop: 16 }}>
                  <div className="panel-label">
                    <span>Reverse Stress Testing Breakdown</span>
                    <span className="mono muted">Breakeven Solver</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
                    Target Drawdown: <strong>10.0% ($10M)</strong>. To breach this capital threshold, baseline rates would need to spike by <strong>+182 bps</strong> or tech sector multiples contract by <strong>-22.4%</strong> without hedging rebalancing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── ARIA Multi-Agent Research Section ── */}
        <section className="aria-section" id="aria">
          <div className="section-header">
            <div className="section-eyebrow">Autonomous Multi-Agent Intelligence</div>
            <h2 className="section-title">ARIA Multi-Agent Research Engine.</h2>
            <p className="section-desc">
              Four specialized agents collaborate in real time to ingest news wires, scrape regulatory filings,
              synthesize institutional research dossiers, and execute adversarial critic verification.
            </p>
          </div>

          <div className="aria-hero-box">
            {/* The 4 Agent Architecture Nodes */}
            <div className="aria-agents-row">
              <div className={`agent-node-card ${ariaActiveNode === 'search' ? 'active-node' : ''}`}>
                <div className="agent-node-header">
                  <div className="agent-node-icon">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className="agent-node-role">AGENT 1</span>
                </div>
                <div className="agent-node-title">Search Agent</div>
                <div className="agent-node-desc">Autonomous multi-query scanning of Bloomberg wire, Reuters, and SEC disclosures.</div>
              </div>

              <div className={`agent-node-card ${ariaActiveNode === 'read' ? 'active-node' : ''}`}>
                <div className="agent-node-header">
                  <div className="agent-node-icon">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className="agent-node-role">AGENT 2</span>
                </div>
                <div className="agent-node-title">Reader Agent</div>
                <div className="agent-node-desc">Deep scraping of primary source HTML, earnings calls, and 10-K/8-K regulatory footnotes.</div>
              </div>

              <div className={`agent-node-card ${ariaActiveNode === 'write' ? 'active-node' : ''}`}>
                <div className="agent-node-header">
                  <div className="agent-node-icon">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 13h10M4 10l7-7 2 2-7 7H4v-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="agent-node-role">AGENT 3</span>
                </div>
                <div className="agent-node-title">Writer Chain</div>
                <div className="agent-node-desc">Structured institutional report drafting: executive summary, key findings, and deep impact analysis.</div>
              </div>

              <div className={`agent-node-card ${ariaActiveNode === 'critic' ? 'active-node' : ''}`}>
                <div className="agent-node-header">
                  <div className="agent-node-icon">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M6 8l1.5 1.5L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="agent-node-role">AGENT 4</span>
                </div>
                <div className="agent-node-title">Critic Chain</div>
                <div className="agent-node-desc">Strict adversarial evaluation scoring factual validity out of 10 and generating final approval verdict.</div>
              </div>
            </div>

            {/* Interactive Live ARIA Runner */}
            <div className="aria-runner-card">
              <div className="panel-label" style={{ marginBottom: 12 }}>
                <span>Try the ARIA Research Pipeline Live</span>
                <span className="mono pos-text">AUTONOMOUS MULTI-AGENT</span>
              </div>

              {/* Preset Chips */}
              <div className="aria-preset-chips">
                {PRESET_TOPICS.map((pt) => (
                  <button
                    key={pt.id}
                    className={`aria-chip ${ariaTopic === pt.title ? 'selected' : ''}`}
                    onClick={() => setAriaTopic(pt.title)}
                  >
                    {pt.title}
                  </button>
                ))}
              </div>

              {/* Topic Input Bar */}
              <div className="aria-input-row">
                <input
                  type="text"
                  className="aria-topic-input"
                  value={ariaTopic}
                  onChange={(e) => setAriaTopic(e.target.value)}
                  placeholder="Enter a research topic, ticker, or macro event..."
                  disabled={ariaRunning}
                />
                <button
                  className="btn-run-aria"
                  onClick={handleRunAria}
                  disabled={ariaRunning || !ariaTopic.trim()}
                >
                  {ariaRunning ? (
                    <>
                      <div className="telemetry-spinner" />
                      <span>Running Agents...</span>
                    </>
                  ) : (
                    <>
                      <span>Run ARIA Research</span>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setPage('research')}
                  title="Open full ARIA Research Studio in Dashboard"
                >
                  Open Studio →
                </button>
              </div>

              {/* Telemetry Stream Box */}
              {ariaTelemetry && (
                <div className="aria-telemetry-box">
                  <div className="telemetry-spinner" />
                  <span>{ariaTelemetry}</span>
                </div>
              )}

              {/* Structured Dossier Output */}
              {ariaDossier && (
                <div className="aria-dossier-output">
                  <div className="dossier-header-bar">
                    <div>
                      <div className="muted small mono" style={{ marginBottom: 4 }}>
                        DOSSIER ID: {ariaDossier.id} · GENERATED JUST NOW
                      </div>
                      <div className="dossier-title">{ariaDossier.report.title}</div>
                    </div>

                    <div className="critic-scorecard">
                      <div className="score-badge">
                        <span>{ariaDossier.feedback.score}</span>
                        <span style={{ fontSize: 13, opacity: 0.8, marginLeft: 2 }}>/ 10</span>
                      </div>
                      <div className="critic-verdict-text">
                        <strong>Critic Verdict:</strong> {ariaDossier.feedback.verdict}
                      </div>
                    </div>
                  </div>

                  <div className="dossier-summary-box">
                    <strong>Executive Summary:</strong> {ariaDossier.report.summary}
                  </div>

                  <div className="panel-label" style={{ marginBottom: 10 }}>
                    <span>Key Empirical Findings</span>
                    <span className="mono muted">{ariaDossier.report.findings.length} Points Verified</span>
                  </div>

                  <div className="dossier-findings-list">
                    {ariaDossier.report.findings.map((f, i) => (
                      <div key={i} className="finding-item">
                        <span className="finding-bullet">▪</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 14, marginBottom: 16 }}>
                    <div className="panel-label" style={{ marginBottom: 6 }}>
                      <span>Deep Strategic Analysis</span>
                      <span className="mono pos-text">Synthesis</span>
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: '#c8d4e2', margin: 0 }}>
                      {ariaDossier.report.analysis}
                    </p>
                  </div>

                  <div className="panel-label" style={{ marginBottom: 8 }}>
                    <span>Verified Primary Sources</span>
                    <span className="mono muted">{ariaDossier.report.sources.length} Documents Cited</span>
                  </div>

                  <div className="sources-chips-list">
                    {ariaDossier.report.sources.map((src, i) => (
                      <a key={i} href={src.url} target="_blank" rel="noreferrer" className="source-anchor">
                        <span>{src.title}</span>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M3 9L9 3M9 3H5M9 3V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="landing-cta">
          <div className="cta-frame">
            <h2 className="cta-title">Institutional Financial Risk Intelligence.</h2>
            <p className="cta-subtext">
              Transform unstructured market chatter into quantitative risk signals, run stress tests,
              and execute multi-agent research before price discovery occurs.
            </p>
            <div className="cta-actions">
              <button className="btn-hero-primary" onClick={() => setPage('overview')}>
                <span>Launch RiskPulse Terminal</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button className="btn-hero-secondary" onClick={() => setPage('research')}>
                <span>Launch ARIA Research Studio</span>
              </button>
              <button className="btn-hero-secondary" onClick={() => setPage('stress')}>
                <span>Run Portfolio Stress Run</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogoIcon />
            <span style={{ fontWeight: 700, color: '#fff' }}>RiskPulse</span>
            <span className="muted">· Institutional AI Financial Risk Intelligence</span>
          </div>

          <div className="footer-nav">
            <a href="#cockpit" className="footer-link">Risk Cockpit</a>
            <a href="#workflow" className="footer-link">Workflow</a>
            <a href="#stress" className="footer-link">Stress Engine</a>
            <a href="#aria" className="footer-link">ARIA Multi-Agent</a>
            <span className="mono muted" style={{ fontSize: 11 }}>SYSTEM HEALTH: 100% OPERATIONAL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
