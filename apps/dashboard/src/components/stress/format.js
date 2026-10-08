export const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

export const signed = (value) => `${value > 0 ? '+' : ''}${money.format(value)}`;
export const bp = (value) => `${value > 0 ? '+' : ''}${value} bp`;
export const pct = (value) => `${value > 0 ? '+' : ''}${value}%`;

export const FACTORS = [
  { key: 'equity_pct', label: 'Equities', unit: '%', step: 0.5, span: 20 },
  { key: 'rate_bp', label: 'Interest rates', unit: 'bp', step: 5, span: 300 },
  { key: 'credit_spread_bp', label: 'Credit spreads', unit: 'bp', step: 5, span: 300 },
  { key: 'fx_pct', label: 'FX', unit: '%', step: 0.5, span: 10 },
];
