/** Number formatting for the whole UI: one place, consistent units. Owner: Track C. */

export const num = (n: number, digits = 0): string =>
  Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : 'n/a';

export const kg = (n: number): string => `${num(n, n < 10 && n % 1 !== 0 ? 1 : 0)} kg`;

export const watts = (n: number): string => (Math.abs(n) >= 10_000 ? `${num(n / 1000, 1)} kW` : `${num(n)} W`);

export const wattHours = (n: number): string => (Math.abs(n) >= 1000 ? `${num(n / 1000, 1)} kWh` : `${num(n)} Wh`);

/** Data rate, auto-scaling kbps → Mbps. */
export const rate = (kbps: number): string => {
  if (kbps >= 1000) return `${num(kbps / 1000, kbps >= 10_000 ? 0 : 1)} Mbps`;
  if (kbps >= 10) return `${num(kbps)} kbps`;
  return `${num(kbps, 1)} kbps`;
};

/** Data volume in gigabits (the engine's unit). */
export const gigabits = (n: number): string => {
  if (n >= 1000) return `${num(n / 1000, 1)} Tb`;
  if (n >= 10) return `${num(n)} Gb`;
  return `${num(n, n >= 1 ? 1 : 2)} Gb`;
};

/** Money in millions of dollars. */
export const money = (m: number): string => {
  const sign = m < 0 ? '−' : '';
  const a = Math.abs(m);
  if (a >= 1000) return `${sign}$${num(a / 1000, 2)}B`;
  return `${sign}$${num(a, a < 10 && a % 1 !== 0 ? 1 : 0)}M`;
};

export const pct = (n: number, digits = 0): string => `${num(n, digits)}%`;

/** Margin with an explicit sign; huge margins are capped so they stay readable. */
export const signedPct = (n: number): string => {
  if (!Number.isFinite(n)) return 'n/a';
  if (n > 999) return '+999%';
  return `${n >= 0 ? '+' : '−'}${num(Math.abs(n))}%`;
};

export const signed = (n: number, digits = 0): string => `${n >= 0 ? '+' : '−'}${num(Math.abs(n), digits)}`;

export const deltaV = (ms: number): string => (ms >= 1000 ? `${num(ms / 1000, 2)} km/s` : `${num(ms)} m/s`);

export const km = (n: number): string => `${num(n)} km`;

export const au = (n: number): string => `${num(n, 2)} AU`;

const DATE = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
export const date = (iso: string): string => {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : DATE.format(d);
};

/** "220 days" or "4.9 years": travel and mission times. */
export const duration = (days: number): string => {
  if (days < 60) return `${num(days)} days`;
  if (days < 550) return `${num(days / 30.44)} months`;
  return `${num(days / 365.25, 1)} years`;
};

export const years = (n: number): string => `${num(n, n % 1 === 0 ? 0 : 1)} ${n === 1 ? 'year' : 'years'}`;
