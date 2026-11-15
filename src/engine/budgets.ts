/**
 * computeBudgets — the heart of the design phase. Pure, synchronous, < 1 ms. Called on every slider move.
 * v0 written during kickoff so the UI has real numbers on day one. Track A owns, refines and calibrates it
 * (see docs/GAME_DESIGN.md §4 for the formulas and docs/tracks/TRACK_A_ENGINE.md for the calibration targets).
 */
import { getDestination, getInstrument, getLaunchVehicle, getMissionClass, getPart, getScenario, getTrajectory } from '../data';
import type { Instrument, LaunchVehicle, Part, SlotId } from '../types/catalog';
import type { MissionDesign } from '../types/design';
import type { BudgetReport, Catalog, Explanation, LineItem, ObjectiveCoverage } from '../types/engine';
import { eclipseMinutes, insertionDvMs } from './orbits';

const C_KM_S = 299792.458;
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

// ---- Model constants (GAME_DESIGN §4). Physical/tunable data lives in constants.json; these are fixed model rules. ----
/** Extra Δv for walking into and out of the atmosphere when aerobraking (§4.1). */
const AEROBRAKE_WALK_DV_MS = 30;
/** An ion engine's thrust is far too low to capture from a fast hyperbolic arrival (§4.1). */
const ION_MAX_CAPTURE_VINF_KMS = 1;
/** Beyond this the mass spiral counts as diverged: "the rocket equation wins" (§4.2). */
const MAX_PROPELLANT_KG = 1e6;
/** Solar array packing factor × pointing/cosine losses (§4.3). */
const ARRAY_PACKING_FACTOR = 0.85;
/** Low-intensity, low-temperature (LILT) cell loss far from the Sun (§4.3). */
const LILT_FACTOR = 0.8;
const LILT_BEYOND_AU = 3;
/** Ground-system / modem ceiling on the downlink rate (§4.4). */
const MAX_DOWNLINK_BPS = 300e6;
/** Interplanetary cruise dose behind nominal shielding, krad per year (§4.6). */
export const CRUISE_DOSE_KRAD_PER_YEAR = 1.0;

/** Options for what-if budgets. Used by the Reality Check (growth.ts) — the UI never passes these. */
export interface BudgetOptions {
  /** Replace the TRL growth *allowance* with this *actual* mass growth (kg). */
  massGrowthKg?: number;
}

/** Launch vehicle capacity (kg) at a C3, linear interpolation over the LSP-sampled curve. */
export function lvCapacityKg(lv: LaunchVehicle, c3: number): number {
  const p = lv.performance;
  if (c3 <= p[0].c3Km2s2) return p[0].massKg;
  if (c3 > p[p.length - 1].c3Km2s2) return 0;
  for (let i = 1; i < p.length; i++) {
    if (c3 <= p[i].c3Km2s2) {
      const t = (c3 - p[i - 1].c3Km2s2) / (p[i].c3Km2s2 - p[i - 1].c3Km2s2);
      return p[i - 1].massKg + t * (p[i].massKg - p[i - 1].massKg);
    }
  }
  return 0;
}

/** Everything derived from a design that several budgets need. Exported for the simulator. */
export function resolveDesign(catalog: Catalog, design: MissionDesign) {
  const scenario = getScenario(catalog, design.scenarioId);
  const dest = getDestination(catalog, scenario.destinationId);
  const orbit = dest.orbits.find((o) => o.id === design.orbitId) ?? dest.orbits[0];
  const traj = getTrajectory(catalog, design.trajectoryId);
  const lv = getLaunchVehicle(catalog, design.launchVehicleId);
  const mclass = getMissionClass(catalog, scenario.missionClassId);
  const parts = Object.fromEntries(
    Object.entries(design.parts).map(([slot, id]) => [slot, getPart(catalog, id as string)]),
  ) as Partial<Record<SlotId, Part>>;
  const instruments: Instrument[] = design.instrumentIds.map((id) => getInstrument(catalog, id));
  const c3 = traj.c3Km2s2 + catalog.constants.offOptimalC3PerDay * Math.abs(design.launchOffsetDays);
  const cruiseYears = traj.tofDays / 365.25;
  const aerobrakingDays = orbit.aerobraking?.aerobrakingDays ?? 0;
  return { scenario, dest, orbit, traj, lv, mclass, parts, instruments, c3, cruiseYears, aerobrakingDays };
}

