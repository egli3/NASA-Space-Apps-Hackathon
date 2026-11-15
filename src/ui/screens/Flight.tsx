import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { catalog } from '../../data';
import { engine } from '../../engine';
import { useGame } from '../../store/game';
import type { EventCard } from '../../types/catalog';
import type { LogEntry, Severity, Vec2 } from '../../types/engine';
import { Button, Segmented } from '../common/Button';
import { au, date, gigabits, kg, money, num, pct, watts } from '../common/format';
import { PHASE_LABEL, TAB_LABEL } from '../common/labels';
import { PercentBar } from '../common/MarginBar';
import { SheetHeader } from '../common/Sheet';
import { EventModal, RealStoryCard } from '../flight/EventModal';
import { SolarSystemView } from '../flight/SolarSystemView';
import { mockEventsRequested, withMockEvents } from '../mocks/mockEvents';

/** Time compression from GAME_DESIGN §2: 1× / 10× / 100× are 2 / 20 / 120 mission days per second. */
const SPEEDS = { '1': 2, '10': 20, '100': 120 } as const;
type Speed = keyof typeof SPEEDS;

const LOG_TONE: Record<LogEntry['kind'], string> = {
  info: 'text-dim',
  milestone: 'text-ink',
  event: 'text-caution',
  decision: 'text-caution',
  anomaly: 'text-nogo',
  science: 'text-go',
};

