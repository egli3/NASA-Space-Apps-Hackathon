import { useMemo, type ReactNode } from 'react';
import { catalog } from '../../data';
import { engine } from '../../engine';
import { useGame } from '../../store/game';
import type { Trajectory } from '../../types/catalog';
import { Slider } from '../common/Button';
import { date, deltaV, duration, kg, money, num, pct, signedPct } from '../common/format';
import { MarginBar } from '../common/MarginBar';
import { Term } from '../common/Popover';
import { ActionBar, Section, Sheet } from '../common/Sheet';
import { severityFor, StatusIcon, TONE_TEXT } from '../common/status';
import { BudgetPanel } from '../design/BudgetPanel';
import { RippleChips } from '../design/RippleChips';

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** A small plan view of the route. Not to scale (the radii are compressed so Jupiter fits); it shows the shape of the trip. */
function RouteDiagram({ traj, destName, destAU }: { traj: Trajectory; destName: string; destAU: number }) {
  const size = 150;
  const c = size / 2;
  const stroke = { fill: 'none', stroke: 'currentColor' };

  if (traj.kind === 'lunar_transfer') {
    const slow = traj.tofDays > 30;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 text-ink" aria-hidden>
        <circle cx={c} cy={c} r={slow ? 26 : 52} {...stroke} strokeDasharray="2 4" opacity="0.6" />
        <circle cx={c} cy={c} r="5" fill="currentColor" />
        {slow ? (
          <path d={`M ${c} ${c} C ${c + 20} ${c + 80}, ${c + 95} ${c + 10}, ${c + 66} ${c - 44} S ${c + 4} ${c - 60}, ${c + 2} ${c - 27}`} {...stroke} strokeWidth="1.6" className="text-caution" />
        ) : (
          <path d={`M ${c} ${c} C ${c + 34} ${c + 22}, ${c + 56} ${c - 20}, ${c + 2} ${c - 52}`} {...stroke} strokeWidth="1.6" className="text-caution" />
        )}
        <circle cx={c + 2} cy={c - (slow ? 26 : 52)} r="3.5" {...stroke} className="fill-bg" />
        <text x={c + 9} y={c + 14} className="fill-current text-[11px]">Earth</text>
        <text x={c + 9} y={c - (slow ? 26 : 52) + 4} className="fill-current text-[11px]">Moon</text>
      </svg>
    );
  }

  const far = destAU > 3;
  const r1 = far ? 20 : 34;
  const r2 = far ? 66 : 60;
  const a0 = Math.PI * 0.75;
  const sweep = Math.PI * 0.86;
  const pt = (r: number, a: number) => `${(c + r * Math.cos(a)).toFixed(1)} ${(c - r * Math.sin(a)).toFixed(1)}`;
  const samples: string[] = [];
  let end = a0;
  if (traj.kind === 'gravity_assist') {
    // one loop out and back to Earth for the flyby...
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      samples.push(pt(r1 + (r2 * 0.52 - r1) * Math.sin(Math.PI * t), a0 + 2 * Math.PI * t));
    }
    end = a0 + 2 * Math.PI;
  }
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    samples.push(pt(r1 + ((r2 - r1) * (1 - Math.cos(Math.PI * t))) / 2, end + sweep * t));
  }
  const [ex, ey] = pt(r1, a0).split(' ').map(Number);
  const [tx, ty] = pt(r2, end + sweep).split(' ').map(Number);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 text-ink" aria-hidden>
      <circle cx={c} cy={c} r={r1} {...stroke} strokeDasharray="2 4" opacity="0.6" />
      <circle cx={c} cy={c} r={r2} {...stroke} strokeDasharray="2 4" opacity="0.6" />
      <circle cx={c} cy={c} r="3" fill="currentColor" />
      <path d={`M ${samples.join(' L ')}`} {...stroke} strokeWidth="1.6" className="text-caution" />
      <circle cx={ex} cy={ey} r="3.5" fill="currentColor" />
      <circle cx={tx} cy={ty} r="3.5" {...stroke} className="fill-bg" />
      <text x={ex - 6} y={ey - 7} textAnchor="end" className="fill-current text-[11px]">Earth</text>
      <text x={tx} y={ty + 15} textAnchor="middle" className="fill-current text-[11px]">{destName}</text>
    </svg>
  );
}

