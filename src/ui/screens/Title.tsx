import { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { catalog } from '../../data';
import { engine } from '../../engine';
import { useGame } from '../../store/game';
import { Button } from '../common/Button';
import { kg, num } from '../common/format';

/**
 * The hero is the idea itself: one bar showing what a rocket can lift, what a first-draft spacecraft weighs,
 * and the hatched gap between them. The numbers are live engine output for the default Mars design.
 */
function MarginHero() {
  const b = useMemo(() => {
    const scenario = catalog.scenarios.find((s) => s.priority === 'P0') ?? catalog.scenarios[0];
    return engine.computeBudgets(catalog, engine.defaultDesign(catalog, scenario.id)).mass;
  }, []);
  const cap = b.lvCapacityKg || 1;
  const dry = (b.dryKg / cap) * 100;
  const prop = (b.propellantKg / cap) * 100;
  const gap = Math.max(0, 100 - dry - prop);
  const ease = [0.2, 0.7, 0.2, 1] as const;

  return (
    <figure className="mt-7 w-full max-w-4xl sm:mt-12" aria-label={`A spacecraft of ${kg(b.wetKg)} on a rocket that can lift ${kg(cap)} leaves a margin of ${num(b.marginPct)} percent.`}>
      {/* capacity dimension line */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }} className="mb-2 flex items-center gap-3 text-sm text-dim">
        <span className="h-3 border-l border-rule" />
        <span className="h-px flex-1 bg-rule" />
        <span>
          what the rocket can lift to Mars <span className="num text-ink">{kg(cap)}</span>
        </span>
        <span className="h-px flex-1 bg-rule" />
        <span className="h-3 border-l border-rule" />
      </motion.div>

      <div className="flex h-8 w-full border border-ink lg:h-16">
        <motion.div initial={{ width: 0 }} animate={{ width: `${dry}%` }} transition={{ delay: 0.7, duration: 0.8, ease }} className="h-full overflow-hidden bg-ink">
          <span className="hidden px-3 pt-2 text-sm font-medium whitespace-nowrap text-bg lg:block">
            spacecraft <span className="num">{kg(b.dryKg)}</span>
          </span>
        </motion.div>
        <motion.div initial={{ width: 0 }} animate={{ width: `${prop}%` }} transition={{ delay: 1.5, duration: 0.9, ease }} className="h-full overflow-hidden border-l border-bg bg-ink/65">
          <span className="hidden px-3 pt-2 text-sm font-medium whitespace-nowrap text-bg lg:block">
            propellant to stop there <span className="num">{kg(b.propellantKg)}</span>
          </span>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4, duration: 0.6 }} className="hatch h-full flex-1 text-caution" />
      </div>

      {/* the gap, dimensioned */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.7, duration: 0.6 }} className="mt-2 hidden text-caution lg:flex">
        <div style={{ width: `${100 - gap}%` }} />
        <div className="flex flex-1 items-center gap-2">
          <span className="h-3 border-l border-current" />
          <span className="h-px flex-1 bg-current" />
          <span className="text-sm font-medium whitespace-nowrap">
            margin <span className="num">{num(b.marginPct)}%</span>
          </span>
          <span className="h-px flex-1 bg-current" />
          <span className="h-3 border-l border-current" />
        </div>
      </motion.div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm lg:hidden">
        <div><dt className="text-dim">Spacecraft</dt><dd className="num">{kg(b.dryKg)}</dd></div>
        <div><dt className="text-dim">Propellant</dt><dd className="num">{kg(b.propellantKg)}</dd></div>
        <div><dt className="text-dim">Margin</dt><dd className="num text-caution">{num(b.marginPct)}%</dd></div>
      </dl>

      <motion.figcaption initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.1, duration: 0.6 }} className="mt-6 max-w-2xl text-lg text-dim">
        Margin is the gap between what you have and what you need. It is the difference between surviving a surprise and losing the mission, and every
        kilogram, watt and dollar of it is yours to decide.
      </motion.figcaption>
    </figure>
  );
}

const STEPS = [
  {
    title: 'Design it',
    body: 'Pick a science goal, then build the spacecraft part by part. Every choice ripples: a bigger dish adds mass, mass adds propellant, propellant may need a bigger rocket.',
  },
  {
    title: 'Fly it',
    body: 'Defend the design at a review board, then fly the mission in fast-forward. The surprises along the way are real anomalies from NASA missions.',
  },
  {
    title: 'Find out what mattered',
    body: 'The debrief replays your mission with one decision changed at a time, and sets your spacecraft beside the real one that flew.',
  },
];

export function Title() {
  const go = useGame((s) => s.go);
  const startJupiterDemo = useGame((s) => s.startJupiterDemo);
  const how = useRef<HTMLElement>(null);

  return (
    <div className="sheet-grid scroll-quiet h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-5 sm:px-8 sm:py-10 lg:px-14">
        <div className="flex flex-1 flex-col justify-center py-8">
          <h1 className="text-[clamp(3rem,13vw,10.5rem)] leading-[0.9] font-bold tracking-[0.12em]">MARGIN</h1>
          <p className="mt-5 text-2xl font-medium">Design it. Fly it. Find out what mattered.</p>
          <MarginHero />
          <div className="mt-7 grid grid-cols-2 items-center gap-3 sm:mt-10 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-4">
            <Button variant="primary" size="lg" className="col-span-2" onClick={startJupiterDemo}>
              Try the Jupiter demo
            </Button>
            <Button variant="secondary" className="col-span-2" onClick={() => go('scenario')}>
              New mission
            </Button>
            <Button variant="quiet" onClick={() => how.current?.scrollIntoView({ behavior: 'smooth' })}>
              How it works
            </Button>
            <Button variant="quiet" onClick={() => go('credits')}>
              Credits and sources
            </Button>
          </div>
        </div>

        <section ref={how} aria-label="How it works" className="border-t border-line pt-8 pb-4">
          <ol className="grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <div className="flex items-baseline gap-3">
                  <span className="num text-dim">{i + 1}</span>
                  <h2 className="text-xl font-bold">{s.title}</h2>
                </div>
                <p className="mt-2 text-dim">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-dim">
            A space mission design game built on NASA data for the NASA Space Apps Challenge 2026, by team Torpid. Not affiliated with or endorsed by NASA.
          </p>
        </section>
      </div>
    </div>
  );
}
