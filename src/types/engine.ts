/**
 * SHARED CONTRACT — what the engine (Track A) returns and the UI (Track C) renders.
 * Plain TS (not zod): produced by our own code, never parsed from outside.
 * Additive changes only without a team ping — see AGENTS.md §Contracts.
 */
import type {
  Constants,
  Destination,
  EventCard,
  GlossaryEntry,
  HistoricalMission,
  Instrument,
  LaunchVehicle,
  MissionClass,
  Part,
  PlanetaryElements,
  ReviewRule,
  Scenario,
  SlotId,
  Source,
  SpaceWeatherEvent,
  Trajectory,
} from './catalog';
import type { DecisionLog, MissionDesign } from './design';

/** Everything static, loaded once from src/data (see src/data/index.ts). */
export interface Catalog {
  sources: Source[];
  constants: Constants;
  missionClasses: MissionClass[];
  destinations: Destination[];
  trajectories: Trajectory[];
  launchVehicles: LaunchVehicle[];
  parts: Part[];
  instruments: Instrument[];
  scenarios: Scenario[];
  events: EventCard[];
  spaceWeather: SpaceWeatherEvent[];
  history: HistoricalMission[];
  reviewRules: ReviewRule[];
  planetaryElements: PlanetaryElements[];
  glossary?: GlossaryEntry[];
}

export type Severity = 'green' | 'yellow' | 'red';

/** One link in a cause→effect chain. The UI shows these as "ripple chips" and "Why?" tooltips. */
export interface Explanation {
  metric: string; // e.g. "mass.propellantKg"
  text: string; // "Bigger dish (+12 kg) → +19 kg propellant to brake into orbit"
  formula?: string; // "m_prop = m_dry · (e^(Δv / (Isp·g0)) − 1)"
  sourceIds?: string[];
}

export interface LineItem {
  id: string; // part/instrument id or synthetic ("structure", "harness", "wrap", "launch", "ops", "reserve")
  label: string;
  value: number;
}

export interface MassBudget {
  items: LineItem[]; // kg
  dryKg: number; // incl. structure + harness + growth allowance
  growthAllowanceKg: number; // TRL-based contingency inside dryKg
  propellantKg: number;
  wetKg: number;
  lvCapacityKg: number; // at the design's C3
  marginPct: number; // (capacity − wet) / capacity × 100
  converged: boolean; // false = rocket-equation mass spiral diverged (infeasible)
}

export interface PowerBudget {
  source: 'solar' | 'rtg';
  generatedBolW: number; // at destination, beginning of life
  generatedEolW: number; // at destination, end of primary mission
  loadScienceW: number;
  loadDownlinkW: number;
  loadSafeW: number;
  marginPct: number; // (EOL generated − max(load science, downlink)) / load × 100
  eclipseMinutes: number; // per orbit, worst case
  batteryRequiredWh: number;
  batteryWh: number;
  batteryMarginPct: number;
}

export interface DeltaVBudget {
  items: LineItem[]; // m/s: dsm, tcm, insertion, maintenance, disposal, margin
  totalMs: number;
}

export interface CommsBudget {
  band: 'X' | 'Ka';
  rateKbpsAtMean: number;
  rateKbpsAtMax: number; // at maximum Earth distance (worst case)
  downlinkGbPerDay: number; // at mean distance with chosen DSN hours
  generatedGbPerDay: number; // all instruments, nominal duty cycle
  storageGb: number;
  dataMarginPct: number; // (downlink − generated) / generated × 100
}

export interface CostBudget {
  items: LineItem[]; // $M
  developmentM: number;
  launchM: number;
  operationsM: number;
  reserveM: number;
  totalM: number;
  capM: number;
  marginPct: number; // (cap − total) / cap × 100
}

export interface ObjectiveCoverage {
  objectiveId: string;
  quality: number; // 0..1 best achievable quality given instruments, orbit, pointing
  coveredBy: string[]; // instrument ids
  expectedPct: number; // 0..100, nominal (no anomalies)
  reason: string; // "Camera GSD 1.2 m meets ≤ 5 m requirement"
}

