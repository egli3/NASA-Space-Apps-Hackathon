/**
 * Hindsight (GAME_DESIGN §6.2) — the signature feature. Replays the mission with ONE design decision changed at a
 * time, on the same seed and with the same in-flight decisions, and reports which changes would have mattered.
 * Because every random draw lives on its own named stream (rng.ts), the dice stay identical between replays:
 * a difference in the result is caused by the changed decision and nothing else. Owner: Track A.
 */
import type { Part, SlotId } from '../types/catalog';
import type { DecisionLog, MissionDesign } from '../types/design';
import type { BudgetReport, Catalog, HindsightItem, MissionResult } from '../types/engine';
import { computeBudgets, resolveDesign } from './budgets';
import { defaultDesign } from './design';
import { runHeadless } from './sim';

/** At most this many replays per debrief (§6.2 budget). */
const MAX_REPLAYS = 60;
/** Smaller differences than this are noise, not a lesson. */
const MIN_DELTA_PCT = 0.5;

type AltKind = 'slot' | 'solar' | 'reserve' | 'dsnHours' | 'dsnAperture' | 'band' | 'orbit' | 'trajectory' | 'launchVehicle' | 'assurance' | 'instrumentRemove' | 'instrumentAdd' | 'redundancy';

export interface Alternative {
  kind: AltKind;
  /** Alternatives with the same key belong to one decision (e.g. every other antenna). */
  dimensionKey: string;
  dimension: string; // shown to the player
  fromLabel: string;
  toLabel: string;
  design: MissionDesign;
  slot?: SlotId;
  /** False for "you could also have added X" options: not adding something is not a decision worth praising. */
  praiseworthy: boolean;
}

