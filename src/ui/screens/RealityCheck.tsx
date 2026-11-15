import { useMemo } from 'react';
import { motion } from 'motion/react';
import { catalog } from '../../data';
import { engine } from '../../engine';
import { useGame } from '../../store/game';
import { Button } from '../common/Button';
import { kg, money, num, signedPct } from '../common/format';
import { MarginBar } from '../common/MarginBar';
import { ActionBar, Section, Sheet } from '../common/Sheet';
import { severityFor, StatusIcon, TONE_TEXT } from '../common/status';

export function RealityCheck() {
  const design = useGame((s) => s.design)!;
  const seed = useGame((s) => s.seed);
  const update = useGame((s) => s.updateDesign);
  const go = useGame((s) => s.go);
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId)!;

  const budgets = useMemo(() => engine.computeBudgets(catalog, design), [design]);
  const reveal = useMemo(() => engine.revealGrowth(catalog, design, seed), [design, seed]);
  const lines = [...reveal.lines].sort((a, b) => b.massKg - a.massKg);
  const maxKg = Math.max(...lines.map((l) => l.massKg), 0.001);

  const allowance = reveal.massAllowanceKg ?? budgets.mass.growthAllowanceKg;
  const capacity = reveal.lvCapacityKg ?? budgets.mass.lvCapacityKg;
  const newWet = reveal.newWetKg ?? budgets.mass.wetKg + reveal.massGrowthKg;
  const massSev = reveal.newMassMarginPct < 0 ? 'red' : severityFor('mass.marginPct', reveal.newMassMarginPct);
  const overAllowance = reveal.massGrowthKg > allowance;
  const reserveBroken = reveal.reserveRemainingM < 0;

  const onBoard = design.instrumentIds.map((id) => catalog.instruments.find((i) => i.id === id)).filter((i) => i !== undefined);
  const otherRockets = scenario.launchVehicleIds
    .map((id) => catalog.launchVehicles.find((l) => l.id === id))
    .filter((l) => l !== undefined)
    .filter((l) => l.id !== design.launchVehicleId && (!l.classes || l.classes.includes(scenario.missionClassId)));

  const revealEnd = 0.5 + lines.length * 0.06;

  return (
    <Sheet
      actions={
        <ActionBar
          primary={{ label: 'Roll out to the launch pad', onClick: () => go('flight'), disabled: reveal.mustDescope }}
          note={reveal.mustDescope ? 'The spacecraft as built cannot launch. Cut something first.' : 'The design is frozen. What flies is what you see here.'}
        />
      }
    >
      <div className="scroll-quiet h-full overflow-y-auto">
        <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-8 px-8 py-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:px-12">
          <div>
            <p className="text-dim">Two years later, in the clean room</p>
            <h1 className="mt-2 text-5xl leading-[1.05] font-bold">The hardware is heavier than the drawing</h1>
            <p className="mt-4 max-w-[62ch] text-lg text-dim">
              It always is. Parts that have flown before barely move; new technology can blow straight through its estimate. This is what margin and reserves are for.
            </p>

            <table className="mt-8 w-full">
              <thead>
                <tr className="border-b border-rule text-left text-sm text-dim">
                  <th className="py-2 font-medium">Part</th>
                  <th className="w-[34%] py-2 font-medium">Mass growth</th>
                  <th className="py-2 text-right font-medium">Cost growth</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06, duration: 0.25 }}
                    className="border-b border-line/60"
                  >
                    <td className="py-2 pr-4">{l.label}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="num w-20 shrink-0 text-right">+{num(l.massKg, 1)} kg</span>
                        <span className="h-2 flex-1">
                          <motion.span
                            className="block h-full bg-caution"
                            initial={{ width: 0 }}
                            animate={{ width: `${(l.massKg / maxKg) * 100}%` }}
                            transition={{ delay: 0.35 + i * 0.06, duration: 0.4 }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="num py-2 text-right">+{money(l.costM)}</td>
                  </motion.tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-dim">
                      The growth figures are not available in this build yet.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: revealEnd }} className="font-bold">
                  <td className="py-3">Total</td>
                  <td className="py-3">
                    <span className="num inline-block w-20 text-right">+{num(reveal.massGrowthKg, 1)} kg</span>
                  </td>
                  <td className="num py-3 text-right">+{money(reveal.costGrowthM)}</td>
                </motion.tr>
              </tfoot>
            </table>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: revealEnd + 0.15, duration: 0.4 }} className="space-y-8 lg:pt-8">
            <Section title="Did your margin hold?">
              <div className="space-y-6">
                <div>
                  <div className="mb-1.5 flex items-end justify-between gap-4">
                    <p>
                      Growth of <span className="num">{kg(reveal.massGrowthKg)}</span> against an allowance of <span className="num">{kg(allowance)}</span>
                    </p>
                    <StatusIcon severity={overAllowance ? 'yellow' : 'green'} size={18} />
                  </div>
                  <MarginBar need={reveal.massGrowthKg} have={allowance} severity={overAllowance ? 'yellow' : 'green'} ariaLabel="Mass growth against the growth allowance" />
                  <p className="mt-1 text-sm text-dim">{overAllowance ? 'More than the design allowed for. The rest comes out of your launch margin.' : 'Inside the allowance the design already carried.'}</p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-end justify-between gap-4">
                    <p>
                      Launch mass is now <span className="num">{kg(newWet)}</span>; the rocket lifts <span className="num">{kg(capacity)}</span>
                    </p>
                    <span className={`num text-2xl leading-none font-medium ${TONE_TEXT[massSev]}`}>{signedPct(reveal.newMassMarginPct)}</span>
                  </div>
                  <MarginBar need={newWet} have={capacity} severity={massSev} ariaLabel="Launch mass against rocket capacity" />
                  <p className="mt-1 text-sm text-dim">
                    Mass margin was <span className="num">{signedPct(budgets.mass.marginPct)}</span> on the drawing.
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-end justify-between gap-4">
                    <p>
                      Cost growth of <span className="num">{money(reveal.costGrowthM)}</span> paid from <span className="num">{money(budgets.cost.reserveM)}</span> of reserves
                    </p>
                    <span className={`num text-2xl leading-none font-medium ${reserveBroken ? 'text-nogo' : 'text-ink'}`}>{money(reveal.reserveRemainingM)}</span>
                  </div>
                  <MarginBar need={reveal.costGrowthM} have={budgets.cost.reserveM} severity={reserveBroken ? 'red' : 'green'} ariaLabel="Cost growth against reserves" />
                  <p className="mt-1 text-sm text-dim">{reserveBroken ? 'The reserve is gone and the project is over budget.' : 'What is left pays for trouble during the flight.'}</p>
                </div>
              </div>
            </Section>

            {reveal.mustDescope && (
              <div role="alert" className="border border-nogo bg-nogo/10 p-5">
                <div className="flex items-center gap-2 text-lg font-bold text-nogo">
                  <StatusIcon severity="red" size={18} />
                  You have to cut something
                </div>
                <p className="mt-1">
                  {reserveBroken ? 'The cost growth is bigger than your reserves.' : 'The spacecraft is now too heavy for its rocket.'} Take an instrument off, or move to a different rocket. The numbers above
                  update as you choose.
                </p>
                <h3 className="mt-4 mb-2 font-bold">Remove an instrument</h3>
                <div className="flex flex-wrap gap-2">
                  {onBoard.map((ins) => (
                    <Button key={ins.id} variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={() => update({ instrumentIds: design.instrumentIds.filter((x) => x !== ins.id) })}>
                      {ins.name} <span className="num text-dim">−{kg(ins.massKg)}</span>
                    </Button>
                  ))}
                  {onBoard.length === 0 && <span className="text-dim">No instruments left to remove.</span>}
                </div>
                {otherRockets.length > 0 && (
                  <>
                    <h3 className="mt-4 mb-2 font-bold">Switch rocket</h3>
                    <div className="flex flex-wrap gap-2">
                      {otherRockets.map((l) => (
                        <Button key={l.id} variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={() => update({ launchVehicleId: l.id })}>
                          {l.name} <span className="num text-dim">{money(l.costM)}</span>
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </Sheet>
  );
}
