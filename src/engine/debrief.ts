/**
 * Debrief — "what happened and which choices mattered". Owner: Track A.
 * v0: headline + You-vs-History rows. Hindsight (counterfactual replays) and Monte Carlo are TODO — they are
 * the signature feature; see docs/GAME_DESIGN.md §6 for the exact algorithm.
 */
import { getHistory, getScenario } from '../data';
import type { DecisionLog, MissionDesign } from '../types/design';
import type { Catalog, ComparisonRow, Debrief, MissionResult } from '../types/engine';
import { computeBudgets } from './budgets';

const OUTCOME_TEXT: Record<MissionResult['outcome'], string> = {
  exceeded: 'Mission exceeded expectations',
  full: 'Full mission success',
  threshold: 'Threshold mission achieved',
  partial: 'Partial success',
  lost: 'Mission lost',
};

export function buildDebrief(
  catalog: Catalog,
  design: MissionDesign,
  _seed: number,
  _decisions: DecisionLog,
  result: MissionResult,
  _opts?: { monteCarloRuns?: number },
): Debrief {
  const scenario = getScenario(catalog, design.scenarioId);
  const mission = getHistory(catalog, scenario.historicalMissionId);
  const b = computeBudgets(catalog, design);
  const fmt = (n: number | undefined, unit: string) => (n === undefined ? '—' : `${Math.round(n).toLocaleString('en-US')} ${unit}`);
  const rows: ComparisonRow[] = [
    { label: 'Launch mass', yours: fmt(b.mass.wetKg, 'kg'), theirs: fmt(mission.stats.launchMassKg, 'kg') },
    { label: 'Dry mass', yours: fmt(b.mass.dryKg, 'kg'), theirs: fmt(mission.stats.dryMassKg, 'kg') },
    { label: 'Power at target', yours: fmt(b.power.generatedBolW, 'W'), theirs: fmt(mission.stats.powerAtTargetW, 'W'), note: mission.stats.powerSource },
    { label: 'Cost', yours: `$${Math.round(b.cost.totalM)}M (2026)`, theirs: mission.stats.costM ? `$${mission.stats.costM}M (${mission.stats.costYear})` : '—' },
    { label: 'Instruments', yours: String(design.instrumentIds.length), theirs: String(mission.stats.instruments ?? '—') },
    { label: 'Launch vehicle', yours: catalog.launchVehicles.find((l) => l.id === design.launchVehicleId)?.name ?? '', theirs: mission.stats.launchVehicle ?? '—' },
  ];
  // TODO(Track A, P0): hindsight — for each design dimension × alternative option, runHeadless with the same seed &
  // decisions, rank by Δscience; fill `hindsight` (top 3 shown) and `bestDecision`.
  // TODO(Track A, P1): monteCarlo — N seeds with the auto-policy.
  return {
    result,
    headline: `${OUTCOME_TEXT[result.outcome]} — ${Math.round(result.sciencePct)}% of baseline science returned`,
    hindsight: [],
    comparison: { mission, rows },
  };
}