function Readout({ label, value, bar, tone = 'green' }: { label: string; value: ReactNode; bar?: number; tone?: Severity }) {
  const color = tone === 'red' ? 'bg-nogo' : tone === 'yellow' ? 'bg-caution' : 'bg-go';
  return (
    <div className="border-b border-line px-4 py-2">
      <div className="flex flex-col">
        <span className="text-sm text-dim">{label}</span>
        <span className={`num ${tone === 'red' ? 'text-nogo' : tone === 'yellow' ? 'text-caution' : 'text-ink'}`}>{value}</span>
      </div>
      {bar !== undefined && (
        <div className="mt-1.5 h-1 bg-line">
          <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(1, bar)) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

export function Flight() {
  const design = useGame((s) => s.design)!;
  const seed = useGame((s) => s.seed);
  const guided = useGame((s) => s.guidedFlight);
  const finishFlight = useGame((s) => s.finishFlight);

  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId)!;
  const dest = catalog.destinations.find((d) => d.id === scenario.destinationId)!;
  const traj = catalog.trajectories.find((t) => t.id === design.trajectoryId)!;
  const orbit = dest.orbits.find((o) => o.id === design.orbitId);
  const budgets = useMemo(() => engine.computeBudgets(catalog, design), [design]);

  const sim = useMemo(() => {
    const real = engine.createSimulation(catalog, design, seed);
    if (!mockEventsRequested()) return real;
    const deck = scenario.eventIds.map((id) => catalog.events.find((e) => e.id === id)).filter((e) => e !== undefined);
    return withMockEvents(real, deck);
  }, [design, seed, scenario]);

  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(guided ? '100' : '10');
  const [story, setStory] = useState<{ card: EventCard; optionId: string; outcome: LogEntry[] } | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const trail = useRef<Vec2[]>([]); // the cruise path, kept for the whole mission
  const tail = useRef<Vec2[]>([]); // the last few weeks, wherever the spacecraft is
  const lastTrailDay = useRef(-1);

  // Mission timeline, from data: how long each phase lasts.
  const timeline = useMemo(() => {
    const ab = orbit?.aerobraking?.aerobrakingDays ?? 0;
    const parts = [
      { id: 'cruise', label: 'Cruise', days: traj.tofDays },
      ...(ab > 0 ? [{ id: 'aerobraking', label: 'Aerobraking', days: ab }] : []),
      { id: 'science', label: 'Primary science', days: scenario.primaryMissionYears * 365 },
      ...(scenario.extendedMissionYears > 0 ? [{ id: 'extended', label: 'Extended mission', days: scenario.extendedMissionYears * 365 }] : []),
    ];
    return { parts, total: parts.reduce((a, p) => a + p.days, 0) };
  }, [orbit, traj, scenario]);

  const state = sim.state;
  const pending = state.pending;
  const running = started && !paused && !pending && !story && !state.ended;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const trailStep = Math.max(1, Math.round(traj.tofDays / 120));
    const frame = (now: number) => {
      // Cap the step so a tab that was in the background does not leap months ahead when it comes back.
      carry += Math.min(0.5, (now - last) / 1000) * SPEEDS[speedRef.current];
      last = now;
      const days = Math.floor(carry);
      if (days > 0) {
        carry -= days;
        // Advance in short hops so the drawn path stays smooth even when frames are slow.
        let left = days;
        while (left > 0 && !sim.state.ended && !sim.state.pending) {
          const hop = Math.min(left, trailStep);
          sim.advance(hop);
          left -= hop;
          const s = sim.state;
          if (s.day - lastTrailDay.current >= trailStep) {
            const p = { x: s.spacecraft.x, y: s.spacecraft.y };
            if (s.phase === 'launch' || s.phase === 'cruise') trail.current.push(p);
            tail.current.push(p);
            if (tail.current.length > 45) tail.current.shift();
            lastTrailDay.current = s.day;
          }
        }
        redraw();
        if (sim.state.ended || sim.state.pending) return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, sim, traj.tofDays]);

  // Keyboard: space pauses, 1/2/3 pick the speed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || pending || story || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === '1') setSpeed('1');
      else if (e.key === '2') setSpeed('10');
      else if (e.key === '3') setSpeed('100');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, pending, story]);

  const lost = state.lossCause !== undefined;
  const storageFrac = budgets.comms.storageGb > 0 ? state.storageUsedGb / budgets.comms.storageGb : 0;
  const doseFrac = budgets.radiation.toleranceKrad > 0 ? state.doseKrad / budgets.radiation.toleranceKrad : 0;
  const propFrac = budgets.mass.propellantKg > 0 ? state.propellantKg / budgets.mass.propellantKg : 0;
  const troubled = Object.entries(state.health).filter(([, v]) => v && v !== 'ok');
  const partName = (id: string) => catalog.instruments.find((i) => i.id === id)?.name ?? (id in TAB_LABEL ? TAB_LABEL[id as keyof typeof TAB_LABEL] : id);
  const linkUp = (state.phase === 'science' || state.phase === 'extended') && state.safeModeDaysLeft === 0 && !state.inConjunction && !lost;
  const log = [...sim.log].reverse();

  const finish = () => finishFlight(sim.result(), { ...sim.decisions });

  return (
    <div className="sheet-grid flex h-full flex-col">
      <SheetHeader />

      {/* clock and mission timeline */}
      <div className="grid shrink-0 items-center gap-2 border-b border-line bg-panel px-3 py-2 sm:px-5 sm:py-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8">
        <div className="grid min-w-0 grid-cols-3 items-baseline gap-2 sm:flex sm:gap-6">
          <div>
            <div className="text-sm text-dim">Date</div>
            <div className="num text-sm leading-tight sm:text-2xl">{date(state.date)}</div>
          </div>
          <div>
            <div className="text-sm text-dim">Mission day</div>
            <div className="num text-sm leading-tight sm:text-2xl">{num(state.day)}</div>
          </div>
          <div>
            <div className="text-sm text-dim">Phase</div>
            <div className={`text-sm leading-tight font-bold sm:text-2xl ${lost ? 'text-nogo' : 'text-go'}`}>{lost ? 'Mission lost' : PHASE_LABEL[state.phase]}</div>
          </div>
        </div>
        <div aria-hidden>
          <div className="relative flex h-2.5 border border-rule">
            {timeline.parts.map((p, i) => (
              <div key={p.id} className={`h-full ${i > 0 ? 'border-l border-rule' : ''}`} style={{ width: `${(p.days / timeline.total) * 100}%` }} />
            ))}
            <div className="absolute inset-y-0 left-0 bg-go/70" style={{ width: `${Math.min(100, (state.day / timeline.total) * 100)}%` }} />
            <div className="absolute -top-1 -bottom-1 w-0.5 bg-ink" style={{ left: `${Math.min(100, (state.day / timeline.total) * 100)}%` }} />
          </div>
          <div className="mt-1 flex text-xs text-dim">
            {timeline.parts.map((p) => (
              <div key={p.id} className="truncate" style={{ width: `${(p.days / timeline.total) * 100}%` }}>
                {p.days / timeline.total > 0.07 ? p.label : ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="scroll-quiet min-h-0 min-w-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="relative h-64 min-h-0 sm:h-80 lg:h-auto">
          <div className="absolute inset-x-0 top-14 bottom-0 p-2 sm:inset-0 sm:p-3">
            <SolarSystemView state={state} trail={trail.current} tail={tail.current} destName={dest.name} destAU={dest.solarDistanceAU} targetIsMoon={dest.kind === 'moon'} linkUp={linkUp} />
          </div>
          <dl className="absolute inset-x-3 top-2 grid grid-cols-3 gap-2 sm:inset-x-auto sm:top-4 sm:left-5 sm:block sm:space-y-2">
            <div>
              <dt className="text-sm text-dim">From the Sun</dt>
              <dd className="num text-sm sm:text-lg">{au(state.sunDistanceAU)}</dd>
            </div>
            <div>
              <dt className="text-sm text-dim">From Earth</dt>
              <dd className="num text-sm sm:text-lg">{dest.kind === 'moon' ? `${num(state.earthDistanceAU * catalog.constants.auKm, 0)} km` : au(state.earthDistanceAU)}</dd>
            </div>
            <div>
              <dt className="text-sm text-dim">Radio signal takes</dt>
              {/* light-time is a unit conversion of the engine's distance: 1 AU ≈ 499 light-seconds */}
              <dd className="num text-sm sm:text-lg">{state.earthDistanceAU * 499 < 90 ? `${num(state.earthDistanceAU * 499, 1)} s` : `${num((state.earthDistanceAU * 499) / 60, 1)} min`}</dd>
            </div>
          </dl>
          {!started && (
            <div className="absolute inset-x-3 bottom-3 text-center sm:inset-x-0 sm:bottom-8">
              <p className="mx-auto max-w-md bg-panel/80 px-2 py-1 text-sm sm:bg-transparent sm:text-lg">
                {design.missionName} is on the pad at day zero. Once it leaves, you cannot change the design. You can only decide.
              </p>
            </div>
          )}
          <div className="absolute inset-x-3 bottom-3 space-y-2 text-right sm:inset-x-auto sm:right-5 sm:bottom-5" aria-live="polite">
            {state.inConjunction && !lost && <div className="border border-caution bg-panel px-3 py-2 text-caution">The Sun is in the way. No contact with Earth.</div>}
            {state.safeModeDaysLeft > 0 && (
              <div className="border border-caution bg-panel px-3 py-2 text-caution">
                Safe mode, <span className="num">{num(state.safeModeDaysLeft)}</span> days left
              </div>
            )}
          </div>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col border-t border-line bg-panel/90 lg:border-t-0 lg:border-l">
          <div className="border-b border-line px-4 py-3.5">
            <div className="flex items-end justify-between gap-3">
              <span className="text-dim">Science returned</span>
              <span className="num text-5xl leading-none text-go">
                {num(state.sciencePct, 1)}
                <span className="text-2xl text-dim">%</span>
              </span>
            </div>
            <div className="mt-3">
              <PercentBar value={state.sciencePct} severity="green" ticks={[75, 90]} height={10} ariaLabel={`Science returned ${pct(state.sciencePct)}`} />
              <div className="relative mt-1 h-4 text-xs text-dim">
                <span className="absolute -translate-x-1/2" style={{ left: '75%' }}>
                  baseline
                </span>
              </div>
            </div>
            <ul className="mt-1 space-y-1.5">
              {scenario.objectives.map((o) => {
                const v = Math.max(0, Math.min(100, state.objectivePct?.[o.id] ?? 0));
                return (
                  <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_3.5rem_2.75rem] sm:grid-cols-[minmax(0,1fr)_5rem_2.75rem] items-center gap-2 text-sm">
                    <span className={`min-w-0 ${v > 0 ? '' : 'text-dim'}`}>{o.name}</span>
                    <span className="relative h-1.5 bg-line">
                      <span className="absolute inset-y-0 left-0 bg-go" style={{ width: `${v}%` }} />
                      <span className="absolute -inset-y-0.5 w-px bg-caution" style={{ left: `${o.thresholdPct}%` }} />
                    </span>
                    <span className="num text-right">{num(v)}%</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div aria-label="Telemetry" className="grid grid-cols-2 [&>*:nth-child(odd)]:border-r">
            <Readout label="Power being made" value={watts(state.powerW)} />
            <Readout label="Battery" value={pct(state.batterySoc * 100)} bar={state.batterySoc} tone={state.batterySoc < 0.2 ? 'red' : state.batterySoc < 0.4 ? 'yellow' : 'green'} />
            <Readout
              label="Recorder"
              value={`${gigabits(state.storageUsedGb)} of ${gigabits(budgets.comms.storageGb)}`}
              bar={storageFrac}
              tone={storageFrac > 0.98 ? 'red' : storageFrac > 0.8 ? 'yellow' : 'green'}
            />
            <Readout label="Data lost" value={gigabits(state.dataLostGb)} tone={state.dataLostGb > 0 ? 'red' : 'green'} />
            <Readout label="Propellant" value={kg(state.propellantKg)} bar={propFrac} tone={propFrac < 0.05 ? 'red' : propFrac < 0.15 ? 'yellow' : 'green'} />
            <Readout
              label="Radiation dose"
              value={`${num(state.doseKrad, 1)} of ${num(budgets.radiation.toleranceKrad)} krad`}
              bar={doseFrac}
              tone={doseFrac > 1 ? 'red' : doseFrac > 0.5 ? 'yellow' : 'green'}
            />
            <Readout label="Reserves left" value={money(state.reserveRemainingM)} tone={state.reserveRemainingM < 0 ? 'red' : 'green'} />
            {troubled.map(([id, health]) => (
              <Readout key={id} label={partName(id)} value={health === 'failed' ? 'failed' : 'degraded'} tone={health === 'failed' ? 'red' : 'yellow'} />
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <h2 className="border-b border-line px-4 py-2 font-bold">Flight log</h2>
            <ol className="scroll-quiet min-h-0 flex-1 overflow-y-auto" aria-live="polite">
              {log.length === 0 && <li className="px-4 py-3 text-sm text-dim">Nothing yet. The log fills as the mission flies.</li>}
              {log.map((l, i) => (
                <li key={log.length - i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[6.75rem_minmax(0,1fr)] sm:gap-3 border-b border-line/60 px-4 py-1.5 text-sm">
                  <span className="num text-dim">{date(l.date)}</span>
                  <span className={LOG_TONE[l.kind]}>{l.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </main>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-panel px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:min-h-16 sm:gap-4 sm:px-5">
        {started && !state.ended && (
          <>
            <Button variant="secondary" onClick={() => setPaused((p) => !p)} className="min-h-11 min-w-20 sm:w-28">
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Segmented<Speed>
              label="Speed"
              value={speed}
              onChange={setSpeed}
              options={[
                { value: '1', label: '1×', hint: '2 days a second' },
                { value: '10', label: '10×', hint: '20 days a second' },
                { value: '100', label: '100×', hint: '120 days a second' },
              ]}
            />
            <span className="hidden text-sm text-dim sm:inline">
              <span className="num">{SPEEDS[speed]}</span> days a second. Space pauses.
            </span>
          </>
        )}
        {(!started || state.ended) && (
          <div className="ml-auto min-w-0 text-sm text-dim sm:text-right">
            {state.ended ? (lost ? state.lossCause : `Mission complete after ${num(state.day)} days.`)
              : `${scenario.title}, launching on ${catalog.launchVehicles.find((l) => l.id === design.launchVehicleId)?.name ?? 'your rocket'}`}
          </div>
        )}
        {!started && (
          <Button variant="primary" size="lg" className="min-h-11 w-full sm:w-auto" onClick={() => setStarted(true)}>
            Launch
          </Button>
        )}
        {state.ended && (
          <Button variant="primary" className="min-h-11 w-full sm:w-auto" onClick={finish}>
            Read the debrief
          </Button>
        )}
      </footer>

      <AnimatePresence>
        {pending && !story && (
          <EventModal
            key="event"
            pending={pending}
            date={date(state.date)}
            onDecide={(optionId) => {
              const res = sim.decide(optionId);
              setStory({ card: pending.card, optionId, outcome: res.newLog });
            }}
          />
        )}
        {story && <RealStoryCard key="story" {...story} onResume={() => setStory(null)} />}
      </AnimatePresence>
    </div>
  );
}