/**
 * Quality (0..1) an instrument achieves for a measurement type in this design:
 * base quality × orbit modifier × pointing penalty × resolution penalty (GSD = altitude × IFOV).
 */
export function instrumentQuality(
  r: ReturnType<typeof resolveDesign>,
  design: MissionDesign,
  ins: Instrument,
  type: string,
  maxGsdM?: number,
): number {
  const base = ins.measures.find((m) => m.type === type)?.quality ?? 0;
  let q = base * ((r.orbit.scienceModifiers as Record<string, number>)[type] ?? 1);
  if ((r.parts.adcs?.specs.pointingDeg ?? 1) > ins.pointingReqDeg) q *= 0.5;
  if (type === 'gravity_science' && design.commsBand !== 'Ka') q = 0;
  if (maxGsdM && ins.ifovUrad) {
    const gsd = (r.orbit.periapsisAltKm * ins.ifovUrad) / 1000;
    if (gsd > maxGsdM) q *= maxGsdM / gsd;
  }
  return q;
}

type Resolved = ReturnType<typeof resolveDesign>;

/** One piece of flight hardware as built: a part (incl. redundancy and solar area) or an instrument. */
export interface HardwareItem {
  id: string;
  label: string;
  slot?: SlotId; // undefined for instruments
  massKg: number;
  costM: number;
  trl: number;
}

/** Every part and instrument with its as-designed mass and cost (§4.2, §4.8). Shared by the mass budget, the cost
 *  budget and the Reality Check so that they can never disagree. */
export function hardwareItems(catalog: Catalog, design: MissionDesign, r: Resolved = resolveDesign(catalog, design)): HardwareItem[] {
  const K = catalog.constants;
  const items: HardwareItem[] = [];
  for (const [slot, p] of Object.entries(r.parts) as [SlotId, Part][]) {
    const dual = (design.redundant as string[]).includes(slot);
    let massKg = p.massKg * (dual ? K.redundancy.massMultiplier : 1);
    let costM = p.costM * (dual ? K.redundancy.costMultiplier : 1);
    if (slot === 'power' && p.specs.solarEfficiency !== undefined) {
      massKg += design.solarArrayAreaM2 * (p.specs.solarKgPerM2 ?? 0);
      costM += design.solarArrayAreaM2 * (p.specs.solarCostMPerM2 ?? 0);
    }
    items.push({ id: p.id, label: p.name + (dual ? ' (dual)' : ''), slot, massKg, costM, trl: p.trl });
  }
  for (const ins of r.instruments) items.push({ id: ins.id, label: ins.name, massKg: ins.massKg, costM: ins.costM, trl: ins.trl });
  return items;
}

/** Fractional mass growth expected for a technology readiness level (§4.2). */
export function growthFractionForTrl(catalog: Catalog, trl: number): number {
  return catalog.constants.massGrowthByTrl[String(trl)] ?? 0.1;
}

/** Power generation (§4.3). `generatedW(sunDistanceAU, yearsSinceLaunch)` is shared by the budget and the flight sim. */
export function powerModel(catalog: Catalog, design: MissionDesign, r: Resolved = resolveDesign(catalog, design)) {
  const K = catalog.constants;
  const power = r.parts.power;
  const isSolar = power?.specs.solarEfficiency !== undefined;
  const areaM2 = isSolar ? design.solarArrayAreaM2 : 0;
  const lossPerYear = isSolar
    ? (power?.specs.solarDegradationPerYear ?? 0.02) + r.dest.solarArrayExtraDegradationPerYear
    : power?.specs.rtgDecayPerYear ?? 0.04;
  const generatedW = (sunDistanceAU: number, years: number): number => {
    if (!power) return 0;
    const aging = Math.pow(1 - lossPerYear, years);
    if (!isSolar) return (power.specs.rtgBolW ?? 0) * aging;
    const lilt = sunDistanceAU > LILT_BEYOND_AU ? LILT_FACTOR : 1;
    return (K.solarConstantWm2 / (sunDistanceAU * sunDistanceAU)) * areaM2 * (power.specs.solarEfficiency ?? 0.2) * ARRAY_PACKING_FACTOR * lilt * aging;
  };
  return { isSolar, areaM2, generatedW };
}

