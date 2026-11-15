/** Green / yellow / red status: always colour plus a distinct icon shape, never colour alone. Owner: Track C. */
import { catalog } from '../../data';
import type { Severity } from '../../types/engine';

/** Colour a metric by the same data-driven thresholds the Review Board uses (src/data/review-rules.json). */
export function severityFor(metric: string, value: number): Severity {
  const rule = catalog.reviewRules.find((r) => r.metric === metric);
  if (!rule || !Number.isFinite(value)) return 'green';
  if (rule.direction === 'min') return value < rule.red ? 'red' : value < rule.yellow ? 'yellow' : 'green';
  return value > rule.red ? 'red' : value > rule.yellow ? 'yellow' : 'green';
}

export const worst = (...s: Severity[]): Severity => (s.includes('red') ? 'red' : s.includes('yellow') ? 'yellow' : 'green');

export const TONE_TEXT: Record<Severity, string> = { green: 'text-go', yellow: 'text-caution', red: 'text-nogo' };
export const TONE_BORDER: Record<Severity, string> = { green: 'border-go', yellow: 'border-caution', red: 'border-nogo' };
export const TONE_WORD: Record<Severity, string> = { green: 'Healthy', yellow: 'Thin', red: 'Failing' };

export function StatusIcon({ severity, size = 16, label }: { severity: Severity; size?: number; label?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, className: `shrink-0 ${TONE_TEXT[severity]}` };
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true };
  if (severity === 'green')
    return (
      <svg {...common} {...a11y}>
        <circle cx="8" cy="8" r="6.2" />
        <path d="M5 8.3l2.1 2.1L11.2 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (severity === 'yellow')
    return (
      <svg {...common} {...a11y}>
        <path d="M8 1.8l6.6 11.7H1.4L8 1.8z" strokeLinejoin="round" />
        <path d="M8 6.2v3.6M8 11.6v.2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common} {...a11y}>
      <path d="M5.3 1.5h5.4l3.8 3.8v5.4l-3.8 3.8H5.3l-3.8-3.8V5.3l3.8-3.8z" strokeLinejoin="round" />
      <path d="M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6" strokeLinecap="round" />
    </svg>
  );
}
