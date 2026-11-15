import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { catalog } from '../../data';
import type { MissionDesign } from '../../types/design';
import type { BudgetReport } from '../../types/engine';
import { num, signed } from '../common/format';
import { SLOT_ORDER, TAB_LABEL } from '../common/labels';

interface Ripple {
  key: number;
  cause: string;
  effects: { id: string; text: string; good: boolean }[];
}

/** Metrics in causal order: hardware → propellant → margins → what you get → what it costs. */
const METRICS: {
  id: string;
  label: string;
  get: (b: BudgetReport) => number;
  /** 'rel' = show the change in units when it moves by more than 2%; 'pts' = percentage points. */
  mode: 'rel' | 'pts';
  unit: string;
  higherIsBetter: boolean;
}[] = [
  { id: 'dry', label: 'dry mass', get: (b) => b.mass.dryKg, mode: 'rel', unit: ' kg', higherIsBetter: false },
  { id: 'prop', label: 'propellant', get: (b) => b.mass.propellantKg, mode: 'rel', unit: ' kg', higherIsBetter: false },
  { id: 'massMargin', label: 'mass margin', get: (b) => b.mass.marginPct, mode: 'pts', unit: ' pts', higherIsBetter: true },
  { id: 'power', label: 'power', get: (b) => b.power.generatedEolW, mode: 'rel', unit: ' W', higherIsBetter: true },
  { id: 'load', label: 'power load', get: (b) => Math.max(b.power.loadScienceW, b.power.loadDownlinkW), mode: 'rel', unit: ' W', higherIsBetter: false },
  { id: 'downlink', label: 'sent home a day', get: (b) => b.comms.downlinkGbPerDay, mode: 'rel', unit: ' Gb', higherIsBetter: true },
  { id: 'dose', label: 'radiation dose', get: (b) => b.radiation.primaryDoseKrad, mode: 'rel', unit: ' krad', higherIsBetter: false },
  { id: 'science', label: 'science', get: (b) => b.science.expectedPct, mode: 'pts', unit: ' pts', higherIsBetter: true },
  { id: 'reliability', label: 'reliability', get: (b) => b.risk.reliabilityPct, mode: 'pts', unit: ' pts', higherIsBetter: true },
  { id: 'cost', label: 'cost', get: (b) => b.cost.totalM, mode: 'rel', unit: 'M', higherIsBetter: false },
];

function describeChange(a: MissionDesign, b: MissionDesign): string | null {
  for (const slot of SLOT_ORDER)
    if (a.parts[slot] !== b.parts[slot]) return `${TAB_LABEL[slot]}: ${catalog.parts.find((p) => p.id === b.parts[slot])?.name ?? 'changed'}`;
  const added = b.instrumentIds.find((id) => !a.instrumentIds.includes(id));
  if (added) return `Added the ${catalog.instruments.find((i) => i.id === added)?.name.toLowerCase() ?? 'instrument'}`;
  const removed = a.instrumentIds.find((id) => !b.instrumentIds.includes(id));
  if (removed) return `Removed the ${catalog.instruments.find((i) => i.id === removed)?.name.toLowerCase() ?? 'instrument'}`;
  if (a.solarArrayAreaM2 !== b.solarArrayAreaM2) return `Solar array ${num(a.solarArrayAreaM2)} to ${num(b.solarArrayAreaM2)} m²`;
  if (a.commsBand !== b.commsBand) return `Switched to ${b.commsBand}-band`;
  if (a.redundant.length !== b.redundant.length) {
    const slot = b.redundant.find((s) => !a.redundant.includes(s)) ?? a.redundant.find((s) => !b.redundant.includes(s));
    return `${b.redundant.length > a.redundant.length ? 'Added' : 'Removed'} a backup ${slot ? TAB_LABEL[slot].toLowerCase() : 'unit'}`;
  }
  if (a.orbitId !== b.orbitId) return 'Changed the science orbit';
  if (a.dsnHoursPerDay !== b.dsnHoursPerDay) return `Antenna time ${a.dsnHoursPerDay} to ${b.dsnHoursPerDay} h a day`;
  if (a.dsnAperture !== b.dsnAperture) return `Switched to the ${b.dsnAperture.replace('m', ' m')} dish`;
  if (a.assurance !== b.assurance) return `Assurance: ${b.assurance}`;
  if (a.reservePct !== b.reservePct) return `Reserves ${a.reservePct}% to ${b.reservePct}%`;
  if (a.launchVehicleId !== b.launchVehicleId) return `Rocket: ${catalog.launchVehicles.find((l) => l.id === b.launchVehicleId)?.name ?? 'changed'}`;
  if (a.trajectoryId !== b.trajectoryId) return 'Changed the route';
  if (a.launchOffsetDays !== b.launchOffsetDays) return 'Moved the launch date';
  return null;
}

