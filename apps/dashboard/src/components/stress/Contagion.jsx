import React from 'react';
import { money } from './format.js';

export default function Contagion({ contagion }) {
  if (!contagion?.epicenter.length) {
    return <p className="muted">No contagion applied: no affected company or sector was identified.</p>;
  }
  return (
    <div className="contagion">
      <p className="muted">
        Epicenter {contagion.epicenter.join(', ')}. {contagion.positions_amplified} positions amplified, adding{' '}
        {money.format(Math.abs(contagion.extra_loss))} of loss.
      </p>
      <ul>
        {contagion.affected.map((a) => (
          <li key={a.node}>
            <span>{a.node.replace('sector:', 'Sector ')}</span>
            <span className="bar">
              <span className="bar-fill" style={{ width: `${a.exposure * 100}%` }} />
            </span>
            <span className="bar-label">{Math.round(a.exposure * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
