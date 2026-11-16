import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { catalog } from '../../data';
import { engine } from '../../engine';
import { MONTE_CARLO_RUNS, useGame, type DesignTab, type Screen } from '../../store/game';
import type { ReviewFinding, ReviewResult, Severity } from '../../types/engine';
import { Button } from '../common/Button';
import { num, pct } from '../common/format';
import { Popover } from '../common/Popover';
import { ActionBar, Sheet } from '../common/Sheet';
import { SourceLinks } from '../common/SourceLink';
import { StatusIcon, TONE_BORDER, TONE_TEXT } from '../common/status';

const ORDER: Record<Severity, number> = { red: 0, yellow: 1, green: 2 };

/** Where a finding gets fixed: which sheet, and which tab of the design studio. */
const FIX: Record<string, { screen: Screen; tab?: DesignTab; label: string }> = {
  'rr-mass': { screen: 'launch', label: 'Change the rocket or route' },
  'rr-power': { screen: 'design', tab: 'power', label: 'Open power' },
  'rr-battery': { screen: 'design', tab: 'battery', label: 'Open battery' },
  'rr-data': { screen: 'design', tab: 'antenna', label: 'Open antenna' },
  'rr-cost': { screen: 'design', tab: 'instruments', label: 'Open instruments' },
  'rr-reserve': { screen: 'design', tab: 'operations', label: 'Open operations' },
  'rr-radiation': { screen: 'design', tab: 'shielding', label: 'Open shielding' },
  'rr-science': { screen: 'design', tab: 'instruments', label: 'Open instruments' },
  'rr-reliability': { screen: 'design', tab: 'avionics', label: 'Open computer' },
  blocker: { screen: 'design', label: 'Open the design studio' },
};

function Finding({ f, index }: { f: ReviewFinding; index: number }) {
  const go = useGame((s) => s.go);
  const setTab = useGame((s) => s.setDesignTab);
  const fix = FIX[f.ruleId];
  const rule = catalog.reviewRules.find((r) => r.id === f.ruleId);
  const isRule = f.ruleId !== 'blocker';

  return (
    <motion.li
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.07, duration: 0.3 }}
      className={`border-l-4 bg-panel/80 ${TONE_BORDER[f.severity]} border-y border-r border-y-line border-r-line`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-3 sm:gap-x-6 sm:px-5 sm:py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <StatusIcon severity={f.severity} size={18} label={f.severity === 'red' ? 'Will not pass' : 'Caution'} />
            <h3 className="text-lg font-bold">{f.title}</h3>
          </div>
          <p className="mt-1.5 max-w-[70ch]">{f.message}</p>
          <p className="mt-1.5 max-w-[70ch] text-dim">{f.fixHint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            {fix && (
              <Button
                variant="secondary"
                className="!px-3.5 !py-1.5 text-sm"
                onClick={() => {
                  if (fix.tab) setTab(fix.tab);
                  go(fix.screen);
                }}
              >
                {fix.label}
              </Button>
            )}
            {f.sourceIds.length > 0 && (
              <Popover label="Where this rule comes from" trigger="Why the board cares" width={340}>
                <SourceLinks ids={f.sourceIds} confidence={rule?.confidence} />
              </Popover>
            )}
          </div>
        </div>
        {isRule && (
          <div className="text-right">
            <div className={`num text-lg leading-none font-medium sm:text-3xl ${TONE_TEXT[f.severity]}`}>{pct(Math.min(f.value, 999), Math.abs(f.value) < 100 ? 1 : 0)}</div>
            <div className="mt-1.5 text-sm text-dim">
              board wants <span className="num">{pct(f.threshold)}</span>
            </div>
          </div>
        )}
      </div>
    </motion.li>
  );
}

