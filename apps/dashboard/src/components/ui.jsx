import React from 'react';

export function Skeleton({ h = 20, w = '100%', className = '' }) {
  return <div className={`skeleton ${className}`} style={{ height: h, width: w }} />;
}

export function SkeletonRows({ rows = 3, h = 36 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} h={h} />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, hint }) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-state-icon" style={{ fontSize: 32 }}>{icon}</span>}
      <span className="empty-state-title">{title}</span>
      {hint && <span>{hint}</span>}
    </div>
  );
}

export function ErrorState({ msg }) {
  return <div className="error-state">{msg}</div>;
}

export function Pill({ status, children }) {
  return <span className={`pill ${status}`}>{children}</span>;
}

export function StatusDot({ status }) {
  return <span className={`badge-dot ${status}`} />;
}

export function Divider() {
  return <div className="divider" />;
}

export function SentimentBar({ value }) {
  const pct = Math.abs(value) * 50;
  return (
    <div className="sentiment-wrap">
      <div className="sentiment-bar-track">
        <div
          className={`sentiment-bar-fill ${value >= 0 ? 'pos' : 'neg'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`small ${value > 0.1 ? 'pos-text' : value < -0.1 ? 'neg-text' : 'muted'}`}>
        {value > 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

export function ImpactBar({ value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div className="impact-bar-track">
        <div className="impact-bar-fill" style={{ width: `${value * 10}%` }} />
      </div>
      <span className={`small ${value >= 7 ? 'neg-text' : value >= 4 ? 'warn-text' : 'muted'}`}>{value.toFixed(1)}</span>
    </div>
  );
}

export function Modal({ title, children, actions, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div>{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-header">
          <span className="drawer-title">{title}</span>
          <button className="btn-icon btn-ghost" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}

export function FactRow({ label, value, valueClass }) {
  return (
    <div className="fact-row">
      <span className="fact-label">{label}</span>
      <span className={`fact-value ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}

export function BarRow({ label, pct: p, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 100, flexShrink: 0, color: 'var(--muted)' }}>{label}</span>
      <div className="bar-track" style={{ flex: 1 }}>
        <div className="bar-fill" style={{ width: `${p * 100}%` }} />
      </div>
      <span style={{ width: 40, textAlign: 'right' }}>{Math.round(p * 100)}%</span>
      {value !== undefined && <span style={{ color: 'var(--muted)', width: 80, textAlign: 'right' }}>{value}</span>}
    </div>
  );
}
