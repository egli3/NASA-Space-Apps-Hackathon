/**
 * Reference designs and their balance targets (GAME_DESIGN §7). Owner: Track A.
 *
 * These are the yardsticks for tuning: `npm run balance` prints how each one scores today, and at M4 the targets
 * that hold become tests. Not imported by the UI (so it is tree-shaken out of the game bundle).
 */
import type { MissionDesign } from '../types/design';
import type { BudgetReport, Catalog, ReviewResult } from '../types/engine';
import { computeBudgets } from './budgets';
import { defaultDesign } from './design';

export interface BalanceCheck {
  /** The target in words, as written in GAME_DESIGN §7. */
  target: string;
  /** The number(s) the target is judged on, for the report. */
  actual: (b: BudgetReport, review: ReviewResult) => string;
  /** Returns undefined when it cannot be judged (a Monte Carlo target and the review was run without `monteCarloRuns`). */
  pass: (b: BudgetReport, review: ReviewResult) => boolean | undefined;
}

export interface ReferenceDesign {
  id: string;
  label: string;
  design: MissionDesign;
  checks: BalanceCheck[];
}

const pct = (x: number) => `${x.toFixed(1)}%`;
const objective = (b: BudgetReport, id: string) => b.science.objectives.find((o) => o.objectiveId === id)?.expectedPct ?? 0;
const underCap = (b: BudgetReport) => b.cost.totalM <= b.cost.capM;