function Fact({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div>
      <dt className="text-sm text-dim">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

const C3_HELP =
  'C3 is launch energy: how hard the rocket must throw the spacecraft to put it on this path. The higher the C3, the less mass any rocket can deliver.';

export function Launch() {
  const design = useGame((s) => s.design)!;
  const update = useGame((s) => s.updateDesign);
  const go = useGame((s) => s.go);
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId)!;
  const dest = catalog.destinations.find((d) => d.id === scenario.destinationId)!;
  const budgets = useMemo(() => engine.computeBudgets(catalog, design), [design]);

  const trajectories = scenario.trajectoryIds.map((id) => catalog.trajectories.find((t) => t.id === id)).filter((t) => t !== undefined);
  const traj = trajectories.find((t) => t.id === design.trajectoryId) ?? trajectories[0];
  const half = Math.floor(traj.launchWindowDays / 2);
  // Mirrors GAME_DESIGN §4.2 for display only; the engine applies the same penalty when it looks up rocket capacity.
  const c3 = traj.c3Km2s2 + catalog.constants.offOptimalC3PerDay * Math.abs(design.launchOffsetDays);

  const rockets = scenario.launchVehicleIds
    .map((id) => catalog.launchVehicles.find((l) => l.id === id))
    .filter((l) => l !== undefined)
    .filter((l) => !l.classes || l.classes.includes(scenario.missionClassId));
  // What each rocket could lift for this exact design and route: ask the engine, once per rocket.
  const perRocket = useMemo(
    () => Object.fromEntries(rockets.map((l) => [l.id, engine.computeBudgets(catalog, { ...design, launchVehicleId: l.id })])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [design],
  );

  return (
    <Sheet
      actions={
        <ActionBar
          back={{ label: 'Design studio', onClick: () => go('design') }}
          primary={{ label: 'Face the review board', onClick: () => go('review') }}
          note={budgets.mass.marginPct < 0 ? 'The spacecraft is too heavy for this rocket on this route.' : undefined}
        />
      }
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="scroll-quiet min-h-0 overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-5xl space-y-8">
            <Section title="Route" aside={`to ${dest.name}`}>
              <div role="radiogroup" aria-label="Route" className="grid gap-3 xl:grid-cols-2">
                {trajectories.map((t) => {
                  const on = t.id === traj.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => update({ trajectoryId: t.id, launchOffsetDays: 0 })}
                      className={`flex gap-4 border p-4 text-left transition-colors ${on ? 'border-ink bg-raised' : 'border-line bg-panel/70 hover:border-rule'}`}
                    >
                      <RouteDiagram traj={t} destName={dest.name} destAU={dest.solarDistanceAU} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-[17px] leading-snug font-bold">{t.name}</span>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${on ? 'border-ink bg-ink' : 'border-rule'}`}>
                            {on && <span className="h-2 w-2 rounded-full bg-bg" />}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm">{t.blurb}</span>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                          <Fact label="Travel time" value={duration(t.tofDays)} />
                          <Fact label="Launch energy, C3" value={`${num(t.c3Km2s2, 1)} km²/s²`} />
                          <Fact label="Burn on the way" value={t.dsmDvMs > 0 ? deltaV(t.dsmDvMs) : 'none'} />
                          <Fact label="Arrival speed" value={`${num(t.arrivalVinfKms, 1)} km/s`} />
                        </dl>
                        {t.flybys.length > 0 && <span className="mt-2 block text-sm text-dim">Swings past {t.flybys.map((f) => f.bodyId).join(', ')} on day {num(t.flybys[0].dayOffset)} for a free boost.</span>}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 border border-line bg-panel/70 px-4 py-3.5">
                <Slider
                  label="Launch date"
                  value={design.launchOffsetDays}
                  min={-half}
                  max={half}
                  onChange={(launchOffsetDays) => update({ launchOffsetDays })}
                  display={date(addDays(traj.launchDate, design.launchOffsetDays))}
                  mark={{ value: 0, label: 'best day' }}
                />
                <p className="mt-5 text-sm text-dim">
                  {design.launchOffsetDays === 0 ? 'Launching on the best day of the window.' : `${Math.abs(design.launchOffsetDays)} days ${design.launchOffsetDays < 0 ? 'early' : 'late'}.`} Every day off the best
                  date raises the <Term word="C3">{C3_HELP}</Term> the rocket must reach, now <span className="num text-ink">{num(c3, 1)} km²/s²</span>. A real programme slips; a wide window is margin too.
                </p>
              </div>
            </Section>

            <Section title="Rocket" aside={`what each can lift at C3 ${num(c3, 1)}`}>
              <div role="radiogroup" aria-label="Rocket" className="space-y-3">
                {rockets.map((l) => {
                  const on = l.id === design.launchVehicleId;
                  const b = perRocket[l.id];
                  const sev = b.mass.marginPct < 0 ? 'red' : severityFor('mass.marginPct', b.mass.marginPct);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => update({ launchVehicleId: l.id })}
                      className={`grid w-full grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center gap-6 border p-4 text-left transition-colors ${on ? 'border-ink bg-raised' : 'border-line bg-panel/70 hover:border-rule'}`}
                    >
                      <span>
                        <span className="flex items-center gap-3">
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${on ? 'border-ink bg-ink' : 'border-rule'}`}>{on && <span className="h-2 w-2 rounded-full bg-bg" />}</span>
                          <span className="text-[17px] leading-snug font-bold">{l.name}</span>
                        </span>
                        <span className="mt-1 block text-sm text-dim">{l.provider}</span>
                        <span className="mt-1 block text-sm">{l.blurb}</span>
                        <span className="mt-2 flex gap-5 text-sm">
                          <span>
                            <span className="text-dim">cost </span>
                            <span className="num">{money(l.costM)}</span>
                          </span>
                          <span>
                            <span className="text-dim">launches that succeed </span>
                            <span className="num">{pct(l.reliability * 100)}</span>
                          </span>
                        </span>
                      </span>
                      <span>
                        <span className="mb-1.5 flex items-end justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2">
                            <StatusIcon severity={sev} />
                            <span>
                              lifts <span className="num">{kg(b.mass.lvCapacityKg)}</span>, you weigh <span className="num">{kg(b.mass.wetKg)}</span>
                            </span>
                          </span>
                          <span className={`num text-xl leading-none font-medium ${TONE_TEXT[sev]}`}>{signedPct(b.mass.marginPct)}</span>
                        </span>
                        <MarginBar need={b.mass.wetKg} have={b.mass.lvCapacityKg} severity={sev} ariaLabel={`${l.name}: ${kg(b.mass.wetKg)} of ${kg(b.mass.lvCapacityKg)}`} />
                        {b.mass.lvCapacityKg <= 0 && <span className="mt-1 block text-sm text-nogo">This rocket cannot reach that launch energy at all.</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <RippleChips design={design} budgets={budgets} />
          </div>
        </div>
        <aside aria-label="Budgets" className="scroll-quiet min-h-0 overflow-y-auto border-l border-line bg-panel/85">
          <BudgetPanel design={design} budgets={budgets} only={['mass', 'deltaV', 'cost', 'reliability', 'science']} />
        </aside>
      </div>
    </Sheet>
  );
}