/** DSN link budget (§4.4). Returns the pieces plus `rateBps(distanceAU)`. */
export function linkModel(catalog: Catalog, design: MissionDesign, r: Resolved = resolveDesign(catalog, design)) {
  const K = catalog.constants;
  const band = K.bands[design.commsBand];
  const ant = r.parts.antenna, tx = r.parts.transmitter;
  const lambdaM = C_KM_S / (band.freqGHz * 1e6); // λ = c / f in metres (299 792.458 km/s ÷ (GHz·1e6) ≡ 2.998e8 m/s ÷ Hz)
  const diameterM = ant?.specs.diameterM ?? 0;
  const gainTxDbi = diameterM > 0
    ? 10 * Math.log10((ant?.specs.apertureEfficiency ?? 0.55) * Math.pow((Math.PI * diameterM) / lambdaM, 2))
    : ant?.specs.fixedGainDbi ?? 0;
  const beamwidthDeg = diameterM > 0 ? (70 * lambdaM) / diameterM : 90;
  const pointingErrDeg = r.parts.adcs?.specs.pointingDeg ?? 1;
  const pointingLossDb = Math.min(30, 12 * Math.pow(pointingErrDeg / beamwidthDeg, 2));
  const eirpDbW = 10 * Math.log10(Math.max(0.01, tx?.specs.rfPowerW ?? 0)) + gainTxDbi - pointingLossDb;
  const use70m = design.dsnAperture === '70m' && design.commsBand === 'X'; // the 70 m dishes have no Ka downlink
  const gainRxDbi = use70m ? band.dsn70GainDbi : band.dsn34GainDbi;
  const n0DbWHz = K.boltzmannDbW + 10 * Math.log10(band.systemNoiseTempK);
  const rateBps = (distAU: number) => {
    const fslDb = 20 * Math.log10((4 * Math.PI * distAU * K.auKm * 1000) / lambdaM);
    const rDb = eirpDbW + gainRxDbi - fslDb - K.linkMiscLossDb - band.extraLossDb - n0DbWHz - K.linkRequiredEbN0Db - K.linkMarginDb;
    return Math.min(MAX_DOWNLINK_BPS, Math.pow(10, rDb / 10));
  };
  return { lambdaM, diameterM, gainTxDbi, beamwidthDeg, pointingLossDb, eirpDbW, use70m, gainRxDbi, rateBps };
}

