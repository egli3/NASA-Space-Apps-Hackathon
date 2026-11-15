/**
 * Event-card plumbing for the flight sim: the Facts that card conditions test, the condition evaluator,
 * space-weather severity and the DONKI replay calendar. GAME_DESIGN §5.4 and §5.6. Owner: Track A. Pure functions.
 */
import type { Condition, Effect, EventCard, MissionPhase, SpaceWeatherEvent } from '../types/catalog';
import type { MissionDesign } from '../types/design';
import type { Catalog, SimPhase, SimState } from '../types/engine';
import { resolveDesign } from './budgets';

export type FactValue = string | number | boolean;
export type Facts = Record<string, FactValue>;

/**
 * Everything an event card may test (GAME_DESIGN §5.4). Keys:
 * design.assurance, design.commsBand, design.dsnAperture, redundant.<slot>, parts.<slot>, power.kind, orbit.id,
 * orbit.aerobraking, destination.id, mission.class, phase, state.batterySoc, state.storageFrac, state.propellantKg,
 * instrument.<id>.
 */
export function facts(catalog: Catalog, design: MissionDesign, state: SimState): Facts {
  const r = resolveDesign(catalog, design);
  const storageGb = r.parts.avionics?.specs.storageGb ?? 0;
  const f: Facts = {
    'design.assurance': design.assurance,
    'design.commsBand': design.commsBand,
    'design.dsnAperture': design.dsnAperture,
    'power.kind': r.parts.power?.specs.solarEfficiency !== undefined ? 'solar' : 'rtg',
    'orbit.id': r.orbit.id,
    'orbit.aerobraking': !!r.orbit.aerobraking,
    'destination.id': r.dest.id,
    'mission.class': r.mclass.id,
    phase: state.phase,
    'state.batterySoc': state.batterySoc,
    'state.storageFrac': storageGb > 0 ? state.storageUsedGb / storageGb : 0,
    'state.propellantKg': state.propellantKg,
  };
  for (const slot of ['avionics', 'adcs', 'transmitter', 'battery']) f[`redundant.${slot}`] = (design.redundant as string[]).includes(slot);
  for (const [slot, id] of Object.entries(design.parts)) if (id) f[`parts.${slot}`] = id;
  for (const ins of catalog.instruments) f[`instrument.${ins.id}`] = design.instrumentIds.includes(ins.id);
  return f;
}

/** True when the fact key is one the engine provides (used by the data test: a typo in a card must not pass silently). */
export function isKnownFact(key: string): boolean {
  return /^(design\.(assurance|commsBand|dsnAperture)|redundant\.\w+|parts\.\w+|power\.kind|orbit\.(id|aerobraking)|destination\.id|mission\.class|phase|state\.(batterySoc|storageFrac|propellantKg)|instrument\.[\w-]+)$/.test(key);
}

export function conditionHolds(c: Condition, f: Facts): boolean {
  let v: FactValue | undefined = f[c.fact];
  if (v === undefined && (c.fact.startsWith('redundant.') || c.fact.startsWith('instrument.'))) v = false;
  if (v === undefined) return false; // unknown fact: never eligible
  switch (c.op) {
    case 'eq': return v === c.value;
    case 'neq': return v !== c.value;
    case 'in': return Array.isArray(c.value) && (c.value as (string | number)[]).includes(v as string | number);
    case 'lt': return typeof v === 'number' && typeof c.value === 'number' && v < c.value;
    case 'lte': return typeof v === 'number' && typeof c.value === 'number' && v <= c.value;
    case 'gt': return typeof v === 'number' && typeof c.value === 'number' && v > c.value;
    case 'gte': return typeof v === 'number' && typeof c.value === 'number' && v >= c.value;
  }
}

export const conditionsHold = (card: EventCard, f: Facts): boolean => card.conditions.every((c) => conditionHolds(c, f));

/** Which card phase a sim phase counts as (aerobraking is part of "arrival"; launch day is part of "cruise"). */
const CARD_PHASE: Record<SimPhase, MissionPhase | undefined> = {
  launch: 'cruise', cruise: 'cruise', arrival: 'arrival', aerobraking: 'arrival', science: 'science', extended: 'extended', ended: undefined,
};
export function phaseMatches(cardPhase: MissionPhase, simPhase: SimPhase): boolean {
  const p = CARD_PHASE[simPhase];
  return p !== undefined && (cardPhase === 'any' || cardPhase === p);
}

/**
 * Severity (0..1) from a card's `minSeverity` string (§5.6): a number ("0.6"), a flare class ("M5", "X1", "X9.3")
 * or "SEP". Flares: M1 = 0.30 rising linearly to M9.9 = 0.55; X1 = 0.60 rising linearly to X10+ = 1.0.
 */
export function severityFromString(s: string | undefined): number {
  if (!s) return 0;
  const t = s.trim().toUpperCase();
  if (t === 'SEP') return 0.8;
  const cls = /^([MX])(\d+(\.\d+)?)$/.exec(t);
  if (cls) {
    const mag = parseFloat(cls[2]);
    if (cls[1] === 'M') return 0.3 + (Math.min(9.9, Math.max(1, mag)) - 1) / 8.9 * 0.25;
    return 0.6 + (Math.min(10, Math.max(1, mag)) - 1) / 9 * 0.4;
  }
  const num = parseFloat(t);
  return Number.isFinite(num) ? num : 0;
}

const SNAPSHOT_START_MS = Date.UTC(2014, 0, 1);
const SNAPSHOT_DAYS = Math.round((Date.UTC(2020, 0, 1) - SNAPSHOT_START_MS) / 86400000); // 2014-01-01 → 2019-12-31
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Replays the real DONKI record (§5.6): mission day d maps to snapshot day (d + seed mod 365) mod snapshotDays.
 * `eventOn(day)` returns the most severe real event on that mapped date, if any.
 */
export function spaceWeatherCalendar(events: SpaceWeatherEvent[], seed: number) {
  const byDay = new Map<number, SpaceWeatherEvent>();
  for (const e of events) {
    const ms = Date.parse(e.time);
    if (!Number.isFinite(ms)) continue;
    const idx = Math.floor((ms - SNAPSHOT_START_MS) / 86400000);
    if (idx < 0 || idx >= SNAPSHOT_DAYS) continue;
    const cur = byDay.get(idx);
    if (!cur || e.severity > cur.severity) byDay.set(idx, e);
  }
  const offset = ((seed % 365) + 365) % 365;
  return {
    size: byDay.size,
    eventOn: (missionDay: number): SpaceWeatherEvent | undefined => byDay.get((missionDay + offset) % SNAPSHOT_DAYS),
  };
}

/** "Based on a real X9.3 flare, 6 Sep 2017 (NASA DONKI)" */
export function spaceWeatherContext(e: SpaceWeatherEvent): string {
  const d = new Date(Date.parse(e.time));
  const when = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const what = e.kind === 'FLR' ? `${e.classType ?? 'solar'} flare` : e.kind === 'SEP' ? 'solar energetic particle storm' : e.kind === 'CME' ? 'coronal mass ejection' : 'geomagnetic storm';
  return `Based on a real ${what}, ${when} (NASA DONKI)`;
}

/** "days:4" → 4; anything else → undefined (permanent). */
export function effectDays(e: Effect): number | undefined {
  const m = /^days:(\d+(\.\d+)?)$/.exec(e.target ?? '');
  return m ? parseFloat(m[1]) : undefined;
}