const SLOT_LABEL: Record<SlotId, string> = {
  power: 'Power source', battery: 'Battery', propulsion: 'Propulsion', antenna: 'Antenna', transmitter: 'Transmitter',
  adcs: 'Pointing', avionics: 'Computer', thermal: 'Thermal control', shielding: 'Radiation shielding',
};
const ASSURANCE_LABEL: Record<string, string> = { lean: 'lean testing', standard: 'standard testing', rigorous: 'rigorous testing' };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const num = (x: number, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('en-US');

/** Every single-decision alternative to a design (§6.2). */
export function alternatives(catalog: Catalog, design: MissionDesign): Alternative[] {
  const r = resolveDesign(catalog, design);
  const { scenario, dest, mclass } = r;
  const out: Alternative[] = [];
  const add = (a: Omit<Alternative, 'praiseworthy'> & { praiseworthy?: boolean }) => out.push({ praiseworthy: true, ...a });
  const isSolar = (p?: Part) => p?.specs.solarEfficiency !== undefined;

  // Slots: every other part allowed for this mission class.
  for (const [slot, current] of Object.entries(r.parts) as [SlotId, Part][]) {
    for (const p of catalog.parts) {
      if (p.slot !== slot || p.id === current.id) continue;
      if (p.classes && !p.classes.includes(mclass.id)) continue;
      if (p.specs.rtgBolW !== undefined && !mclass.rtgAllowed) continue;
      const d: MissionDesign = { ...design, parts: { ...design.parts, [slot]: p.id } };
      // switching from an RTG to arrays needs some array area to be a fair comparison
      if (slot === 'power' && isSolar(p) && !isSolar(current) && d.solarArrayAreaM2 <= 0) d.solarArrayAreaM2 = defaultDesign(catalog, scenario.id).solarArrayAreaM2;
      add({ kind: 'slot', slot, dimensionKey: `slot:${slot}`, dimension: SLOT_LABEL[slot], fromLabel: current.name, toLabel: p.name, design: d });
    }
  }

  if (isSolar(r.parts.power) && design.solarArrayAreaM2 > 0)
    for (const f of [0.66, 1.5]) {
      const area = Math.round(design.solarArrayAreaM2 * f * 10) / 10;
      add({ kind: 'solar', dimensionKey: 'solar', dimension: 'Solar array size', fromLabel: `${num(design.solarArrayAreaM2, 1)} m² of solar array`, toLabel: `${num(area, 1)} m²`, design: { ...design, solarArrayAreaM2: area } });
    }
  for (const delta of [-15, 15]) {
    const pct = clamp(design.reservePct + delta, 0, 60);
    if (pct !== design.reservePct)
      add({ kind: 'reserve', dimensionKey: 'reserve', dimension: 'Reserves', fromLabel: `${design.reservePct}% reserves`, toLabel: `${pct}% reserves`, design: { ...design, reservePct: pct } });
  }
  for (const f of [0.5, 2]) {
    const h = clamp(Math.round(design.dsnHoursPerDay * f), 1, 24);
    if (h !== design.dsnHoursPerDay)
      add({ kind: 'dsnHours', dimensionKey: 'dsnHours', dimension: 'DSN time', fromLabel: `${design.dsnHoursPerDay} h of DSN time a day`, toLabel: `${h} h a day`, design: { ...design, dsnHoursPerDay: h } });
  }
  const otherAperture = design.dsnAperture === '34m' ? '70m' : '34m';
  add({ kind: 'dsnAperture', dimensionKey: 'dsnAperture', dimension: 'DSN antenna', fromLabel: `${design.dsnAperture.replace('m', ' m')} DSN dishes`, toLabel: `${otherAperture.replace('m', ' m')} dishes`, design: { ...design, dsnAperture: otherAperture } });
  const otherBand = design.commsBand === 'X' ? 'Ka' : 'X';
  add({ kind: 'band', dimensionKey: 'band', dimension: 'Radio band', fromLabel: `${design.commsBand}-band`, toLabel: `${otherBand}-band`, design: { ...design, commsBand: otherBand } });

  for (const o of dest.orbits)
    if (o.id !== r.orbit.id) add({ kind: 'orbit', dimensionKey: 'orbit', dimension: 'Science orbit', fromLabel: r.orbit.name, toLabel: o.name, design: { ...design, orbitId: o.id } });
  for (const id of scenario.trajectoryIds) {
    const t = catalog.trajectories.find((x) => x.id === id);
    if (t && id !== design.trajectoryId) add({ kind: 'trajectory', dimensionKey: 'trajectory', dimension: 'Trajectory', fromLabel: r.traj.name, toLabel: t.name, design: { ...design, trajectoryId: id, launchOffsetDays: 0 } });
  }
  for (const id of scenario.launchVehicleIds) {
    const lv = catalog.launchVehicles.find((x) => x.id === id);
    if (lv && id !== design.launchVehicleId) add({ kind: 'launchVehicle', dimensionKey: 'launchVehicle', dimension: 'Launch vehicle', fromLabel: r.lv.name, toLabel: lv.name, design: { ...design, launchVehicleId: id } });
  }
  for (const a of ['lean', 'standard', 'rigorous'] as const)
    if (a !== design.assurance) add({ kind: 'assurance', dimensionKey: 'assurance', dimension: 'Testing & assurance', fromLabel: ASSURANCE_LABEL[design.assurance], toLabel: ASSURANCE_LABEL[a], design: { ...design, assurance: a } });

  for (const ins of r.instruments)
    add({ kind: 'instrumentRemove', dimensionKey: `ins:${ins.id}`, dimension: 'Instrument', fromLabel: ins.name, toLabel: `no ${ins.name}`, design: { ...design, instrumentIds: design.instrumentIds.filter((x) => x !== ins.id) } });
  for (const slot of ['avionics', 'adcs', 'transmitter', 'battery'] as const) {
    const on = (design.redundant as string[]).includes(slot);
    const name = r.parts[slot]?.name ?? slot;
    add({
      kind: 'redundancy', slot, dimensionKey: `redundant:${slot}`, dimension: 'Redundancy', praiseworthy: on,
      fromLabel: on ? `a backup ${name}` : `a single ${name}`, toLabel: on ? `a single ${name}` : `a backup ${name}`,
      design: { ...design, redundant: on ? design.redundant.filter((x) => x !== slot) : [...design.redundant, slot] },
    });
  }
  for (const id of scenario.instrumentIds) {
    const ins = catalog.instruments.find((x) => x.id === id);
    if (ins && !design.instrumentIds.includes(id))
      add({ kind: 'instrumentAdd', dimensionKey: `ins:${id}`, dimension: 'Instrument', praiseworthy: false, fromLabel: `no ${ins.name}`, toLabel: ins.name, design: { ...design, instrumentIds: [...design.instrumentIds, id] } });
  }
  return out;
}

const pts = (d: number) => `${d >= 0 ? '+' : '−'}${num(Math.abs(d), Math.abs(d) < 10 ? 1 : 0)} pts`;
/** "2.8× more" / "40% less" for a ratio alt ÷ actual. */
function compare(ratio: number, more = 'more', less = 'less'): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return `far ${less}`;
  if (ratio >= 1.5) return `${num(ratio, 1)}× ${more}`;
  if (ratio >= 1) return `${num((ratio - 1) * 100)}% ${more}`;
  if (ratio > 0.67) return `${num((1 - ratio) * 100)}% ${less}`;
  return `${num(1 / ratio, 1)}× ${less}`;
}

