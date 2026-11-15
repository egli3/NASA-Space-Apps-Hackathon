import type { Severity } from '../../types/engine';
import { TONE_TEXT } from './status';

export interface Segment {
  id: string;
  label: string;
  value: number;
}

interface Props {
  /** What the design uses. */
  need: number;
  /** What is available. The gap between the two is the margin. */
  have: number;
  severity: Severity;
  /** Optional split of `need` into stacked parts (dry mass / propellant, development / launch / operations ...). */
  segments?: Segment[];
  height?: number;
  /** Draw the dimension line under the gap. */
  dimension?: boolean;
  ariaLabel: string;
}

const SEGMENT_SHADE = ['bg-ink', 'bg-ink/65', 'bg-ink/40', 'bg-ink/25'];

/**
 * The signature mark of the game. A solid bar for what you use, section hatching for what is left over,
 * and a dimension line measuring the gap, the way a drawing would call out a clearance. When the design
 * needs more than there is, the overrun is drawn past the limit line in dense red hatching.
 */
export function MarginBar({ need, have, severity, segments, height = 14, dimension = true, ariaLabel }: Props) {
  const safeNeed = Math.max(0, Number.isFinite(need) ? need : 0);
  const safeHave = Math.max(0, Number.isFinite(have) ? have : 0);
  const scale = Math.max(safeNeed, safeHave, 1e-9);
  const over = safeNeed > safeHave;
  const usedPct = (Math.min(safeNeed, safeHave) / scale) * 100;
  const gapPct = (Math.abs(safeHave - safeNeed) / scale) * 100;
  const parts = segments && segments.length > 0 ? segments.filter((s) => s.value > 0) : [{ id: 'need', label: '', value: safeNeed }];
  const partsTotal = parts.reduce((a, s) => a + s.value, 0) || 1;
  // When over the limit the solid part only reaches the limit; the rest is the overrun.
  const solidPct = over ? usedPct : (safeNeed / scale) * 100;

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="relative flex w-full border border-rule" style={{ height }}>
        <div className="flex h-full transition-[width] duration-300 ease-out" style={{ width: `${solidPct}%` }}>
          {parts.map((s, i) => (
            <div
              key={s.id}
              title={s.label ? s.label : undefined}
              className={`h-full transition-[width] duration-300 ease-out ${SEGMENT_SHADE[Math.min(i, SEGMENT_SHADE.length - 1)]} ${i > 0 ? 'border-l border-bg' : ''}`}
              style={{ width: `${(s.value / partsTotal) * 100}%` }}
            />
          ))}
        </div>
        <div
          className={`h-full transition-[width] duration-300 ease-out ${TONE_TEXT[over ? 'red' : severity]} ${over ? 'hatch-dense border-l-2 border-nogo' : 'hatch'}`}
          style={{ width: `${gapPct}%` }}
        />
      </div>
      {dimension && (
        <div className="relative h-2.5" aria-hidden>
          <div
            className={`absolute top-0 h-full border-x transition-[left,width] duration-300 ease-out ${TONE_TEXT[over ? 'red' : severity]} border-current`}
            style={{ left: `${solidPct}%`, width: `${gapPct}%`, opacity: gapPct < 0.6 ? 0 : 1 }}
          >
            <div className="absolute top-1/2 right-0 left-0 border-t border-current" />
          </div>
        </div>
      )}
    </div>
  );
}

/** A plain 0–100% bar with threshold ticks, for metrics that are not "need versus have" (reliability, science). */
export function PercentBar({ value, severity, ticks = [], height = 14, ariaLabel }: { value: number; severity: Severity; ticks?: number[]; height?: number; ariaLabel: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div role="img" aria-label={ariaLabel} className="relative w-full border border-rule" style={{ height }}>
      <div className={`h-full transition-[width] duration-300 ease-out ${severity === 'green' ? 'bg-ink' : severity === 'yellow' ? 'bg-caution' : 'bg-nogo'}`} style={{ width: `${v}%` }} />
      {ticks.map((t) => (
        <div key={t} className="absolute -top-1 -bottom-1 border-l border-dashed border-dim" style={{ left: `${t}%` }} />
      ))}
    </div>
  );
}
