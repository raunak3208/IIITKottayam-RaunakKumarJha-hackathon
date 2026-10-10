/* shared formatting helpers */

export const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 2,
});

export const moneyFull = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

export const signed = (v) => `${v > 0 ? '+' : ''}${money.format(v)}`;
export const bp = (v) => `${v > 0 ? '+' : ''}${v} bp`;
export const pct = (v) => `${v > 0 ? '+' : ''}${v}%`;
export const fmt2 = (v) => v?.toFixed(2) ?? '-';

export const timeStr = (iso) => new Date(iso).toLocaleTimeString([], { hour12: false });
export const dateStr = (iso) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
export const dtStr = (iso) => `${dateStr(iso)} ${timeStr(iso)}`;

export const impactClass = (v) => v >= 7 ? 'neg' : v >= 4 ? 'warn' : '';
export const sentimentClass = (v) => v > 0.1 ? 'pos' : v < -0.1 ? 'neg' : '';
export const sentimentLabel = (v) => v > 0.15 ? 'positive' : v < -0.15 ? 'negative' : 'neutral';

export const FACTORS = [
  { key: 'equity_pct', label: 'Equities', unit: '%', step: 0.5, span: 20 },
  { key: 'rate_bp', label: 'Interest rates', unit: 'bp', step: 5, span: 300 },
  { key: 'credit_spread_bp', label: 'Credit spreads', unit: 'bp', step: 5, span: 300 },
  { key: 'fx_pct', label: 'FX', unit: '%', step: 0.5, span: 10 },
];