export interface BudgetReport {
  mass: MassBudget;
  power: PowerBudget;
  deltaV: DeltaVBudget;
  comms: CommsBudget;
  cost: CostBudget;
  science: { objectives: ObjectiveCoverage[]; expectedPct: number };
  radiation: { primaryDoseKrad: number; toleranceKrad: number; doseMarginPct: number };
  risk: { reliabilityPct: number; topRisks: { label: string; pFail: number }[] };
  /** Flat metric map the Review Board reads (keys are the `metric` field of review-rules.json):
   *  mass.marginPct, power.marginPct, power.batteryMarginPct, comms.dataMarginPct, cost.marginPct,
   *  cost.reservePct, radiation.doseMarginPct, science.expectedPct, risk.reliabilityPct */
  metrics: Record<string, number>;
  feasible: boolean;
  blockers: string[]; // hard blockers ("Over launch capacity by 312 kg")
  explain: Explanation[];
}

export interface ReviewFinding {
  ruleId: string;
  severity: Severity;
  title: string;
  message: string;
  value: number;
  threshold: number;
  fixHint: string;
  sourceIds: string[];
}

export interface ReviewResult {
  go: boolean; // no red findings and feasible
  findings: ReviewFinding[];
  predictedSuccessPct?: number; // P1: Monte Carlo of N headless runs
  predictedSciencePct?: { p10: number; p50: number; p90: number };
  predictedSurvivalPct?: number; // share of those runs in which the spacecraft was not lost (whatever the science)
}

/** Pre-launch "reality check": parts come in heavier / costlier than estimated (seeded by TRL). */
export interface GrowthReveal {
  massGrowthKg: number;
  costGrowthM: number;
  newMassMarginPct: number;
  reserveRemainingM: number;
  mustDescope: boolean; // true → UI asks player to drop an instrument / swap LV before launch
  /** One line per part/instrument: how much it GREW by (kg, $M) over its catalogue estimate. */
  lines: { id: string; label: string; massKg: number; costM: number }[];
  massAllowanceKg?: number; // the TRL growth allowance the design carried — compare with massGrowthKg
  newWetKg?: number; // launch mass once the actual growth replaces the allowance
  lvCapacityKg?: number; // what the rocket can lift at this design's C3
}

export type SimPhase = 'launch' | 'cruise' | 'arrival' | 'aerobraking' | 'science' | 'extended' | 'ended';
export type HealthState = 'ok' | 'degraded' | 'failed';

export interface Vec2 {
  x: number; // heliocentric ecliptic, AU
  y: number;
}

export interface LogEntry {
  day: number;
  date: string; // ISO
  kind: 'info' | 'milestone' | 'event' | 'decision' | 'anomaly' | 'science';
  text: string;
  eventId?: string;
  optionId?: string;
}

export interface PendingEvent {
  card: EventCard;
  day: number;
  /** Context lines the UI shows under the narrative ("Battery at 41%", "Flare class X9.3 (DONKI 2017-09-06)"). */
  context: string[];
}

export interface SimState {
  day: number; // days since launch
  date: string;
  phase: SimPhase;
  spacecraft: Vec2;
  earth: Vec2;
  target: Vec2;
  sunDistanceAU: number;
  earthDistanceAU: number;
  powerW: number; // generated now
  batterySoc: number; // 0..1
  storageUsedGb: number;
  propellantKg: number;
  doseKrad: number;
  reserveRemainingM: number;
  health: Partial<Record<SlotId | string, HealthState>>; // slots + instrument ids
  safeModeDaysLeft: number;
  downlinkedGbByObjective: Record<string, number>;
  dataLostGb: number;
  sciencePct: number; // running total, 0..100
  objectivePct?: Record<string, number>; // per objective id, 0..100 — same credit formula as sciencePct
  inConjunction?: boolean; // the Sun is between the spacecraft and Earth: no downlink today
  pending?: PendingEvent;
  ended: boolean;
  lossCause?: string;
}

