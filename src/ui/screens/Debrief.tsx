import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { catalog } from '../../data';
import { MONTE_CARLO_RUNS, useGame } from '../../store/game';
import type { Debrief as DebriefData, HindsightItem, LogEntry, MissionResult, Outcome } from '../../types/engine';
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
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 border-b-2 border-rule pb-2">
      <h2 className="text-2xl font-bold">{children}</h2>
      {aside && <p className="text-sm text-dim sm:text-right">{aside}</p>}
    </div>
  );
}

/** The engine labels "not carried" options as "no <thing>"; turn the pair into a natural sentence opener. */
function phrase(item: HindsightItem): { lead: string; choice: string; instead?: string } {
  const none = /^no /i;
  if (none.test(item.fromLabel)) return { lead: 'If you had carried', choice: item.toLabel };
  if (none.test(item.toLabel)) return { lead: 'If you had left behind', choice: item.fromLabel };
  return { lead: 'If you had chosen', choice: item.toLabel, instead: item.fromLabel };
}

/** One card reads as a column of text; two share the sheet; three need the full desktop width before they sit side by side. */
const HINDSIGHT_COLS: Record<number, string> = { 1: 'max-w-2xl', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-2 xl:grid-cols-3' };

/** Figures are set in the tabular face; a sentence (the real mission's outcome, its fun fact) reads better as text. */
const cellFont = (value: string) => (value.length > 40 ? '' : 'num');

const costDelta = (m: number) => (Math.abs(m) < 0.5 ? 'no change' : `${m >= 0 ? '+' : '−'}${money(Math.abs(m))}`);

function ReplayComparison({ item, actual, open }: { item: HindsightItem; actual: MissionResult; open?: boolean }) {
  const replay = item.replay;
  if (!replay) return null;
  const difference = replay.firstLogDifference;
  const describe = (entry?: LogEntry) => entry ? `Day ${num(entry.day)} · ${date(entry.date)} · ${entry.text}` : 'Log ended';
  return (
    <details open={open} className="self-start border-t border-line">
      <summary className="cursor-pointer px-5 py-3 font-medium hover:bg-ink/5">Compare with your flight</summary>
      <div className="px-4 pb-4">
        <p className="mb-3 text-sm text-dim">Same seed and applicable flight decisions. One design choice changes.</p>
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className="w-1/4 pb-2 font-medium">Measure</th>
              <th scope="col" className="px-1.5 pb-2 font-medium">Your flight</th>
              <th scope="col" className="px-1.5 pb-2 font-medium">Replay</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line align-top">
              <th scope="row" className="py-2 pr-1 font-medium">Choice</th>
              <td className="break-words px-1.5 py-2">{item.fromLabel}</td>
              <td className="break-words px-1.5 py-2">{item.toLabel}</td>
            </tr>
            <tr className="border-b border-line">
              <th scope="row" className="py-2 pr-1 font-medium">Science</th>
              <td className="num px-1.5 py-2">{pct(actual.sciencePct, 1)}</td>
              <td className="num px-1.5 py-2">{pct(replay.sciencePct, 1)}</td>
            </tr>
            <tr className="border-b border-line">
              <th scope="row" className="py-2 pr-1 font-medium">Cost</th>
              <td className="num px-1.5 py-2">{money(actual.totalCostM)}</td>
              <td className="num px-1.5 py-2">{money(replay.totalCostM)}</td>
            </tr>
            <tr className="border-b border-line align-top">
              <th scope="row" className="py-2 pr-1 font-medium">Outcome</th>
              <td className="px-1.5 py-2">{OUTCOME_WORD[actual.outcome]}</td>
              <td className="px-1.5 py-2">{OUTCOME_WORD[replay.outcome]}</td>
            </tr>
            {difference && (
              <tr className="align-top">
                <th scope="row" className="py-2 pr-1 font-medium">First log difference</th>
                <td className="break-words px-1.5 py-2">{describe(difference.actual)}</td>
                <td className="break-words px-1.5 py-2">{describe(difference.replay)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function HindsightCard({ item, index, total, actual, openReplay }: { item: HindsightItem; index: number; total: number; actual: MissionResult; openReplay?: boolean }) {
  const p = phrase(item);
  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.2, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="row-span-4 grid grid-rows-subgrid gap-y-0 border border-rule bg-raised"
    >
      <div className="flex items-baseline justify-between border-b border-line px-5 py-2.5">
        <span className="font-bold">{item.dimension}</span>
        <span className="num text-sm text-dim">
          {index + 1} of {total}
        </span>
      </div>
      <div className="px-5 py-4">
        <p className="text-dim">{p.lead}</p>
        <p className="mt-0.5 text-xl leading-snug font-bold">{p.choice}</p>
        {p.instead && (
          <p className="mt-1 text-dim">
            instead of <span className="line-through decoration-nogo">{p.instead}</span>
          </p>
        )}
        <p className="mt-4">{item.explanation}</p>
      </div>
      <dl className="grid grid-cols-2 border-t border-line">
        <div className="px-5 py-3">
          <dt className="text-sm text-dim">Science</dt>
          <dd className={`num text-2xl whitespace-nowrap sm:text-3xl xl:text-2xl ${item.deltaSciencePct >= 0 ? 'text-go' : 'text-nogo'}`}>{signed(item.deltaSciencePct, Math.abs(item.deltaSciencePct) < 10 ? 1 : 0)} pts</dd>
        </div>
        <div className="border-l border-line px-5 py-3">
          <dt className="text-sm text-dim">Cost</dt>
          <dd className="num text-2xl whitespace-nowrap sm:text-3xl xl:text-2xl">{costDelta(item.deltaCostM)}</dd>
        </div>
      </dl>
      <ReplayComparison item={item} actual={actual} open={openReplay} />
    </motion.li>
  );
}

/** Fifty flights of the same design as a dot histogram: one square per flight, stacked by science returned. */
function LuckChart({ mc, yours }: { mc: NonNullable<DebriefData['monteCarlo']>; yours: number }) {
  const bins = Array.from({ length: 20 }, () => 0);
  for (const v of mc.sciencePcts ?? []) bins[Math.min(19, Math.max(0, Math.floor(v / 5)))]++;
  const tallest = Math.max(1, ...bins);
  const yourBin = Math.min(19, Math.max(0, Math.floor(yours / 5)));
  return (
    <div>
      <div
        className="flex h-32 items-end gap-1 border-b border-rule"
        role="img"
        aria-label={`Science return over ${mc.runs} flights: usually between ${num(mc.survivorScienceP10 ?? mc.scienceP10)} and ${num(mc.survivorScienceP90 ?? mc.scienceP90)} percent when the spacecraft survives, typically ${num(mc.scienceP50)}. Your flight returned ${num(yours)} percent.`}
      >
        {bins.map((n, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            {n > 0 && <span className="num mb-1 text-center text-xs text-dim">{n}</span>}
            <motion.div
              className={i === yourBin ? 'bg-caution' : 'bg-ink'}
              initial={{ height: 0 }}
              animate={{ height: `${(n / tallest) * 78}%` }}
              transition={{ delay: 0.2 + i * 0.02, duration: 0.4 }}
            />
          </div>
        ))}
      </div>
      <div className="num mt-1 flex justify-between text-xs text-dim">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
      <p className="mt-2 text-sm text-dim">
        Science returned in each flight. The amber column holds the flight you just flew.{' '}
        {mc.survivorScienceP10 !== undefined && mc.survivorScienceP90 !== undefined ? (
          <>
            Flights that survive usually land between <span className="num text-ink">{num(mc.survivorScienceP10)}%</span> and{' '}
            <span className="num text-ink">{num(mc.survivorScienceP90)}%</span>.
          </>
        ) : (
          <>
            Most land between <span className="num text-ink">{num(mc.scienceP10)}%</span> and <span className="num text-ink">{num(mc.scienceP90)}%</span>.
          </>
        )}
      </p>
    </div>
  );
}

export function Debrief() {
  const design = useGame((s) => s.design)!;
  const result = useGame((s) => s.result);
  const debrief = useGame((s) => s.debrief);
  const retry = useGame((s) => s.retry);
  const go = useGame((s) => s.go);
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId)!;

  if (!result) {
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

  const cap = catalog.missionClasses.find((c) => c.id === scenario.missionClassId)!.costCapM;
  const survived = result.outcome !== 'lost';
  const stars = [
    { earned: result.sciencePct >= 75, label: 'Baseline science', detail: `${pct(result.sciencePct)} returned, 75% needed` },
    { earned: result.underBudget, label: 'Under the cost cap', detail: `${money(result.totalCostM)} of ${money(cap)}` },
    { earned: survived, label: 'Survived the primary mission', detail: survived ? `${duration(result.daysFlown)} in flight` : (result.lossCause ?? 'Lost in flight') },
  ];
  const guided = useGame((s) => s.guidedFlight);
  const top = (debrief?.hindsight ?? []).filter((h) => h.feasible && h.deltaSciencePct > 0).slice(0, 3);
  const best = debrief?.bestDecision;
  const mc = debrief?.monteCarlo;
  const explored = debrief?.explored ?? [];
  const fallbackReplay = top.length === 0 ? explored.find((item) => item.replay) : undefined;
  const milestones = result.log.filter((l) => l.kind !== 'info');

  return (
    <div className="scroll-quiet h-full overflow-y-auto">
      <article className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10 lg:px-14">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-line pb-3 text-sm text-dim">
          <span>
            <Wordmark className="text-ink" /> <span className="ml-3">Mission report</span>
          </span>
          <span className="text-right">
            {scenario.title}, flown {result.log[0] ? date(result.log[0].date) : ''} to {date(result.finalState.date)}
          </span>
        </header>

        {/* outcome */}
        <section className="grid gap-x-12 gap-y-8 pt-10 pb-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <div>
            <p className="text-xl font-medium">{design.missionName}</p>
            <h1 className={`mt-2 text-[clamp(2.25rem,7vw,5.5rem)] leading-[0.95] font-bold ${OUTCOME_TONE[result.outcome]}`}>{OUTCOME_WORD[result.outcome]}</h1>
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
          <H2 aside="the amber tick on each bar is the least the science team would accept">Science objectives</H2>
          <ul className="space-y-4">
            {scenario.objectives.map((o) => {
              const r = result.objectives.find((x) => x.objectiveId === o.id);
              const v = Math.max(0, Math.min(100, r?.pct ?? 0));
              return (
                <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_5rem] sm:gap-x-6">
                  <div>
                    <p className="font-bold">{o.name}</p>
                    <p className="text-sm text-dim">
                      <span className="num">{o.weight}%</span> of the mission
                    </p>
                  </div>
                  <div className="relative col-span-2 row-start-2 h-4 border border-rule sm:col-span-1 sm:row-start-auto sm:h-5" role="img" aria-label={`${o.name}: ${pct(v)}, threshold ${pct(o.thresholdPct)}`}>
                    <motion.div
                      className={r?.metThreshold ? 'h-full bg-ink' : 'hatch-dense h-full text-nogo'}
                      initial={{ width: '0%' }}
                      animate={{ width: `${v}%` }}
                      transition={{ delay: 0.3, duration: 0.7, ease: 'easeOut' }}
                    />
                    <div className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-caution" style={{ left: `${o.thresholdPct}%` }} />
                  </div>
                  <p className={`num text-right text-xl sm:text-2xl ${r?.metThreshold ? '' : 'text-nogo'}`}>{pct(v)}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* hindsight */}
        <section className="pb-12" aria-live="polite">
          <H2 aside={debrief?.replays ? `the same mission and the same luck, re-flown ${num(debrief.replays)} times with one decision changed` : 'the same mission, re-flown with one decision changed'}>
            Hindsight
          </H2>
          {!debrief ? (
            <div className="border border-dashed border-rule px-5 py-6">
              <p className="text-lg font-bold">Re-flying your mission…</p>
              <p className="mt-1 max-w-[62ch] text-dim">Each replay keeps your luck and your in-flight decisions, and changes exactly one design choice. The three that would have mattered most appear here.</p>
            </div>
          ) : top.length > 0 ? (
            <ol className={`grid gap-5 ${HINDSIGHT_COLS[Math.min(3, top.length)]}`}>
              {top.map((h, i) => (
                <HindsightCard key={`${h.dimension}-${h.toLabel}`} item={h} index={i} total={top.length} actual={result} openReplay={guided && i === 0} />
              ))}
            </ol>
          ) : (
            <p className="max-w-[62ch] border border-go px-5 py-4 text-lg">
              None of the single changes we replayed returned more science. Expand the alternatives to see each result.
            </p>
          )}
          {fallbackReplay && (
            <div className="mt-4 max-w-[58rem] border border-line bg-raised">
              <ReplayComparison item={fallbackReplay} actual={result} open={guided} />
            </div>
          )}
          {best && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-5 border-l-4 border-go bg-panel px-5 py-4">
              <p className="text-dim">Your best call</p>
              <p className="mt-0.5 text-xl font-bold">{best.fromLabel}</p>
              <p className="mt-1 max-w-[70ch]">{best.explanation.replace(/^Your best call:[^.]*\.\s*/, '')}</p>
            </motion.div>
          )}
          {explored.length > 0 && (
            <details className="mt-5 border border-line">
              <summary className="cursor-pointer px-5 py-3 font-medium hover:bg-ink/5">
                Everything we tried, <span className="num">{explored.length}</span> alternatives
              </summary>
              <div role="region" aria-label="All replay alternatives" tabIndex={0} className="max-w-full overflow-x-auto">
                <table className="w-full min-w-[33rem] border-t border-line text-sm">
                  <thead>
                    <tr className="text-left text-dim">
                      <th className="px-5 py-2 font-medium">Decision</th>
                      <th className="py-2 font-medium">Instead of</th>
                      <th className="py-2 font-medium">You could have had</th>
                      <th className="py-2 text-right font-medium">Science</th>
                      <th className="px-5 py-2 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {explored.map((h, i) => (
                      <tr key={i} className={`border-t border-line/70 ${h.feasible ? '' : 'text-dim'}`} title={h.explanation}>
                        <td className="px-5 py-1.5">{h.dimension}</td>
                        <td className="py-1.5 pr-3">{h.fromLabel}</td>
                        <td className="py-1.5 pr-3">{h.toLabel}</td>
                        <td className={`num py-1.5 text-right ${!h.feasible ? '' : h.deltaSciencePct > 0.05 ? 'text-go' : h.deltaSciencePct < -0.05 ? 'text-nogo' : ''}`}>
                          {h.feasible ? `${signed(h.deltaSciencePct, 1)} pts` : 'cannot fly'}
                        </td>
                        <td className="num px-5 py-1.5 text-right">{costDelta(h.deltaCostM)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>

        {/* monte carlo */}
        {mc && (
          <section className="pb-12">
            <H2 aside={`${mc.runs} flights of this design with your decisions, each with different luck`}>How lucky were you?</H2>
            <div className="grid items-start gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
              <dl className="space-y-5">
                <div>
                  <dd>
                    <span className="num text-6xl leading-none">{num((mc.successRatePct / 100) * mc.runs)}</span>
                    <span className="ml-3 text-lg">
                      of <span className="num">{mc.runs}</span>
                    </span>
                  </dd>
                  <dt className="mt-1 text-dim">returned at least the science team’s minimum</dt>
                </div>
                {mc.lostPct !== undefined && (
                  <div>
                    <dd>
                      <span className={`num text-6xl leading-none ${mc.lostPct > 0 ? 'text-nogo' : ''}`}>{num((mc.lostPct / 100) * mc.runs)}</span>
                      <span className="ml-3 text-lg">
                        of <span className="num">{mc.runs}</span>
                      </span>
                    </dd>
                    <dt className="mt-1 text-dim">lost the spacecraft</dt>
                  </div>
                )}
              </dl>
              {mc.sciencePcts && mc.sciencePcts.length > 0 ? (
                <LuckChart mc={mc} yours={result.sciencePct} />
              ) : (
                <p className="text-dim">
                  {mc.survivorScienceP10 !== undefined ? 'When the spacecraft survives, science' : 'Science'} return usually lands between{' '}
                  <span className="num text-ink">{num(mc.survivorScienceP10 ?? mc.scienceP10)}%</span> and <span className="num text-ink">{num(mc.survivorScienceP90 ?? mc.scienceP90)}%</span>.
                </p>
              )}
            </div>
          </section>
        )}
        {!debrief && (
          <section className="pb-12">
            <H2 aside={`${MONTE_CARLO_RUNS} flights of this design, each with different luck`}>How lucky were you?</H2>
            <p className="text-dim">Flying the simulations…</p>
          </section>
        )}

        {/* you vs history */}
        {debrief && (
          <section className="pb-12">
            <H2 aside="for scale: our cost model is not theirs">You and the real thing</H2>
            <div className="grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <table className="w-full table-fixed self-start text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-rule text-left">
                    <th className="py-2 font-medium text-dim" />
                    <th className="py-2 pr-4 font-bold">{design.missionName}</th>
                    <th className="py-2 font-bold">
                      {debrief.comparison.mission.name}, <span className="num font-medium">{debrief.comparison.mission.launchYear}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {debrief.comparison.rows.map((r) => (
                    <tr key={r.label} className="border-b border-line">
                      <th scope="row" className="py-2.5 pr-4 text-left font-medium text-dim">
                        {r.label}
                      </th>
                      <td className={`py-2.5 pr-4 ${cellFont(r.yours)}`}>{r.yours}</td>
                      <td className={`py-2.5 ${cellFont(r.theirs)}`}>
                        {r.theirs}
                        {r.note && <span className="ml-2 font-sans text-sm text-dim [word-spacing:normal]">{r.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-4">
                <p>{debrief.comparison.mission.summary}</p>
                <p>
                  <span className="font-bold">What happened to it. </span>
                  {debrief.comparison.mission.outcome}
                </p>
                <p className="border-l-4 border-caution pl-4">{debrief.comparison.mission.funFact}</p>
              </div>
            </div>
          </section>
        )}

        {/* log */}
        {milestones.length > 0 && (
          <section className="pb-12">
            <H2>Flight log</H2>
            <ol className="grid gap-x-12 lg:grid-cols-2">
              {milestones.map((l, i) => (
                <li key={i} className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3 border-b border-line py-2">
                  <span className="num text-dim">{date(l.date)}</span>
                  <span className={l.kind === 'anomaly' ? 'text-nogo' : l.kind === 'decision' ? 'font-bold' : ''}>{l.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="grid gap-3 border-t-2 border-rule pt-6 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
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