export function ReviewBoard() {
  const design = useGame((s) => s.design)!;
  const go = useGame((s) => s.go);
  // Findings are instant. The prediction flies the design through many alternate universes in a Web Worker.
  const review = useMemo(() => engine.runReview(catalog, design), [design]);
  const feasible = review.findings.every((f) => f.ruleId !== 'blocker');
  const [prediction, setPrediction] = useState<ReviewResult | null>(null);
  useEffect(() => {
    let live = true;
    setPrediction(null);
    engine
      .runReviewAsync(catalog, design, { monteCarloRuns: MONTE_CARLO_RUNS })
      .then((r) => {
        if (live) setPrediction(r);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [design]);
  const findings = [...review.findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const red = findings.filter((f) => f.severity === 'red');
  const yellow = findings.filter((f) => f.severity === 'yellow');
  const green = findings.filter((f) => f.severity === 'green');
  const open = [...red, ...yellow];

  const verdict: Severity = red.length > 0 || !review.go ? 'red' : yellow.length > 0 ? 'yellow' : 'green';
  const headline = verdict === 'red' ? 'Not cleared to build' : verdict === 'yellow' ? 'Cleared, with cautions' : 'Cleared to build';
  const lead =
    verdict === 'red'
      ? `The board found ${red.length} ${red.length === 1 ? 'problem' : 'problems'} it will not sign off. Fix ${red.length === 1 ? 'it' : 'them'} and come back.`
      : verdict === 'yellow'
        ? `You may proceed. The ${yellow.length === 1 ? 'caution is a risk' : `${yellow.length} cautions are risks`} you are choosing to carry into flight.`
        : 'Every check passed with margin to spare. That is rarer than you might think.';

  return (
    <Sheet
      actions={
        <ActionBar
          back={{ label: 'Back to the design studio', onClick: () => go('design') }}
          primary={{ label: verdict === 'yellow' ? 'Accept the risk and build it' : 'Build it', onClick: () => go('growth'), disabled: !review.go }}
          note={review.go ? 'After this the design is frozen and the hardware gets built.' : 'Fix every red finding to proceed.'}
        />
      }
    >
      <div className="scroll-quiet h-full overflow-y-auto">
        <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-8 px-4 py-5 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] lg:px-12">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <p className="text-dim">Review board verdict</p>
            <h1 className={`mt-2 text-3xl sm:text-5xl leading-[1.05] font-bold ${TONE_TEXT[verdict]}`}>{headline}</h1>
            <p className="mt-4 text-lg">{lead}</p>

            <dl className="mt-8 grid grid-cols-3 border border-line">
              {(
                [
                  ['red', red.length, 'will not pass'],
                  ['yellow', yellow.length, 'cautions'],
                  ['green', green.length, 'passed'],
                ] as const
              ).map(([sev, n, label], i) => (
                <div key={sev} className={`px-3 py-3 lg:px-2 xl:px-4${i > 0 ? 'border-l border-line' : ''}`}>
                  <dd className="flex items-center gap-2">
                    <StatusIcon severity={sev} size={18} />
                    <span className="num text-3xl">{n}</span>
                  </dd>
                  <dt className="mt-1 text-sm text-dim">{label}</dt>
                </div>
              ))}
            </dl>

            <div className="mt-6 border border-line px-4 py-3" aria-live="polite">
              <p className="text-sm text-dim">
                Flown <span className="num">{MONTE_CARLO_RUNS}</span> times, each with different luck
              </p>
              {!feasible ? (
                <p className="mt-1">A design that cannot fly has no flights to predict.</p>
              ) : prediction?.predictedSuccessPct === undefined ? (
                <p className="mt-1 text-dim">Flying the simulations…</p>
              ) : (
                <>
                  <dl className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <dd className="num text-4xl leading-none">{num((prediction.predictedSuccessPct / 100) * MONTE_CARLO_RUNS)}</dd>
                      <dt className="mt-1 text-sm text-dim">return the science team’s minimum</dt>
                    </div>
                    {prediction.predictedSurvivalPct !== undefined && (
                      <div>
                        <dd className="num text-4xl leading-none">{num((prediction.predictedSurvivalPct / 100) * MONTE_CARLO_RUNS)}</dd>
                        <dt className="mt-1 text-sm text-dim">survive the primary mission</dt>
                      </div>
                    )}
                  </dl>
                  {(prediction.predictedSurvivorSciencePct ?? prediction.predictedSciencePct) && (
                    <p className="mt-3 text-sm text-dim">
                      {prediction.predictedSurvivorSciencePct ? 'When the spacecraft survives, science' : 'Science'} return usually lands between{' '}
                      <span className="num text-ink">{num((prediction.predictedSurvivorSciencePct ?? prediction.predictedSciencePct)!.p10)}%</span> and{' '}
                      <span className="num text-ink">{num((prediction.predictedSurvivorSciencePct ?? prediction.predictedSciencePct)!.p90)}%</span>, counting any extended mission.
                    </p>
                  )}
                </>
              )}
            </div>

            <p className="mt-6 text-sm text-dim">
              Real missions pass a string of reviews like this one before any metal is cut. The thresholds here follow NASA systems engineering practice, simplified and tuned
              for play.
            </p>
          </div>

          <div>
            {open.length > 0 ? (
              <ul className="space-y-3">
                {open.map((f, i) => (
                  <Finding key={`${f.ruleId}-${i}`} f={f} index={i} />
                ))}
              </ul>
            ) : (
              <p className="border border-go px-5 py-4 text-lg">No open findings.</p>
            )}

            {green.length > 0 && (
              <div className="mt-8">
                <h2 className="border-b border-line pb-2 text-lg font-bold">Passed</h2>
                <ul>
                  {green.map((f) => (
                    <li key={f.ruleId} className="flex items-center gap-3 border-b border-line/60 py-2.5">
                      <StatusIcon severity="green" />
                      <span className="flex-1">{f.title}</span>
                      <span className="num">{f.value >= 999 ? 'plenty' : pct(f.value, f.value < 100 ? 1 : 0)}</span>
                      <span className="w-36 text-right text-sm text-dim">
                        board wants <span className="num">{pct(f.threshold)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