export interface AdvanceResult {
  state: SimState;
  newLog: LogEntry[];
  pending?: PendingEvent;
}

/** Interactive simulation handle used by the Flight screen. */
export interface Simulation {
  readonly state: SimState;
  readonly log: LogEntry[];
  readonly decisions: DecisionLog;
  /** Run forward up to `days` days; stops early at a pending decision or when the mission ends. */
  advance(days: number): AdvanceResult;
  /** Resolve the pending event with an option id; returns the outcome log lines. */
  decide(optionId: string): AdvanceResult;
  /** The mission so far as a MissionResult (call when `state.ended` to get the final result for the debrief). */
  result(): MissionResult;
}

export type Outcome = 'exceeded' | 'full' | 'threshold' | 'partial' | 'lost';

export interface MissionResult {
  outcome: Outcome;
  sciencePct: number; // 0..100 weighted by objective
  objectives: { objectiveId: string; pct: number; metThreshold: boolean }[];
  totalCostM: number;
  underBudget: boolean;
  stars: 0 | 1 | 2 | 3; // ★ baseline science met, ★ under cap, ★ survived primary mission without loss
  daysFlown: number;
  lossCause?: string;
  log: LogEntry[];
  finalState: SimState;
}

export interface HindsightItem {
  dimension: string; // "Antenna", "Trajectory", "Assurance", ...
  fromLabel: string;
  toLabel: string;
  deltaSciencePct: number; // + = the alternative would have done better
  deltaCostM: number;
  feasible: boolean;
  explanation: string; // one sentence, e.g. "A 3 m dish would have doubled downlink at Jupiter"
}

export interface ComparisonRow {
  label: string; // "Launch mass"
  yours: string; // formatted
  theirs: string;
  note?: string;
}

export interface Debrief {
  result: MissionResult;
  headline: string; // "Full success — 87% of baseline science returned"
  hindsight: HindsightItem[]; // sorted, biggest improvement first (top 3 shown)
  bestDecision?: HindsightItem; // the choice whose alternatives all would have scored worse
  comparison: { mission: HistoricalMission; rows: ComparisonRow[] };
  monteCarlo?: { runs: number; successRatePct: number; scienceP10: number; scienceP50: number; scienceP90: number; sciencePcts?: number[]; lostPct?: number };
  /** Every alternative Hindsight looked at, best first (infeasible ones last) — for a "what if" explorer. */
  explored?: HindsightItem[];
  replays?: number; // how many alternate missions were flown to build `hindsight`
}

/** The engine's public API (implemented in src/engine/index.ts). UI imports ONLY these. */
export interface EngineApi {
  defaultDesign(catalog: Catalog, scenarioId: string): MissionDesign;
  computeBudgets(catalog: Catalog, design: MissionDesign): BudgetReport;
  runReview(catalog: Catalog, design: MissionDesign, opts?: { monteCarloRuns?: number }): ReviewResult;
  revealGrowth(catalog: Catalog, design: MissionDesign, seed: number): GrowthReveal;
  createSimulation(catalog: Catalog, design: MissionDesign, seed: number): Simulation;
  runHeadless(catalog: Catalog, design: MissionDesign, seed: number, decisions?: DecisionLog): MissionResult;
  buildDebrief(
    catalog: Catalog,
    design: MissionDesign,
    seed: number,
    decisions: DecisionLog,
    result: MissionResult,
    opts?: { monteCarloRuns?: number },
  ): Debrief;
  /** Same results as buildDebrief / runReview, computed in a Web Worker so the page stays responsive
   *  (Hindsight flies ~50 alternate missions). Falls back to the synchronous call where Workers are unavailable. */
  buildDebriefAsync?(
    catalog: Catalog,
    design: MissionDesign,
    seed: number,
    decisions: DecisionLog,
    result: MissionResult,
    opts?: { monteCarloRuns?: number },
  ): Promise<Debrief>;
  runReviewAsync?(catalog: Catalog, design: MissionDesign, opts?: { monteCarloRuns?: number }): Promise<ReviewResult>;
}