export function computeBudgets(catalog: Catalog, design: MissionDesign, opts: BudgetOptions = {}): BudgetReport {
  const K = catalog.constants;
  const r = resolveDesign(catalog, design);
  const { scenario, dest, orbit, traj, lv, mclass, parts, instruments, c3, cruiseYears } = r;
  const blockers: string[] = [];
  const explain: Explanation[] = [];
  const isRedundant = (slot: SlotId) => (design.redundant as string[]).includes(slot);
  const primaryYears = scenario.primaryMissionYears;

  for (const slot of ['power', 'battery', 'propulsion', 'antenna', 'transmitter', 'adcs', 'avionics', 'thermal'] as SlotId[])
    if (!parts[slot]) blockers.push(`No ${slot} selected`);
  const power = parts.power, prop = parts.propulsion, ant = parts.antenna, tx = parts.transmitter;
  const adcs = parts.adcs, avi = parts.avionics, thermal = parts.thermal, shield = parts.shielding;
  const isSolar = power?.specs.solarEfficiency !== undefined;
  const area = isSolar ? design.solarArrayAreaM2 : 0;

  // ---------------- Δv ----------------
  const insertion = insertionDvMs(dest, orbit, traj.arrivalVinfKms);
  const dvItems: LineItem[] = [
    { id: 'dsm', label: 'Deep-space manoeuvres', value: traj.dsmDvMs },
    { id: 'tcm', label: 'Trajectory corrections', value: traj.tcmDvMs },
    { id: 'insertion', label: orbit.aerobraking ? 'Capture burn (then aerobrake)' : 'Orbit insertion', value: insertion },
    ...(orbit.aerobraking ? [{ id: 'aerobrake-walk', label: 'Aerobraking walk-in/out', value: AEROBRAKE_WALK_DV_MS }] : []),
    { id: 'maintenance', label: `Orbit maintenance (${primaryYears} yr)`, value: orbit.maintenanceDvMsPerYear * primaryYears },
    { id: 'disposal', label: 'End-of-mission disposal', value: K.disposalDvMs },
  ];
  const dvSubtotal = dvItems.reduce((a, b) => a + b.value, 0);
  dvItems.push({ id: 'margin', label: `Δv margin (${K.dvMarginPct}%)`, value: (dvSubtotal * K.dvMarginPct) / 100 });
  const totalDv = dvItems.reduce((a, b) => a + b.value, 0);
  if (prop?.specs.propulsionKind === 'electric' && traj.arrivalVinfKms > ION_MAX_CAPTURE_VINF_KMS && dest.kind !== 'small_body')
    blockers.push(`An ion engine can't brake into orbit at ${dest.name} (arriving at ${traj.arrivalVinfKms} km/s) — choose a chemical engine`);

  // ---------------- mass ----------------
  const hwItems = hardwareItems(catalog, design, r);
  const massItems: LineItem[] = hwItems.map((it) => ({ id: it.id, label: it.label, value: it.massKg }));
  const allowance = hwItems.reduce((a, it) => a + it.massKg * growthFractionForTrl(catalog, it.trl), 0);
  // Design time: carry the TRL allowance. After the Reality Check: carry what the hardware actually grew by.
  const growth = opts.massGrowthKg ?? allowance;
  const hw = massItems.reduce((a, b) => a + b.value, 0);
  const bus = K.busBaseMassKg[mclass.id];
  const structure = K.structureFraction * (hw + growth + bus);
  const harness = K.harnessFraction * (hw + growth);
  massItems.push(
    { id: 'bus', label: 'Bus core (structure, mechanisms)', value: bus },
    { id: 'structure', label: 'Secondary structure', value: structure },
    { id: 'harness', label: 'Cabling harness', value: harness },
    { id: 'growth', label: opts.massGrowthKg === undefined ? 'Growth allowance (by TRL)' : 'Actual mass growth', value: growth },
  );
  const dryBase = hw + growth + bus + structure + harness;
  const isp = prop?.specs.ispS ?? 220;
  const tankFrac = prop?.specs.tankFraction ?? 0.12;
  const massRatio = Math.exp(totalDv / (isp * K.g0Ms2));
  // Rocket equation with tanks that scale with propellant: prop = (dryBase + tankFrac·prop)·(MR − 1).
  // That fixed point has the closed form below; when tankFrac·(MR − 1) ≥ 1 every extra kg of propellant needs
  // more than a kg of tank + propellant to push it, so no finite answer exists — the mass spiral diverges.
  const spiral = 1 - tankFrac * (massRatio - 1);
  let propellant = spiral > 0 ? (dryBase * (massRatio - 1)) / spiral : Infinity;
  const converged = Number.isFinite(propellant) && propellant <= MAX_PROPELLANT_KG;
  if (!converged) propellant = MAX_PROPELLANT_KG; // keep every output finite for the UI
  const tanks = tankFrac * propellant;
  massItems.push({ id: 'tanks', label: 'Propellant tanks', value: tanks });
  const dry = dryBase + tanks;
  const wet = dry + propellant;
  const lvCap = lvCapacityKg(lv, c3);
  const massMargin = lvCap > 0 ? ((lvCap - wet) / lvCap) * 100 : -100;
  if (!converged) blockers.push('The rocket equation wins: the propellant needed to carry the propellant never converges. Cut Δv or mass.');
  else if (lvCap <= 0) blockers.push(`${lv.name} can't reach C3 ${round(c3)} km²/s² at all — pick a bigger rocket or a gentler trajectory`);
  else if (wet > lvCap) blockers.push(`Over launch capacity by ${Math.round(wet - lvCap)} kg at C3 ${round(c3)} km²/s²`);
  explain.push({
    metric: 'mass.propellantKg',
    text: `${Math.round(dry)} kg dry needs ${Math.round(propellant)} kg propellant for ${Math.round(totalDv)} m/s at Isp ${isp} s`,
    formula: 'm_prop = m_dry · (e^(Δv / (Isp·g0)) − 1)',
    sourceIds: ['nasa-se-handbook'],
  });

  // ---------------- power ----------------
  const d = dest.solarDistanceAU;
  const lifeYears = cruiseYears + primaryYears;
  const pm = powerModel(catalog, design, r);
  const lilt = d > LILT_BEYOND_AU ? LILT_FACTOR : 1;
  const bol = pm.generatedW(d, isSolar ? 0 : cruiseYears); // at the destination, on arrival
  const eol = pm.generatedW(d, lifeYears);
  const heater = (thermal?.specs.heaterWPerAU ?? 0) * Math.max(0, d - 1);
  const busLoad = [adcs, avi, thermal, prop?.specs.propulsionKind === 'electric' ? undefined : prop]
    .reduce((a, p) => a + (p?.powerW ?? 0), 0) + heater;
  const insLoad = instruments.reduce((a, i) => a + i.powerW, 0);
  const loadScience = busLoad + insLoad;
  const loadDownlink = busLoad + (tx?.powerW ?? 0);
  const loadPeak = Math.max(loadScience, loadDownlink);
  const powerMargin = loadPeak > 0 ? ((eol - loadPeak) / loadPeak) * 100 : 100;
  const eclMin = eclipseMinutes(dest, orbit);
  // In eclipse a solar spacecraft runs on the battery alone; an RTG keeps generating, so the battery only covers the shortfall.
  const eclipseDrawW = isSolar ? loadScience : Math.max(0, loadScience - eol);
  const batRequired = (eclipseDrawW * eclMin) / 60 / (parts.battery?.specs.maxDepthOfDischarge ?? 0.6);
  const batWh = (parts.battery?.specs.batteryWh ?? 0) * (isRedundant('battery') ? 2 : 1);
  const batMargin = batRequired > 0 ? (batWh / batRequired - 1) * 100 : 999;
  if (prop?.specs.propulsionKind === 'electric') {
    const atEarth = isSolar ? (bol / lilt) * d * d : bol; // arrays at 1 AU: no distance or LILT loss
    if (atEarth < prop.powerW + busLoad) blockers.push(`The ion engine needs ${prop.powerW} W — your arrays make only ${Math.round(atEarth)} W near Earth`);
  }
  if (thermal && (1 / (d * d)) < (thermal.specs.minSolarFluxFraction ?? 0))
    blockers.push(`${thermal.name} can't keep the spacecraft warm at ${d} AU`);
  explain.push({
    metric: 'power.generatedEolW',
    text: isSolar
      ? `Sunlight at ${d} AU is ${round(100 / (d * d), 0)}% of Earth's: ${area} m² gives ${Math.round(eol)} W at end of mission`
      : `RTG gives ${Math.round(eol)} W after ${round(lifeYears)} years of decay`,
    formula: isSolar ? 'P = 1361 W/m² ÷ d² × A × η × 0.85 × (1 − degradation)^years' : 'P = P₀ × (1 − decay)^years',
    sourceIds: isSolar ? ['nssdca-factsheet', 'nasa-sst-soa'] : ['nasa-rps'],
  });

  // ---------------- comms ----------------
  const bandKey = design.commsBand;
  const link = linkModel(catalog, design, r);
  const { rateBps, use70m: use70, diameterM: diam } = link;
  if (ant && bandKey === 'Ka' && !(ant.specs.bands ?? ['X']).includes('Ka')) blockers.push(`${ant.name} is not Ka-band capable`);
  const rateMean = rateBps(dest.earthDistanceAU.mean);
  const rateMax = rateBps(dest.earthDistanceAU.max);
  const downlinkGbPerDay = (rateMean * design.dsnHoursPerDay * 3600) / 1e9;
  const dutyMult = orbit.dutyCycleMultiplier ?? 1;
  const genGbPerDay = instruments.reduce((a, i) => a + (i.dataRateKbps * 1000 * i.dutyCycle * dutyMult * 86400) / 1e9, 0);
  const dataMargin = genGbPerDay > 0 ? ((downlinkGbPerDay - genGbPerDay) / genGbPerDay) * 100 : 100;
  explain.push({
    metric: 'comms.rateKbpsAtMean',
    text: `${diam > 0 ? diam + ' m dish' : 'Low-gain antenna'} + ${tx?.specs.rfPowerW ?? 0} W at ${dest.earthDistanceAU.mean} AU → ${round(rateMean / 1000, 1)} kbps to a ${use70 ? 70 : 34} m DSN dish`,
    formula: 'R = P·Gt·Gr·(λ / 4πd)² / (k·T·Eb/N0)  — data rate falls with distance²',
    sourceIds: ['nasa-dsn-810-005'],
  });

  // ---------------- science (nominal expectation) ----------------
  const scienceDays = Math.max(0, primaryYears * 365 - r.aerobrakingDays);
  const downlinkShare = genGbPerDay > 0 ? Math.min(1, downlinkGbPerDay / genGbPerDay) : 1;
  const qualityOf = (ins: Instrument, type: string, maxGsdM?: number) => instrumentQuality(r, design, ins, type, maxGsdM);
  const objectives: ObjectiveCoverage[] = scenario.objectives.map((o) => {
    const perMeasurement = o.measurements.map((m) => {
      const candidates = instruments.filter((i) => i.measures.some((x) => x.type === m.type));
      const best = candidates.map((i) => ({ i, q: qualityOf(i, m.type, o.maxGsdM) })).sort((a, b) => b.q - a.q)[0];
      const vol = candidates.reduce((a, i) => a + (i.dataRateKbps * 1000 * i.dutyCycle * dutyMult * 86400 * scienceDays) / 1e9, 0) * downlinkShare;
      const q = best?.q ?? 0;
      const credit = q >= m.minQuality ? q * Math.min(1, vol / m.requiredGb) : 0;
      return { credit, q, ids: candidates.map((i) => i.id), vol, need: m.requiredGb, type: m.type, minQ: m.minQuality };
    });
    const pick = o.combine === 'any' ? Math.max(...perMeasurement.map((p) => p.credit)) : Math.min(...perMeasurement.map((p) => p.credit));
    const quality = o.combine === 'any' ? Math.max(...perMeasurement.map((p) => p.q)) : Math.min(...perMeasurement.map((p) => p.q));
    const missing = perMeasurement.filter((p) => p.ids.length === 0).map((p) => p.type);
    // 'any' objectives need just one measurement, so only report a gap when *none* is covered; 'all' needs every one.
    const uncovered = o.combine === 'any' ? missing.length === perMeasurement.length : missing.length > 0;
    const describe = (p: (typeof perMeasurement)[number]) =>
      `${p.type}: ${p.vol < 10 ? round(p.vol, 2) : Math.round(p.vol)}/${p.need} Gb at quality ${round(p.q, 2)}${p.q < p.minQ ? ` (below the ${p.minQ} needed)` : ''}`;
    const reason = uncovered
      ? `No instrument for ${missing.join(o.combine === 'any' ? ' or ' : ', ')}`
      : perMeasurement.filter((p) => p.ids.length > 0).map(describe).join('; ');
    return { objectiveId: o.id, quality, coveredBy: [...new Set(perMeasurement.flatMap((p) => p.ids))], expectedPct: pick * 100, reason };
  });
  const expectedPct = scenario.objectives.reduce((a, o, idx) => a + (o.weight * objectives[idx].expectedPct) / 100, 0);

  // ---------------- radiation ----------------
  const doseFactor = shield?.specs.doseFactor ?? 1;
  const primaryDose = dest.radiationKradPerYear * (orbit.radiationMultiplier ?? 1) * doseFactor * primaryYears + CRUISE_DOSE_KRAD_PER_YEAR * cruiseYears * doseFactor;
  const tolerance = avi?.specs.radToleranceKrad ?? 20;
  const doseMargin = primaryDose > 0 ? (tolerance / primaryDose - 1) * 100 : 999;

  // ---------------- reliability (probability of no mission-ending failure) ----------------
  const hazardMult = K.assurance[design.assurance]?.hazardMultiplier ?? 1;
  const T = cruiseYears + primaryYears;
  const critical: SlotId[] = ['avionics', 'power', 'transmitter', 'propulsion', 'battery'];
  const risks: { label: string; pFail: number }[] = [];
  let pSurvive = lv.reliability;
  risks.push({ label: `${lv.name} launch`, pFail: 1 - lv.reliability });
  for (const slot of critical) {
    const p = parts[slot];
    if (!p) continue;
    let pf = 1 - Math.exp(-p.failureRatePerYear * hazardMult * T);
    if (slot === 'avionics' && primaryDose > tolerance) pf = Math.max(pf, Math.min(0.95, 0.5 + 0.5 * ((primaryDose - tolerance) / tolerance)));
    if (isRedundant(slot)) pf = (1 - K.redundancy.commonCauseBeta) * pf * pf + K.redundancy.commonCauseBeta * pf;
    pSurvive *= 1 - pf;
    risks.push({ label: p.name + (isRedundant(slot) ? ' (dual)' : ''), pFail: pf });
  }
  risks.sort((a, b) => b.pFail - a.pFail);

  // ---------------- cost ----------------
  const costItems: LineItem[] = hwItems.map((it) => ({ id: it.id, label: it.label, value: it.costM }));
  costItems.push({ id: 'bus', label: 'Bus core', value: K.busBaseCostM[mclass.id] });
  const hardware = costItems.reduce((a, b) => a + b.value, 0);
  const wrap = hardware * K.costWrapFraction[mclass.id];
  const assuranceCost = (hardware + wrap) * (K.assurance[design.assurance]?.costFraction ?? 0);
  costItems.push({ id: 'wrap', label: 'Systems engineering, management, integration & test', value: wrap });
  costItems.push({ id: 'assurance', label: `Testing & assurance (${design.assurance})`, value: assuranceCost });
  const development = hardware + wrap + assuranceCost;
  const dsnPerYear = design.dsnHoursPerDay * 365 * (K.dsnCostPerHourM[design.dsnAperture] ?? 0.002);
  const ops = cruiseYears * 0.5 * K.opsCostPerYearM[mclass.id] + primaryYears * (K.opsCostPerYearM[mclass.id] + dsnPerYear);
  const reserve = (development * design.reservePct) / 100;
  costItems.push({ id: 'launch', label: lv.name, value: lv.costM });
  costItems.push({ id: 'ops', label: `Operations & DSN (${round(cruiseYears + primaryYears)} yr)`, value: ops });
  costItems.push({ id: 'reserve', label: `Reserves (${design.reservePct}%)`, value: reserve });
  const total = development + lv.costM + ops + reserve;
  const costMargin = ((mclass.costCapM - total) / mclass.costCapM) * 100;
  if (total > mclass.costCapM) blockers.push(`Over the ${mclass.name}-class cost cap by $${Math.round(total - mclass.costCapM)}M`);

  const report: BudgetReport = {
    mass: { items: massItems, dryKg: dry, growthAllowanceKg: growth, propellantKg: propellant, wetKg: wet, lvCapacityKg: lvCap, marginPct: massMargin, converged },
    power: {
      source: isSolar ? 'solar' : 'rtg', generatedBolW: bol, generatedEolW: eol, loadScienceW: loadScience, loadDownlinkW: loadDownlink,
      loadSafeW: busLoad, marginPct: powerMargin, eclipseMinutes: eclMin, batteryRequiredWh: batRequired, batteryWh: batWh, batteryMarginPct: batMargin,
    },
    deltaV: { items: dvItems, totalMs: totalDv },
    comms: { band: bandKey, rateKbpsAtMean: rateMean / 1000, rateKbpsAtMax: rateMax / 1000, downlinkGbPerDay, generatedGbPerDay: genGbPerDay, storageGb: avi?.specs.storageGb ?? 0, dataMarginPct: dataMargin },
    cost: { items: costItems, developmentM: development, launchM: lv.costM, operationsM: ops, reserveM: reserve, totalM: total, capM: mclass.costCapM, marginPct: costMargin },
    science: { objectives, expectedPct },
    radiation: { primaryDoseKrad: primaryDose, toleranceKrad: tolerance, doseMarginPct: doseMargin },
    risk: { reliabilityPct: pSurvive * 100, topRisks: risks.slice(0, 5) },
    metrics: {},
    feasible: blockers.length === 0,
    blockers,
    explain,
  };
  report.metrics = {
    'mass.marginPct': massMargin,
    'power.marginPct': powerMargin,
    'power.batteryMarginPct': batMargin,
    'comms.dataMarginPct': dataMargin,
    'cost.marginPct': costMargin,
    'cost.reservePct': design.reservePct,
    'radiation.doseMarginPct': doseMargin,
    'science.expectedPct': expectedPct,
    'risk.reliabilityPct': pSurvive * 100,
  };
  return report;
}
