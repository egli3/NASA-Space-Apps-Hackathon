/**
 * Balance harness: `npm run balance` (add `-- --strict` to exit 1 when a target is missed).
 * Prints every reference design from GAME_DESIGN §7 with its budgets and whether it hits its targets.
 * Owner: Track A. Share the output in team chat at every milestone.
 */
import { catalog } from '../../src/data';
import { computeBudgets, revealGrowth, runHeadless, runReview } from '../../src/engine';
import { referenceDesigns } from '../../src/engine/reference-designs';

const SEED = 2026;
const n = (x: number, d = 0) => x.toFixed(d);
const pad = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length));

const cols: [string, number][] = [
  ['Design', 38], ['OK?', 5], ['Wet/cap kg', 13], ['Mass%', 7], ['Power W', 11], ['Pwr%', 7], ['Data Gb/d', 13],
  ['Cost/cap $M', 12], ['Sci%', 6], ['Flown%', 7], ['Rel%', 6], ['Rad%', 7], ['Growth', 16],
];
const line = (cells: string[]) => cells.map((c, i) => pad(c, cols[i][1])).join(' ');

console.log(`MARGIN balance report — ${referenceDesigns(catalog).length} reference designs, seed ${SEED}\n`);
console.log(line(cols.map((c) => c[0])));
console.log(line(cols.map((c) => '-'.repeat(c[1]))));

let pass = 0, miss = 0, pending = 0;
const details: string[] = [];
for (const ref of referenceDesigns(catalog)) {
  const b = computeBudgets(catalog, ref.design);
  const review = runReview(catalog, ref.design);
  const flown = b.feasible ? runHeadless(catalog, ref.design, SEED) : undefined;
  const g = revealGrowth(catalog, ref.design, SEED);
  console.log(line([
    ref.label,
    b.feasible ? 'yes' : 'NO',
    `${n(b.mass.wetKg)}/${n(b.mass.lvCapacityKg)}`,
    n(b.mass.marginPct),
    `${n(b.power.generatedEolW)}/${n(Math.max(b.power.loadScienceW, b.power.loadDownlinkW))}`,
    n(Math.min(999, b.power.marginPct)),
    `${n(b.comms.downlinkGbPerDay, 1)}/${n(b.comms.generatedGbPerDay, 1)}`,
    `${n(b.cost.totalM)}/${n(b.cost.capM)}`,
    n(b.science.expectedPct, 1),
    flown ? n(flown.sciencePct, 1) : '—',
    n(b.risk.reliabilityPct, 1),
    n(Math.min(999, b.radiation.doseMarginPct)),
    `+${n(g.massGrowthKg)}kg +$${n(g.costGrowthM)}M${g.mustDescope ? ' !' : ''}`,
  ]));
  details.push(`\n${ref.label}`);
  for (const c of ref.checks) {
    const ok = c.pass?.(b, review);
    if (ok === undefined) pending++; else if (ok) pass++; else miss++;
    details.push(`  [${ok === undefined ? ' ?? ' : ok ? 'PASS' : 'MISS'}] ${c.target} → ${c.actual(b, review)}`);
  }
  for (const blocker of b.blockers) details.push(`         blocker: ${blocker}`);
  const flagged = review.findings.filter((f) => f.severity !== 'green' && f.ruleId !== 'blocker').map((f) => `${f.ruleId.replace('rr-', '')}:${f.severity}`);
  if (flagged.length) details.push(`         review: ${flagged.join(', ')}`);
}

console.log('\nColumns: Sci% = expected at design time; Flown% = nominal headless flight; Growth = Reality Check (! = must descope).');
console.log('\nTargets (GAME_DESIGN §7)');
console.log(details.join('\n'));
console.log(`\n${pass} pass, ${miss} miss, ${pending} need Monte Carlo (M3).`);
if (miss > 0 && process.argv.includes('--strict')) process.exit(1);