function diff(a: BudgetReport, b: BudgetReport): Ripple['effects'] {
  const scored = METRICS.map((m, order) => {
    const before = m.get(a);
    const after = m.get(b);
    if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
    const d = after - before;
    const size = m.mode === 'pts' ? Math.abs(d) / 2 : Math.abs(d) / Math.max(1e-6, Math.abs(before)) / 0.02;
    if (size < 1) return null;
    // Margins far beyond what matters (several hundred percent) are noise, not a ripple.
    if (m.mode === 'pts' && Math.min(before, after) > 300) return null;
    const text = m.id === 'cost' ? `${d >= 0 ? '+' : '−'}$${num(Math.abs(d), Math.abs(d) < 10 ? 1 : 0)}M ${m.label}` : `${signed(d, Math.abs(d) < 10 ? 1 : 0)}${m.unit} ${m.label}`;
    return { id: m.id, text, good: d > 0 === m.higherIsBetter, size, order };
  }).filter((x) => x !== null);
  return scored
    .sort((x, y) => y.size - x.size)
    .slice(0, 4)
    .sort((x, y) => x.order - y.order);
}

/**
 * Ripple chips: change one thing and see what it dragged along with it, in causal order. The comparison is
 * against the design as it stood when the player last paused, so dragging a slider reads as one change.
 */
export function RippleChips({ design, budgets }: { design: MissionDesign; budgets: BudgetReport }) {
  const base = useRef({ design, budgets });
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const settle = useRef<number | undefined>(undefined);
  const clear = useRef<number | undefined>(undefined);
  const counter = useRef(0);

  useEffect(() => {
    const from = base.current;
    if (from.design === design) return;
    const cause = describeChange(from.design, design);
    if (!cause) {
      base.current = { design, budgets };
      return;
    }
    const effects = diff(from.budgets, budgets);
    setRipple((r) => ({ key: r && r.cause.split(' ')[0] === cause.split(' ')[0] ? r.key : ++counter.current, cause, effects }));
    window.clearTimeout(settle.current);
    window.clearTimeout(clear.current);
    settle.current = window.setTimeout(() => (base.current = { design, budgets }), 900);
    clear.current = window.setTimeout(() => setRipple(null), 7000);
  }, [design, budgets]);

  useEffect(
    () => () => {
      window.clearTimeout(settle.current);
      window.clearTimeout(clear.current);
    },
    [],
  );

  return (
    <div aria-live="polite" className="pointer-events-none flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
      <AnimatePresence mode="wait">
        {ripple && (
          <motion.div key={ripple.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="bg-caution px-2.5 py-1 font-bold text-[#0b2a4a]">{ripple.cause}</span>
            {ripple.effects.length === 0 && <span className="text-dim">no budget moved by more than 2%</span>}
            {ripple.effects.map((e) => (
              <span key={e.id} className="flex items-center gap-2">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-caution" aria-hidden>
                  <path d="M0 5h12M8.5 1.5L12 5l-3.5 3.5" />
                </svg>
                <span className={`num border px-2 py-1 ${e.good ? 'border-go text-go' : 'border-caution text-caution'}`}>{e.text}</span>
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
