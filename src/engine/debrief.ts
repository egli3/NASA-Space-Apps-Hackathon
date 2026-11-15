/**
 * Debrief — "what happened and which choices mattered" (GAME_DESIGN §6). Owner: Track A.
 * Headline, Hindsight (hindsight.ts), You vs History, and optionally Monte Carlo (montecarlo.ts).
 */
import { getHistory, getScenario } from '../data';
import type { DecisionLog, MissionDesign } from '../types/design';
import type { Catalog, ComparisonRow, Debrief, MissionResult } from '../types/engine';
import { computeBudgets } from './budgets';
import { buildHindsight } from './hindsight';
import { monteCarlo } from './montecarlo';

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
  seed: number,
  decisions: DecisionLog,
  result: MissionResult,
  opts?: { monteCarloRuns?: number },
): Debrief {
  const scenario = getScenario(catalog, design.scenarioId);
  const mission = getHistory(catalog, scenario.historicalMissionId);
  const b = computeBudgets(catalog, design);
  const fmt = (n: number | undefined, unit: string) => (n === undefined ? '—' : `${Math.round(n).toLocaleString('en-US')} ${unit}`);
  const sci = Math.round(result.sciencePct);

  // You vs History (§6.4). Our cost model is for scale only — never claim it reproduces theirs.
  const rows: ComparisonRow[] = [
    { label: 'Launch mass', yours: fmt(b.mass.wetKg, 'kg'), theirs: fmt(mission.stats.launchMassKg, 'kg') },
    { label: 'Dry mass', yours: fmt(b.mass.dryKg, 'kg'), theirs: fmt(mission.stats.dryMassKg, 'kg') },
    { label: 'Power at target', yours: fmt(b.power.generatedBolW, 'W'), theirs: fmt(mission.stats.powerAtTargetW, 'W'), note: mission.stats.powerSource },
    {
      label: 'Cost',
      yours: `$${Math.round(result.totalCostM).toLocaleString('en-US')}M (2026)`,
      theirs: mission.stats.costM ? `$${mission.stats.costM.toLocaleString('en-US')}M (${mission.stats.costYear})` : '—',
      note: 'For scale only: different years, different accounting.',
    },
    { label: 'Instruments', yours: String(design.instrumentIds.length), theirs: String(mission.stats.instruments ?? '—') },
    { label: 'Launch vehicle', yours: catalog.launchVehicles.find((l) => l.id === design.launchVehicleId)?.name ?? '', theirs: mission.stats.launchVehicle ?? '—' },
    {
      label: 'Outcome',
      yours: result.outcome === 'lost' ? `Lost on day ${result.daysFlown}: ${result.lossCause}` : `${OUTCOME_TEXT[result.outcome]} (${sci}% science)`,
      theirs: mission.outcome,
    },
    { label: 'Fun fact', yours: '', theirs: mission.funFact },
  ];

  const { hindsight, bestDecision, explored, replays } = buildHindsight(catalog, design, seed, decisions, result);
  const headline = result.outcome === 'lost'
    ? `Mission lost on day ${result.daysFlown} — ${sci}% of baseline science returned before the end`
    : `${OUTCOME_TEXT[result.outcome]} — ${sci}% of baseline science returned`;
  const debrief: Debrief = { result, headline, hindsight, bestDecision, comparison: { mission, rows }, explored, replays };
  if (opts?.monteCarloRuns) debrief.monteCarlo = monteCarlo(catalog, design, opts.monteCarloRuns, seed, decisions);
  return debrief;
}
