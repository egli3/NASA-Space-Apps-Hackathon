/**
 * Review Board — turns budget metrics into green/yellow/red findings using data-driven rules
 * (src/data/review-rules.json). Owner: Track A. Monte Carlo prediction (P1) plugs in via opts.monteCarloRuns.
 */
import type { MissionDesign } from '../types/design';
import type { Catalog, ReviewFinding, ReviewResult, Severity } from '../types/engine';
import { computeBudgets } from './budgets';

export function runReview(catalog: Catalog, design: MissionDesign, _opts?: { monteCarloRuns?: number }): ReviewResult {
  const budgets = computeBudgets(catalog, design);
  const findings: ReviewFinding[] = catalog.reviewRules.map((rule) => {
    const value = budgets.metrics[rule.metric] ?? NaN;
    let severity: Severity = 'green';
    if (rule.direction === 'min') severity = value < rule.red ? 'red' : value < rule.yellow ? 'yellow' : 'green';
    else severity = value > rule.red ? 'red' : value > rule.yellow ? 'yellow' : 'green';
    const shown = Math.round(value * 10) / 10;
    const threshold = rule.yellow;
    return {
      ruleId: rule.id,
      severity,
      title: rule.title,
      message: rule.message.replace('{value}', String(shown)).replace('{threshold}', String(threshold)),
      value,
      threshold,
      fixHint: rule.fixHint,
      sourceIds: rule.sources,
    };
  });
  for (const b of budgets.blockers)
    findings.unshift({ ruleId: 'blocker', severity: 'red', title: 'Design is not feasible', message: b, value: 0, threshold: 0, fixHint: 'Fix this before the review can pass.', sourceIds: [] });
  // TODO(Track A, P1): if opts.monteCarloRuns, run N headless sims with the auto-policy → predictedSuccessPct / predictedSciencePct.
  return { go: budgets.feasible && !findings.some((f) => f.severity === 'red'), findings };
}