/** What the change does physically — the middle of the sentence. Chosen per kind of decision, from the two budgets. */
function mechanism(catalog: Catalog, alt: Alternative, base: BudgetReport, b: BudgetReport, destName: string): string | undefined {
  const downlink = () => (base.comms.downlinkGbPerDay > 0 && Math.abs(b.comms.downlinkGbPerDay / base.comms.downlinkGbPerDay - 1) > 0.05
    ? `downlinked ${compare(b.comms.downlinkGbPerDay / base.comms.downlinkGbPerDay)} data from ${destName}` : undefined);
  const power = () => (Math.abs(b.power.generatedEolW - base.power.generatedEolW) > 1
    ? `made ${num(b.power.generatedEolW)} W at ${destName} instead of ${num(base.power.generatedEolW)} W` : undefined);
  const survival = () => (Math.abs(b.risk.reliabilityPct - base.risk.reliabilityPct) > 0.5
    ? `moved the odds of surviving from ${num(base.risk.reliabilityPct)}% to ${num(b.risk.reliabilityPct)}%` : undefined);
  const collection = () => (base.comms.generatedGbPerDay > 0 && Math.abs(b.comms.generatedGbPerDay / base.comms.generatedGbPerDay - 1) > 0.05
    ? `collected ${compare(b.comms.generatedGbPerDay / base.comms.generatedGbPerDay)} data per day` : undefined);
  const mass = () => (Math.abs(b.mass.wetKg - base.mass.wetKg) > 1
    ? `launched at ${num(b.mass.wetKg)} kg instead of ${num(base.mass.wetKg)} kg` : undefined);
  const dose = () => (Math.abs(b.radiation.primaryDoseKrad - base.radiation.primaryDoseKrad) > 0.5
    ? `${b.radiation.primaryDoseKrad < base.radiation.primaryDoseKrad ? 'cut' : 'raised'} the radiation dose from ${num(base.radiation.primaryDoseKrad)} to ${num(b.radiation.primaryDoseKrad)} krad`
    : b.radiation.toleranceKrad !== base.radiation.toleranceKrad ? `tolerated ${num(b.radiation.toleranceKrad)} krad of radiation instead of ${num(base.radiation.toleranceKrad)}` : undefined);
  const coverage = () => {
    const changed = b.science.objectives
      .map((o, i) => ({ o, d: o.expectedPct - base.science.objectives[i].expectedPct }))
      .filter((x) => Math.abs(x.d) > 1).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
    if (!changed) return undefined;
    const name = catalog.scenarios.flatMap((s) => s.objectives).find((o) => o.id === changed.o.objectiveId)?.name ?? changed.o.objectiveId;
    return `${changed.d > 0 ? 'raised' : 'dropped'} "${name}" from ${num(base.science.objectives.find((o) => o.objectiveId === changed.o.objectiveId)!.expectedPct)}% to ${num(changed.o.expectedPct)}%`;
  };
  switch (alt.kind) {
    case 'slot':
      switch (alt.slot) {
        case 'antenna': case 'transmitter': return downlink() ?? survival();
        case 'power': return power() ?? mass();
        case 'battery': return b.power.batteryMarginPct !== base.power.batteryMarginPct && base.power.batteryRequiredWh > 0
          ? `held ${num(b.power.batteryWh)} Wh for the ${num(base.power.eclipseMinutes)}-minute eclipses (${num(base.power.batteryRequiredWh)} Wh needed)` : survival();
        case 'propulsion': return Math.abs(b.mass.propellantKg - base.mass.propellantKg) > 1 ? `needed ${num(b.mass.propellantKg)} kg of propellant instead of ${num(base.mass.propellantKg)} kg` : survival();
        case 'adcs': return coverage() ?? downlink() ?? survival();
        case 'avionics': case 'shielding': return dose() ?? survival();
        default: return survival() ?? mass();
      }
    case 'solar': return power();
    case 'reserve': return `kept $${num(b.cost.reserveM)}M in reserve instead of $${num(base.cost.reserveM)}M`;
    case 'dsnHours': case 'dsnAperture': case 'band': return downlink() ?? coverage();
    case 'orbit': return coverage() ?? collection() ?? dose() ?? mass();
    case 'trajectory': return mass() ?? survival();
    case 'launchVehicle': return `lifted ${num(b.mass.lvCapacityKg)} kg instead of ${num(base.mass.lvCapacityKg)} kg`;
    case 'assurance': case 'redundancy': return survival();
    case 'instrumentAdd': case 'instrumentRemove': return coverage() ?? downlink();
  }
}

