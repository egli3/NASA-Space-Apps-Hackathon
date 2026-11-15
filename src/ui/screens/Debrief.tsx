import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { catalog } from '../../data';
import { useGame } from '../../store/game';
import type { HindsightItem, Outcome } from '../../types/engine';
import { Button } from '../common/Button';
import { date, duration, money, num, pct, signed } from '../common/format';
import { Wordmark } from '../common/Sheet';

const OUTCOME_TONE: Record<Outcome, string> = { exceeded: 'text-go', full: 'text-go', threshold: 'text-ink', partial: 'text-caution', lost: 'text-nogo' };
const OUTCOME_WORD: Record<Outcome, string> = {
  exceeded: 'Exceeded expectations',
  full: 'Full success',
  threshold: 'Threshold mission',
  partial: 'Partial success',
  lost: 'Mission lost',
};

function Star({ earned }: { earned: boolean }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className={earned ? 'text-ink' : 'text-line'}>
      <path
        d="M22 3.5l5.4 11.6 12.6 1.5-9.3 8.7 2.5 12.5L22 31.6l-11.2 6.2 2.5-12.5L4 16.6l12.6-1.5L22 3.5z"
        fill={earned ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function H2({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-6 border-b-2 border-rule pb-2">
      <h2 className="text-2xl font-bold">{children}</h2>
      {aside && <p className="text-sm text-dim">{aside}</p>}
    </div>
  );
}

function HindsightCard({ item, index }: { item: HindsightItem; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: index * 0.18, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="flex flex-col border border-rule bg-raised"
    >
      <div className="flex items-baseline justify-between border-b border-line px-5 py-2.5">
        <span className="font-bold">{item.dimension}</span>
        <span className="num text-sm text-dim">{index + 1} of 3</span>
      </div>
      <div className="flex-1 px-5 py-4">
        <p className="text-dim">If you had chosen</p>
        <p className="mt-0.5 text-xl leading-snug font-bold">{item.toLabel}</p>
        <p className="mt-1 text-dim">
          instead of <span className="line-through decoration-nogo">{item.fromLabel}</span>
        </p>
        <p className="mt-4">{item.explanation}</p>
      </div>
      <dl className="grid grid-cols-2 border-t border-line">
        <div className="px-5 py-3">
          <dt className="text-sm text-dim">Science</dt>
          <dd className={`num text-3xl ${item.deltaSciencePct >= 0 ? 'text-go' : 'text-nogo'}`}>{signed(item.deltaSciencePct, 0)} pts</dd>
        </div>
        <div className="border-l border-line px-5 py-3">
          <dt className="text-sm text-dim">Cost</dt>
          <dd className="num text-3xl">
            {item.deltaCostM >= 0 ? '+' : '−'}
            {money(Math.abs(item.deltaCostM))}
          </dd>
        </div>
      </dl>
    </motion.li>
  );
}

export function Debrief() {
  const design = useGame((s) => s.design)!;
  const debrief = useGame((s) => s.debrief);
  const retry = useGame((s) => s.retry);
  const go = useGame((s) => s.go);
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId)!;

  if (!debrief) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="text-xl">There is no flight to report on yet.</p>
          <Button variant="primary" className="mt-6" onClick={() => go('design')}>
            Back to the design studio
          </Button>
        </div>
      </div>
    );
  }

  const { result, comparison, hindsight, bestDecision, monteCarlo } = debrief;
  const cap = catalog.missionClasses.find((c) => c.id === scenario.missionClassId)!.costCapM;
  const survived = result.outcome !== 'lost';
  const stars = [
    { earned: result.sciencePct >= 75, label: 'Baseline science', detail: `${pct(result.sciencePct)} returned, 75% needed` },
    { earned: result.underBudget, label: 'Under the cost cap', detail: `${money(result.totalCostM)} of ${money(cap)}` },
    { earned: survived, label: 'Survived the primary mission', detail: survived ? `${duration(result.daysFlown)} in flight` : (result.lossCause ?? 'Lost in flight') },
  ];
  const top = hindsight.filter((h) => h.feasible && h.deltaSciencePct > 0).slice(0, 3);
  const milestones = result.log.filter((l) => l.kind !== 'info');

  return (
    <div className="scroll-quiet h-full overflow-y-auto">
      <article className="mx-auto max-w-6xl px-8 py-10 lg:px-14">
        <header className="flex items-baseline justify-between border-b border-line pb-3 text-sm text-dim">
          <span>
            <Wordmark className="text-ink" /> <span className="ml-3">Mission report</span>
          </span>
          <span>
            {scenario.title}, flown {result.log[0] ? date(result.log[0].date) : ''} to {date(result.finalState.date)}
          </span>
        </header>

        {/* outcome */}
        <section className="grid gap-x-12 gap-y-8 pt-10 pb-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <div>
            <p className="text-xl font-medium">{design.missionName}</p>
            <h1 className={`mt-2 text-[clamp(3rem,7vw,5.5rem)] leading-[0.95] font-bold ${OUTCOME_TONE[result.outcome]}`}>{OUTCOME_WORD[result.outcome]}</h1>
            <p className="mt-5 max-w-[52ch] text-xl">
              {result.outcome === 'lost'
                ? `${result.lossCause ?? 'The spacecraft was lost'}. It had returned ${pct(result.sciencePct)} of the baseline science by then, and that science still counts.`
                : `Your spacecraft returned ${pct(result.sciencePct)} of the science the team asked for, at a final cost of ${money(result.totalCostM)}.`}
            </p>
          </div>
          <ul className="self-end">
            {stars.map((s, i) => (
              <motion.li
                key={s.label}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.25, duration: 0.4 }}
                className="flex items-center gap-4 border-b border-line py-3 first:border-t"
              >
                <Star earned={s.earned} />
                <div>
                  <p className={`text-lg font-bold ${s.earned ? '' : 'text-dim'}`}>
                    {s.label}
                    <span className="sr-only">{s.earned ? ': earned' : ': not earned'}</span>
                  </p>
                  <p className="num text-sm text-dim">{s.detail}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </section>

        {/* objectives */}
        <section className="pb-12">
          <H2 aside="the tick on each bar is the least the science team would accept">Science objectives</H2>
          <ul className="space-y-4">
            {scenario.objectives.map((o) => {
              const r = result.objectives.find((x) => x.objectiveId === o.id);
              const v = Math.max(0, Math.min(100, r?.pct ?? 0));
              return (
                <li key={o.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_5rem] items-center gap-x-6">
                  <div>
                    <p className="font-bold">{o.name}</p>
                    <p className="text-sm text-dim">
                      <span className="num">{o.weight}%</span> of the mission
                    </p>
                  </div>
                  <div className="relative h-5 border border-rule" role="img" aria-label={`${o.name}: ${pct(v)}, threshold ${pct(o.thresholdPct)}`}>
                    <motion.div
                      className={r?.metThreshold ? 'h-full bg-ink' : 'hatch-dense h-full text-nogo'}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${v}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                    <div className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-caution" style={{ left: `${o.thresholdPct}%` }} />
                  </div>
                  <p className={`num text-right text-2xl ${r?.metThreshold ? '' : 'text-nogo'}`}>{pct(v)}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* hindsight */}
        <section className="pb-12">
          <H2 aside="the same mission, replayed with one decision changed">Hindsight</H2>
          {top.length > 0 ? (
            <ol className="grid gap-5 lg:grid-cols-3">
              {top.map((h, i) => (
                <HindsightCard key={`${h.dimension}-${h.toLabel}`} item={h} index={i} />
              ))}
            </ol>
          ) : hindsight.length > 0 ? (
            <p className="max-w-[62ch] border border-go px-5 py-4 text-lg">We replayed this mission with every single decision changed, one at a time. None of them would have returned more science. You flew the best version of this design.</p>
          ) : (
            <div className="border border-dashed border-rule px-5 py-5">
              <p className="text-lg font-bold">The replays are not in this build yet</p>
              <p className="mt-1 max-w-[62ch] text-dim">
                Hindsight flies your mission again with the same luck and one decision changed at a time, then shows the three changes that would have mattered most. It will appear here as soon as the
                flight dynamics team switches it on.
              </p>
            </div>
          )}
          {bestDecision && (
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.6 }} className="mt-5 border-l-4 border-go bg-panel px-5 py-4">
              <p className="text-dim">Your best call</p>
              <p className="mt-0.5 text-xl font-bold">
                {bestDecision.dimension}: {bestDecision.fromLabel}
              </p>
              <p className="mt-1 max-w-[62ch]">{bestDecision.explanation}</p>
            </motion.div>
          )}
        </section>

        {/* monte carlo */}
        {monteCarlo && (
          <section className="pb-12">
            <H2 aside={`${monteCarlo.runs} flights of this design, each with different luck`}>How lucky were you?</H2>
            <div className="grid items-center gap-x-10 gap-y-6 lg:grid-cols-[auto_minmax(0,1fr)]">
              <p>
                <span className="num text-6xl">{num((monteCarlo.successRatePct / 100) * monteCarlo.runs)}</span>
                <span className="ml-3 text-lg">
                  of <span className="num">{monteCarlo.runs}</span> succeeded
                </span>
              </p>
              <div>
                <div className="relative h-8 border border-rule" role="img" aria-label={`Science return ranged from ${num(monteCarlo.scienceP10)} to ${num(monteCarlo.scienceP90)} percent, typically ${num(monteCarlo.scienceP50)}`}>
                  <div className="hatch absolute inset-y-0 text-ink" style={{ left: `${monteCarlo.scienceP10}%`, width: `${Math.max(0.5, monteCarlo.scienceP90 - monteCarlo.scienceP10)}%` }} />
                  <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${monteCarlo.scienceP50}%` }} />
                  <div className="absolute -top-1.5 -bottom-1.5 w-1 bg-caution" style={{ left: `${Math.min(99.5, result.sciencePct)}%` }} />
                </div>
                <p className="mt-2 text-sm text-dim">
                  Science return across the runs: usually between <span className="num text-ink">{num(monteCarlo.scienceP10)}%</span> and <span className="num text-ink">{num(monteCarlo.scienceP90)}%</span>, typically{' '}
                  <span className="num text-ink">{num(monteCarlo.scienceP50)}%</span>. The amber mark is the flight you just flew.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* you vs history */}
        <section className="pb-12">
          <H2 aside="for scale: our cost model is not theirs">You and the real thing</H2>
          <div className="grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <table className="w-full self-start">
              <thead>
                <tr className="border-b border-rule text-left">
                  <th className="py-2 font-medium text-dim" />
                  <th className="py-2 pr-4 font-bold">{design.missionName}</th>
                  <th className="py-2 font-bold">
                    {comparison.mission.name}, <span className="num font-medium">{comparison.mission.launchYear}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((r) => (
                  <tr key={r.label} className="border-b border-line">
                    <th scope="row" className="py-2.5 pr-4 text-left font-medium text-dim">
                      {r.label}
                    </th>
                    <td className="num py-2.5 pr-4">{r.yours}</td>
                    <td className="num py-2.5">
                      {r.theirs}
                      {r.note && <span className="ml-2 font-sans text-sm text-dim">{r.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-4">
              <p>{comparison.mission.summary}</p>
              <p>
                <span className="font-bold">What happened to it. </span>
                {comparison.mission.outcome}
              </p>
              <p className="border-l-4 border-caution pl-4">{comparison.mission.funFact}</p>
            </div>
          </div>
        </section>

        {/* log */}
        {milestones.length > 0 && (
          <section className="pb-12">
            <H2>Flight log</H2>
            <ol className="grid gap-x-12 lg:grid-cols-2">
              {milestones.map((l, i) => (
                <li key={i} className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-line py-2">
                  <span className="num text-dim">{date(l.date)}</span>
                  <span className={l.kind === 'anomaly' ? 'text-nogo' : ''}>{l.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="flex flex-wrap items-center gap-4 border-t-2 border-rule pt-6">
          <Button variant="primary" size="lg" onClick={retry}>
            Try again with this design
          </Button>
          <Button variant="secondary" size="lg" onClick={() => go('scenario')}>
            Pick a new science call
          </Button>
          <Button variant="quiet" className="ml-auto" onClick={() => go('credits')}>
            Credits and sources
          </Button>
        </footer>
      </article>
    </div>
  );
}
