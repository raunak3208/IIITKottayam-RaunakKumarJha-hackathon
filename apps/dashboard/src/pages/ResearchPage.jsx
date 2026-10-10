import React, { useState } from 'react';
import { Pill } from '../components/ui.jsx';
import { ARCHIVE_DOSSIERS, PRESET_TOPICS, runAriaPipeline } from '../api/aria.js';
import { useToast } from '../api/toast.jsx';

export default function ResearchPage({ setPage }) {
  const [topic, setTopic] = useState('');
  const [running, setRunning] = useState(false);
  const [activeNode, setActiveNode] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [currentDossier, setCurrentDossier] = useState(ARCHIVE_DOSSIERS[0]);
  const [history, setHistory] = useState(ARCHIVE_DOSSIERS);
  const toast = useToast();

  const handleStartResearch = async (selectedTopic) => {
    const query = selectedTopic || topic;
    if (!query.trim() || running) return;

    setRunning(true);
    setActiveNode('search');
    setTelemetry([`[00:00] Initializing ARIA Multi-Agent Orchestrator for topic: "${query.slice(0, 60)}"`]);

    try {
      const result = await runAriaPipeline(query, (event) => {
        setActiveNode(event.node);
        setTelemetry((prev) => [
          ...prev,
          `[Agent: ${event.agent}] ${event.message}`,
        ]);
        if (event.node === 'done' && event.dossier) {
          setCurrentDossier(event.dossier);
          setHistory((prev) => [event.dossier, ...prev.filter((d) => d.id !== event.dossier.id)]);
          toast.add('ARIA Research complete — Dossier finalized');
        }
      });
    } catch (err) {
      toast.add(`Research failed: ${err.message}`);
    } finally {
      setRunning(false);
      setActiveNode(null);
    }
  };

  const copyDossier = () => {
    if (!currentDossier) return;
    const text = `
# ${currentDossier.report.title}
Topic: ${currentDossier.topic}
Date: ${currentDossier.timestamp}
Critic Score: ${currentDossier.feedback.score}/10 — ${currentDossier.feedback.verdict}

## Executive Summary
${currentDossier.report.summary}

## Key Findings
${currentDossier.report.findings.map((f) => `- ${f}`).join('\n')}

## Deep Analysis
${currentDossier.report.analysis}

## Sources
${currentDossier.report.sources.map((s) => `- ${s.title} (${s.url})`).join('\n')}
    `.trim();

    navigator.clipboard?.writeText(text);
    toast.add('Dossier copied to clipboard');
  };

  const agents = [
    { id: 'search', num: '01', name: 'Search Agent', role: 'Real-Time Wire & News Scan', desc: 'Discovers verified news wires, SEC 8-K filings, and regulatory transcripts.' },
    { id: 'read', num: '02', name: 'Reader Agent', role: 'Primary Disclosure Scraping', desc: 'Extracts full document text, balance sheet footnotes, and counter-evidence.' },
    { id: 'write', num: '03', name: 'Writer Chain', role: 'Executive Structured Synthesis', desc: 'Drafts executive summary, empirical findings, and transmission analysis.' },
    { id: 'critic', num: '04', name: 'Critic Chain', role: 'Adversarial Verification', desc: 'Strict factual audit scoring validity out of 10 with approval verdict.' },
  ];

  return (
    <div className="aria-studio-wrap">
      {/* ── Page Header ── */}
      <div className="aria-banner-header">
        <div>
          <div className="aria-banner-title">
            <span>ARIA Research Studio</span>
            <span className="aria-banner-badge">Autonomous Multi-Agent</span>
          </div>
          <p className="muted small" style={{ marginTop: 4 }}>
            Four-agent autonomous intelligence pipeline with adversarial critic verification and primary source citations
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={copyDossier}>
            Copy Dossier
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleStartResearch(PRESET_TOPICS[0].title)}
            disabled={running}
          >
            {running ? 'Running Agents...' : 'Run Quick Demo →'}
          </button>
        </div>
      </div>

      {/* ── Research Control Panel ── */}
      <div className="aria-search-card">
        <div className="aria-search-input-row">
          <input
            type="text"
            className="aria-search-input"
            placeholder="Enter research topic, ticker or macro theme (e.g., 'Commercial Real Estate Debt Maturity Wall')..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStartResearch()}
            disabled={running}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleStartResearch()}
            disabled={running || !topic.trim()}
            style={{ minWidth: 180, whiteSpace: 'nowrap' }}
          >
            {running ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="telemetry-spinner" style={{ width: 14, height: 14 }} />
                Running...
              </span>
            ) : (
              'Run Autonomous Research'
            )}
          </button>
        </div>

        <div className="aria-topics-row">
          <span className="aria-block-label" style={{ margin: 0, marginRight: 4 }}>Suggested Themes:</span>
          {PRESET_TOPICS.map((pt) => (
            <button
              key={pt.id}
              className={`aria-topic-chip ${topic === pt.title ? 'active' : ''}`}
              onClick={() => {
                setTopic(pt.title);
                handleStartResearch(pt.title);
              }}
              disabled={running}
            >
              <span>{pt.category}:</span>
              <strong>{pt.title.split(' & ')[0].slice(0, 36)}</strong>
            </button>
          ))}
        </div>
      </div>

      {/* ── 4-Agent Pipeline Workflow Stepper ── */}
      <div className="aria-stepper-bar">
        {agents.map((ag) => {
          const isActive = activeNode === ag.id;
          const isDone = activeNode === 'done' || (activeNode === 'critic' && ag.id !== 'critic');
          return (
            <div
              key={ag.id}
              className={`aria-stepper-node ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
            >
              <div className="aria-stepper-top">
                <span className="aria-stepper-index">{ag.num} · {ag.name}</span>
                <span className={`aria-stepper-status ${isActive ? 'running' : isDone ? 'done' : 'idle'}`}>
                  {isActive ? 'ACTIVE' : isDone ? 'DONE' : 'IDLE'}
                </span>
              </div>
              <div className="aria-stepper-name">{ag.role}</div>
              <div className="aria-stepper-desc">{ag.desc}</div>
            </div>
          );
        })}
      </div>

      {/* ── Real-Time Status / Telemetry Stream ── */}
      {telemetry.length > 0 && (
        <div>
          <div className="aria-telemetry-strip">
            <div className="aria-telemetry-msg">
              {running && <span className="telemetry-spinner" style={{ width: 12, height: 12, flexShrink: 0 }} />}
              <span style={{ color: 'var(--pos)', fontWeight: 600 }}>[Live Pipeline]</span>
              <span>{telemetry[telemetry.length - 1]}</span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowLogs(!showLogs)}
              style={{ fontSize: 11, padding: '2px 8px', height: 'auto', whiteSpace: 'nowrap' }}
            >
              {showLogs ? 'Hide Logs ▲' : `View Full Log (${telemetry.length}) ▼`}
            </button>
          </div>

          {showLogs && (
            <div style={{
              background: '#080b0f',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 12,
              marginTop: 6,
              maxHeight: 140,
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#9cb0c4',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              {telemetry.map((t, idx) => (
                <div key={idx} style={{ color: t.includes('Critic') ? 'var(--pos)' : t.includes('Error') ? 'var(--neg)' : undefined }}>
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main Research Dossier & History Grid ── */}
      <div className="aria-main-grid">
        {/* Left: Primary Dossier Memo */}
        {currentDossier ? (
          <div className="aria-dossier-paper">
            {/* Header info */}
            <div className="aria-dossier-title-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Pill status="ok">VERIFIED DOSSIER</Pill>
                <span className="mono muted small">{currentDossier.id}</span>
                <span className="muted small">·</span>
                <span className="muted small">{new Date(currentDossier.timestamp).toLocaleDateString()}</span>
                <span className="muted small">·</span>
                <span className="mono text-muted small">{currentDossier.topic}</span>
              </div>
              <h1 className="aria-dossier-h1">{currentDossier.report.title}</h1>
            </div>

            {/* Adversarial Critic Verification Banner - Strictly horizontal score */}
            <div className="aria-critic-banner">
              <div className="aria-critic-score-box">
                <span className="aria-critic-val">{currentDossier.feedback.score}</span>
                <span className="aria-critic-denom">/ 10</span>
              </div>

              <div className="aria-critic-text">
                <div className="aria-critic-verdict-line">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Critic Verification: {currentDossier.feedback.verdict}</span>
                </div>
                <div className="aria-critic-review-quote">
                  "{currentDossier.feedback.review}"
                </div>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={copyDossier}
                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                title="Copy entire research brief as formatted Markdown"
              >
                Copy Markdown
              </button>
            </div>

            {/* Executive Summary */}
            <div>
              <div className="aria-block-label">Executive Summary</div>
              <div className="aria-summary-box">
                {currentDossier.report.summary}
              </div>
            </div>

            {/* Key Empirical Findings */}
            <div>
              <div className="aria-block-label">
                Key Empirical Findings ({currentDossier.report.findings.length} Evidence Points)
              </div>
              <div>
                {currentDossier.report.findings.map((finding, idx) => (
                  <div key={idx} className="aria-finding-item">
                    <span className="aria-finding-num">0{idx + 1}</span>
                    <span className="aria-finding-body">{finding}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deep Quantitative Analysis */}
            <div>
              <div className="aria-block-label">Deep Quantitative Analysis &amp; Transmission Mechanism</div>
              <div className="aria-analysis-card">
                {currentDossier.report.analysis}
              </div>
            </div>

            {/* Primary Sources Cited */}
            <div>
              <div className="aria-block-label">Verified Primary Disclosures &amp; Wire Sources</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {currentDossier.report.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="aria-source-link"
                  >
                    <span>{src.title}</span>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M3 9L9 3M9 3H5M9 3V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Footer Action Bar */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setPage('stress')}>
                Stress Test Portfolio on this Theme →
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage('events')}>
                View Clustered Market Events →
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <p className="muted">No dossier loaded. Select an institutional topic above or click Run Quick Demo.</p>
          </div>
        )}

        {/* Right: Dossier Archives */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ fontSize: 13 }}>Research Archive</span>
            <span className="mono muted small">{history.length} Saved</span>
          </div>

          {history.map((d) => {
            const isSelected = currentDossier?.id === d.id;
            return (
              <div
                key={d.id}
                className={`aria-archive-item ${isSelected ? 'active' : ''}`}
                onClick={() => setCurrentDossier(d)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono muted small">{d.id}</span>
                  <span className="aria-archive-score-pill">{d.feedback.score} / 10</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>
                  {d.report.title}
                </div>
                <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.topic}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