function sentence(catalog: Catalog, alt: Alternative, base: BudgetReport, b: BudgetReport, actual: MissionResult, replay: MissionResult, destName: string): string {
  const dSci = replay.sciencePct - actual.sciencePct;
  const dCost = replay.totalCostM - actual.totalCostM;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const lead = alt.kind === 'instrumentAdd' ? `Adding the ${alt.toLabel}`
    : alt.kind === 'instrumentRemove' ? `Leaving the ${alt.fromLabel} behind`
    : alt.kind === 'redundancy' ? cap(alt.toLabel)
    : `${cap(alt.toLabel)} instead of ${alt.fromLabel}`;
  const how = mechanism(catalog, alt, base, b, destName);
  const fate = actual.outcome === 'lost' && replay.outcome !== 'lost' ? ' and the mission would have survived'
    : actual.outcome !== 'lost' && replay.outcome === 'lost' ? ` but the mission would have been lost (${replay.lossCause})` : '';
  const money = Math.abs(dCost) >= 1 ? `, $${num(Math.abs(dCost))}M ${dCost > 0 ? 'more' : 'less'}` : '';
  return `${lead} would have ${how ?? (dSci >= 0 ? 'returned more science' : 'returned less science')}${fate} (${pts(dSci)}${money}).`;
}

export interface HindsightReport {
  /** Top improvements, biggest first, at most one per decision, at most 3. */
  hindsight: HindsightItem[];
  /** The decision whose every alternative would have scored worse (largest guaranteed loss). */
  bestDecision?: HindsightItem;
  /** Every alternative that was looked at, best first; infeasible ones last. */
  explored: HindsightItem[];
  replays: number;
}

export function buildHindsight(catalog: Catalog, design: MissionDesign, seed: number, decisions: DecisionLog, actual: MissionResult): HindsightReport {
  const base = computeBudgets(catalog, design);
  const destName = resolveDesign(catalog, design).dest.name;
  const rows: { alt: Alternative; item: HindsightItem }[] = [];
  let replays = 0;
  for (const alt of alternatives(catalog, design)) {
    const b = computeBudgets(catalog, alt.design);
    if (!b.feasible || replays >= MAX_REPLAYS) {
      rows.push({ alt, item: {
        dimension: alt.dimension, fromLabel: alt.fromLabel, toLabel: alt.toLabel, deltaSciencePct: 0, deltaCostM: b.cost.totalM - base.cost.totalM, feasible: false,
        explanation: b.feasible ? 'Not replayed.' : `Not possible with the rest of your design: ${b.blockers[0]}.`,
      } });
      continue;
    }
    replays++;
    const replay = runHeadless(catalog, alt.design, seed, decisions);
    rows.push({ alt, item: {
      dimension: alt.dimension, fromLabel: alt.fromLabel, toLabel: alt.toLabel, feasible: true,
      deltaSciencePct: replay.sciencePct - actual.sciencePct, deltaCostM: replay.totalCostM - actual.totalCostM,
      explanation: sentence(catalog, alt, base, b, actual, replay, destName),
    } });
  }

  const feasible = rows.filter((x) => x.item.feasible);
  const ranked = [...feasible].sort((x, y) => y.item.deltaSciencePct - x.item.deltaSciencePct || x.item.deltaCostM - y.item.deltaCostM);
  const hindsight: HindsightItem[] = [];
  const seen = new Set<string>();
  for (const x of ranked) {
    if (x.item.deltaSciencePct < MIN_DELTA_PCT || hindsight.length >= 3) break;
    if (seen.has(x.alt.dimensionKey)) continue; // one lesson per decision
    seen.add(x.alt.dimensionKey);
    hindsight.push(x.item);
  }

  // Best call: a decision where EVERY feasible alternative does worse; among those, the one with the largest smallest loss.
  let best: { item: HindsightItem; minLoss: number } | undefined;
  const byDimension = new Map<string, typeof feasible>();
  for (const x of feasible) if (x.alt.praiseworthy) byDimension.set(x.alt.dimensionKey, [...(byDimension.get(x.alt.dimensionKey) ?? []), x]);
  for (const group of byDimension.values()) {
    const closest = group.reduce((a, x) => (x.item.deltaSciencePct > a.item.deltaSciencePct ? x : a));
    const minLoss = -closest.item.deltaSciencePct;
    if (minLoss < MIN_DELTA_PCT || (best && minLoss <= best.minLoss)) continue;
    const others = group.length > 1 ? `Every alternative we replayed would have returned less science; the closest, ${closest.item.toLabel}, by ${num(minLoss, minLoss < 10 ? 1 : 0)} points.` : '';
    best = { minLoss, item: {
      ...closest.item,
      explanation: group.length > 1
        ? `Your best call: ${closest.item.fromLabel}. ${others}`
        : `Your best call: ${closest.item.fromLabel}. ${closest.item.explanation}`,
    } };
  }

  const explored = [...ranked.map((x) => x.item), ...rows.filter((x) => !x.item.feasible).map((x) => x.item)];
  return { hindsight, bestDecision: best?.item, explored, replays };
}
