import React from 'react';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

export default function DossierView({ dossier, onClose }) {
  return (
    <div className="dossier">
      <div className="panel-head">
        <h3>Event dossier</h3>
        <button onClick={onClose}>Close</button>
      </div>
      <p className="muted">
        Status {dossier.status}. Confidence {Math.round(dossier.confidence * 100)}%.
      </p>
      <p>{dossier.summary}</p>

      {dossier.claims.length > 0 && (
        <>
          <h4>Claims and evidence</h4>
          <ul>
            {dossier.claims.map((c, i) => (
              <li key={i}>
                {c.text}
                {c.evidence.map((e, j) =>
                  e.url ? (
                    <a key={j} href={e.url} target="_blank" rel="noreferrer">
                      {' '}
                      source
                    </a>
                  ) : null,
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {dossier.counter_evidence?.length > 0 && (
        <>
          <h4>Counter evidence</h4>
          <ul>
            {dossier.counter_evidence.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}

      {dossier.analogs?.length > 0 && (
        <>
          <h4>Historical analogs</h4>
          <ul>
            {dossier.analogs.map((a, i) => (
              <li key={i}>
                {a.date} {a.title}
                {a.reaction_pct !== undefined && ` (${a.reaction_pct > 0 ? '+' : ''}${a.reaction_pct}% next day)`}
              </li>
            ))}
          </ul>
        </>
      )}

      {dossier.stress && (
        <p>
          Illustrative stress ({dossier.stress.scenario_id}): portfolio {money.format(dossier.stress.value_before)}{' '}
          to {money.format(dossier.stress.value_after)}.
        </p>
      )}
    </div>
  );
}