export function referenceDesigns(catalog: Catalog): ReferenceDesign[] {
  const make = (scenarioId: string, parts: MissionDesign['parts'], rest: Partial<MissionDesign>): MissionDesign => {
    const base = defaultDesign(catalog, scenarioId);
    return { ...base, ...rest, parts: { ...base.parts, ...parts } };
  };
  const out: ReferenceDesign[] = [];

  // ---- Default designs: a first draft that needs work, never a crash ----
  for (const s of catalog.scenarios)
    out.push({
      id: `default-${s.id}`,
      label: `Default — ${s.title}`,
      design: defaultDesign(catalog, s.id),
      checks: [{
        target: 'Opens with ≥ 1 yellow or red finding',
        actual: (_b, r) => `${r.findings.filter((f) => f.severity === 'red').length} red, ${r.findings.filter((f) => f.severity === 'yellow').length} yellow`,
        pass: (_b, r) => r.findings.some((f) => f.severity !== 'green'),
      }],
    });

  // ---- Mars ----
  const mro = make('mars-climate',
    { antenna: 'ant-hga-30', transmitter: 'tx-twta-100', adcs: 'adcs-precision', propulsion: 'prop-mono' },
    { missionName: 'MRO-like', instrumentIds: ['ins-hires', 'ins-ctx', 'ins-visir', 'ins-radar', 'ins-wac'], solarArrayAreaM2: 20, orbitId: 'mars-low-aerobrake', launchVehicleId: 'lv-vulcan-vc4' });
  out.push({
    id: 'mro-like', label: 'MRO-like (Mars)', design: mro,
    checks: [
      { target: 'Cost 0–10% under the cap', actual: (b) => `${pct(b.cost.marginPct)} under`, pass: (b) => b.cost.marginPct >= 0 && b.cost.marginPct <= 10 },
      { target: 'Science 55–75% (escape uncovered)', actual: (b) => pct(b.science.expectedPct), pass: (b) => b.science.expectedPct >= 55 && b.science.expectedPct <= 75 },
    ],
  });

  const maven = make('mars-climate',
    { antenna: 'ant-hga-15', transmitter: 'tx-twta-35' },
    { missionName: 'MAVEN-like', instrumentIds: ['ins-ngims', 'ins-particles', 'ins-mag', 'ins-uvs', 'ins-wac'], orbitId: 'mars-elliptical-dip', launchVehicleId: 'lv-vulcan-vc4' });
  out.push({
    id: 'maven-like', label: 'MAVEN-like (Mars)', design: maven,
    checks: [
      { target: 'Escape objective ≥ 80%', actual: (b) => pct(objective(b, 'mars-escape')), pass: (b) => objective(b, 'mars-escape') >= 80 },
      { target: 'Specialist total science 25–35% (escape is 30% of the call)', actual: (b) => pct(b.science.expectedPct), pass: (b) => b.science.expectedPct >= 25 && b.science.expectedPct <= 35 },
    ],
  });

  const balanced = make('mars-climate',
    { antenna: 'ant-hga-25', transmitter: 'tx-twta-35', adcs: 'adcs-precision', propulsion: 'prop-mono' },
    { missionName: 'Balanced Mars', instrumentIds: ['ins-ctx', 'ins-radar', 'ins-hires', 'ins-visir', 'ins-uvs'], orbitId: 'mars-low-aerobrake', launchVehicleId: 'lv-vulcan-vc4', commsBand: 'Ka', dsnHoursPerDay: 12 });
  out.push({
    id: 'balanced-mars', label: 'Balanced Mars (UV escape + surface survey)', design: balanced,
    checks: [
      { target: 'Science ≥ 80% (a thoughtful player can get ★★★)', actual: (b) => pct(b.science.expectedPct), pass: (b) => b.science.expectedPct >= 80 },
      { target: 'Cost under the cap', actual: (b) => `$${b.cost.totalM.toFixed(0)}M of $${b.cost.capM}M`, pass: underCap },
    ],
  });

  // ---- Jupiter ----
  const junoRest: Partial<MissionDesign> = {
    missionName: 'Juno-like', instrumentIds: ['ins-mwr', 'ins-gravity', 'ins-mag', 'ins-particles', 'ins-uvs', 'ins-wac'],
    solarArrayAreaM2: 60, commsBand: 'Ka', trajectoryId: 'jupiter-dveega-2029', launchVehicleId: 'lv-vulcan-vc4',
  };
  const junoParts: MissionDesign['parts'] = { power: 'pwr-solar-tj', antenna: 'ant-hga-25', transmitter: 'tx-twta-35', shielding: 'shd-vault' };
  const juno = make('jupiter-interior', junoParts, junoRest);
  out.push({
    id: 'juno-like', label: 'Juno-like (Jupiter, ΔV-EGA)', design: juno,
    checks: [
      { target: 'Feasible', actual: (b) => (b.feasible ? 'feasible' : b.blockers[0]), pass: (b) => b.feasible },
      { target: 'Power margin 10–40%', actual: (b) => pct(b.power.marginPct), pass: (b) => b.power.marginPct >= 10 && b.power.marginPct <= 40 },
      { target: 'Science ≥ 75%', actual: (b) => pct(b.science.expectedPct), pass: (b) => b.science.expectedPct >= 75 },
      { target: 'Reliability ≥ 70%', actual: (b) => pct(b.risk.reliabilityPct), pass: (b) => b.risk.reliabilityPct >= 70 },
    ],
  });
  out.push({
    id: 'juno-direct-vulcan', label: 'Juno-like, direct, Vulcan', design: { ...juno, trajectoryId: 'jupiter-direct-2029' },
    checks: [{ target: 'Infeasible (teaches gravity assists)', actual: (b) => (b.feasible ? 'feasible' : `mass margin ${pct(b.mass.marginPct)}`), pass: (b) => !b.feasible }],
  });
  out.push({
    id: 'juno-direct-fh', label: 'Juno-like, direct, Falcon Heavy', design: { ...juno, trajectoryId: 'jupiter-direct-2029', launchVehicleId: 'lv-falcon-heavy' },
    // The verified Falcon Heavy curve lifts this ~1.6 t spacecraft to C3 77.5 with room to spare, so the lesson here is
    // "a bigger rocket buys back the 19 months of the gravity assist, at a price", not "you must cut".
    checks: [{
      target: 'Feasible, but costs more than ΔV-EGA on Vulcan',
      actual: (b) => (b.feasible ? `feasible, $${b.cost.totalM.toFixed(0)}M vs $${computeBudgets(catalog, juno).cost.totalM.toFixed(0)}M` : `infeasible, mass margin ${pct(b.mass.marginPct)}`),
      pass: (b) => b.feasible && b.cost.totalM > computeBudgets(catalog, juno).cost.totalM,
    }],
  });
  out.push({
    id: 'juno-no-vault', label: 'Juno-like, no radiation vault', design: make('jupiter-interior', { ...junoParts, shielding: 'shd-none' }, junoRest),
    checks: [
      { target: 'Radiation margin red', actual: (b) => pct(b.radiation.doseMarginPct), pass: (_b, r) => r.findings.some((f) => f.ruleId === 'rr-radiation' && f.severity === 'red') },
      {
        target: 'Monte Carlo success < 40%',
        actual: (b, r) => (r.predictedSuccessPct === undefined ? `design-time reliability ${pct(b.risk.reliabilityPct)}` : `${pct(r.predictedSuccessPct)} of universes`),
        pass: (_b, r) => (r.predictedSuccessPct === undefined ? undefined : r.predictedSuccessPct < 40),
      },
    ],
  });

  // ---- Moon ----
  out.push({
    id: 'lunar-prospector-like', label: 'Lunar Prospector-like (Moon)',
    design: make('moon-ice', { power: 'pwr-solar-si' }, { missionName: 'Prospector-like', instrumentIds: ['ins-grns', 'ins-thermal'], solarArrayAreaM2: 3, launchVehicleId: 'lv-rideshare-lunar' }),
    checks: [
      { target: 'Feasible', actual: (b) => (b.feasible ? 'feasible' : b.blockers[0]), pass: (b) => b.feasible },
      { target: 'Cost under the cap', actual: (b) => `$${b.cost.totalM.toFixed(0)}M of $${b.cost.capM}M`, pass: underCap },
      { target: 'Science 45–65%', actual: (b) => pct(b.science.expectedPct), pass: (b) => b.science.expectedPct >= 45 && b.science.expectedPct <= 65 },
      {
        target: 'Monte Carlo success ≥ 80% (the tutorial is winnable as it starts)',
        actual: (_b, r) => (r.predictedSuccessPct === undefined ? 'not run' : `${pct(r.predictedSuccessPct)} of universes`),
        pass: (_b, r) => (r.predictedSuccessPct === undefined ? undefined : r.predictedSuccessPct >= 80),
      },
    ],
  });
  // The tutorial's three-star route: add the laser altimeter, a bigger battery for the eclipses, and trim the reserve.
  out.push({
    id: 'lunar-three-star', label: 'Lunar three-star (adds laser altimeter)',
    design: make('moon-ice', { transmitter: 'tx-sspa-5', battery: 'bat-500' }, {
      missionName: 'Three-star Moon', instrumentIds: ['ins-grns', 'ins-thermal', 'ins-lola'], solarArrayAreaM2: 2, reservePct: 20, assurance: 'lean',
      orbitId: 'moon-polar-50', trajectoryId: 'moon-direct-2028', launchVehicleId: 'lv-rideshare-lunar',
    }),
    checks: [
      { target: 'Science ≥ 75% (★★★ possible)', actual: (b) => pct(b.science.expectedPct), pass: (b) => b.science.expectedPct >= 75 },
      { target: 'Cleared by the review board', actual: (_b, r) => (r.go ? 'cleared' : r.findings.filter((f) => f.severity === 'red').map((f) => f.title).join(', ')), pass: (_b, r) => r.go },
    ],
  });

  // ---- Redundancy (inner planets) ----
  const single = make('mars-climate', {}, { missionName: 'Single-string Mars', redundant: [] });
  out.push({
    id: 'single-string-mars', label: 'Single-string Mars, standard assurance', design: single,
    checks: [{ target: 'Reliability 80–90%', actual: (b) => pct(b.risk.reliabilityPct), pass: (b) => b.risk.reliabilityPct >= 80 && b.risk.reliabilityPct <= 90 }],
  });
  out.push({
    id: 'full-redundancy-mars', label: 'Same, fully redundant', design: { ...single, missionName: 'Dual-string Mars', redundant: ['avionics', 'adcs', 'transmitter', 'battery'] },
    checks: [{ target: 'Reliability ≥ 93%', actual: (b) => pct(b.risk.reliabilityPct), pass: (b) => b.risk.reliabilityPct >= 93 }],
  });

  return out;
}
