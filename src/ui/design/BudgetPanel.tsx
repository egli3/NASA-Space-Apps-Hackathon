import type { ReactNode } from 'react';
import { catalog } from '../../data';
import type { MissionDesign } from '../../types/design';
import type { BudgetReport, LineItem, Severity } from '../../types/engine';
import { deltaV, gigabits, kg, money, num, pct, signedPct, wattHours, watts } from '../common/format';
import { MEASUREMENT_LABEL } from '../common/labels';
import { MarginBar, PercentBar } from '../common/MarginBar';
import { Popover } from '../common/Popover';
import { SourceLinks } from '../common/SourceLink';
import { severityFor, StatusIcon, TONE_TEXT, TONE_WORD } from '../common/status';

export type GaugeId = 'science' | 'mass' | 'power' | 'battery' | 'deltaV' | 'data' | 'cost' | 'radiation' | 'reliability';

/** The engine's reasons name measurement types by id; swap in the plain-English names. */
function humanize(text: string): string {
  let out = text;
  for (const [id, label] of Object.entries(MEASUREMENT_LABEL)) out = out.replaceAll(id, label);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

interface WhyProps {
  title: string;
  /** One plain sentence: what this number is. */
  what: string;
  formula?: string;
  /** Engine cause → effect lines for this metric. */
  explain?: string[];
  items?: { label: string; value: string }[];
  ruleMetric?: string;
  sourceIds?: string[];
}

/** "Why?" Every budget number explains itself: a sentence, the formula, the breakdown and the NASA source. */
function Why({ title, what, formula, explain = [], items, ruleMetric, sourceIds = [] }: WhyProps) {
  const rule = ruleMetric ? catalog.reviewRules.find((r) => r.metric === ruleMetric) : undefined;
  const ids = [...sourceIds, ...(rule?.sources ?? [])];
  return (
    <Popover
      label={`Why? ${title}`}
      trigger="Why?"
      triggerClassName="cursor-help text-sm text-dim underline decoration-dotted underline-offset-4 hover:text-ink"
      width={380}
    >
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm">{what}</p>
      {explain.map((e) => (
        <p key={e} className="mt-2 border-l-2 border-caution pl-3 text-sm">
          {e}
        </p>
      ))}
      {formula && <p className="num mt-3 border border-line bg-bg px-3 py-2 text-[13px] leading-relaxed">{formula}</p>}
      {items && items.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {items.map((it) => (
              <tr key={it.label} className="border-b border-line/60 last:border-0">
                <td className="py-1 pr-3 text-dim">{it.label}</td>
                <td className="num py-1 text-right whitespace-nowrap">{it.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rule && (
        <p className="mt-3 text-sm text-dim">
          The review board wants at least <span className="num text-ink">{pct(rule.yellow)}</span> and will not pass less than{' '}
          <span className="num text-ink">{pct(rule.red)}</span>.
        </p>
      )}
      <div className="mt-3 border-t border-line pt-3">
        <SourceLinks ids={ids} confidence={rule?.confidence} />
      </div>
    </Popover>
  );
}

interface RowProps {
  title: string;
  severity?: Severity;
  /** The margin, shown large on the right. */
  headline: string;
  headlineLabel: string;
  summary: ReactNode;
  why: ReactNode;
  children: ReactNode;
}

function GaugeRow({ title, severity, headline, headlineLabel, summary, why, children }: RowProps) {
  return (
    <li className="border-b border-line px-5 py-3.5 last:border-0">
      <div className="flex items-center gap-2">
        {severity ? <StatusIcon severity={severity} label={TONE_WORD[severity]} /> : <span className="h-4 w-4 shrink-0" />}
        <h3 className="font-bold">{title}</h3>
        <span className="ml-auto">{why}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-sm text-dim">{summary}</p>
        <p className={`num shrink-0 text-right text-xl leading-none font-medium ${severity ? TONE_TEXT[severity] : 'text-ink'}`} title={headlineLabel}>
          {headline}
        </p>
      </div>
      <div className="mt-2">{children}</div>
    </li>
  );
}

const N = ({ children }: { children: ReactNode }) => <span className="num text-ink">{children}</span>;

/** The engine explains every gauge (keyed by the review-rule metric) plus a few cause-and-effect lines; pick them by exact key, in order. */
const explainFor = (b: BudgetReport, ...metrics: string[]) => metrics.flatMap((m) => b.explain.filter((e) => e.metric === m));
const lines = (items: LineItem[], fmt: (n: number) => string) => items.filter((i) => Math.abs(i.value) > 1e-9).map((i) => ({ label: i.label, value: fmt(i.value) }));

interface Props {
  design: MissionDesign;
  budgets: BudgetReport;
  /** Show only some gauges (the Launch sheet shows the ones a rocket changes). */
  only?: GaugeId[];
}

export function BudgetPanel({ design, budgets: b, only }: Props) {
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId)!;
  const dest = catalog.destinations.find((d) => d.id === scenario.destinationId)!;
  const show = (id: GaugeId) => !only || only.includes(id);
  const m = b.metrics;

  const peakLoad = Math.max(b.power.loadScienceW, b.power.loadDownlinkW);
  const sev = {
    science: severityFor('science.expectedPct', b.science.expectedPct),
    mass: severityFor('mass.marginPct', m['mass.marginPct']),
    power: severityFor('power.marginPct', m['power.marginPct']),
    battery: severityFor('power.batteryMarginPct', m['power.batteryMarginPct']),
    data: severityFor('comms.dataMarginPct', m['comms.dataMarginPct']),
    cost: severityFor('cost.marginPct', m['cost.marginPct']),
    reserve: severityFor('cost.reservePct', m['cost.reservePct']),
    radiation: severityFor('radiation.doseMarginPct', m['radiation.doseMarginPct']),
    reliability: severityFor('risk.reliabilityPct', m['risk.reliabilityPct']),
  };
  const relRule = catalog.reviewRules.find((r) => r.metric === 'risk.reliabilityPct');
  const sciRule = catalog.reviewRules.find((r) => r.metric === 'science.expectedPct');
  const insertion = b.deltaV.items.find((i) => i.id === 'insertion');

  return (
    <div>
      {b.blockers.length > 0 && (
        <div role="alert" className="border-b border-nogo bg-nogo/12 px-5 py-3.5">
          <div className="flex items-center gap-2 font-bold text-nogo">
            <StatusIcon severity="red" />
            This design cannot fly
          </div>
          <ul className="mt-1.5 space-y-1 text-sm">
            {b.blockers.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      <ul>
        {show('science') && (
          <GaugeRow
            title="Science"
            severity={sev.science}
            headline={pct(b.science.expectedPct)}
            headlineLabel="Expected share of the baseline science"
            summary="of the science team’s wish list, if nothing goes wrong"
            why={
              <Why
                title="Science return"
                what="Each objective earns credit when an instrument on board can make the measurement well enough, and enough of its data reaches Earth."
                explain={explainFor(b, 'science.expectedPct').map((e) => e.text)}
                formula="science = Σ weight × quality × min(1, data returned ÷ data required)"
                ruleMetric="science.expectedPct"
                sourceIds={scenario.sources}
              />
            }
          >
            <PercentBar value={b.science.expectedPct} severity={sev.science} ticks={sciRule ? [sciRule.red, sciRule.yellow] : []} ariaLabel={`Expected science ${pct(b.science.expectedPct)}`} />
            <ul className="mt-3 space-y-2">
              {b.science.objectives.map((o) => {
                const obj = scenario.objectives.find((x) => x.id === o.objectiveId);
                if (!obj) return null;
                return (
                  <li key={o.objectiveId} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={o.expectedPct > 0 ? '' : 'text-dim'}>{obj.name}</span>
                      <span className="num shrink-0">
                        {num(o.expectedPct)}
                        <span className="text-dim">%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1 bg-line">
                      <div className="h-full bg-ink transition-[width] duration-300" style={{ width: `${Math.min(100, o.expectedPct)}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs text-dim">{humanize(o.reason)}</p>
                  </li>
                );
              })}
            </ul>
          </GaugeRow>
        )}

        {show('mass') && (
          <GaugeRow
            title="Mass"
            severity={sev.mass}
            headline={signedPct(b.mass.marginPct)}
            headlineLabel="Launch mass margin"
            summary={
              <>
                <N>{kg(b.mass.wetKg)}</N> fuelled, rocket lifts <N>{kg(b.mass.lvCapacityKg)}</N>
              </>
            }
            why={
              <Why
                title="Launch mass"
                what={`Wet mass is the spacecraft plus all the propellant it carries. The rocket can only throw so much toward ${dest.name}.`}
                explain={explainFor(b, 'mass.marginPct', 'mass.propellantKg').map((e) => e.text)}
                formula={explainFor(b, 'mass.marginPct', 'mass.propellantKg')[0]?.formula ?? 'margin = (rocket capacity − wet mass) ÷ rocket capacity'}
                items={[...lines(b.mass.items, kg), { label: 'Propellant', value: kg(b.mass.propellantKg) }]}
                ruleMetric="mass.marginPct"
                sourceIds={[...explainFor(b, 'mass.marginPct', 'mass.propellantKg').flatMap((e) => e.sourceIds ?? []), 'nasa-lsp-perf']}
              />
            }
          >
            <MarginBar
              need={b.mass.wetKg}
              have={b.mass.lvCapacityKg}
              severity={sev.mass}
              segments={[
                { id: 'dry', label: `Spacecraft ${kg(b.mass.dryKg)}`, value: b.mass.dryKg },
                { id: 'prop', label: `Propellant ${kg(b.mass.propellantKg)}`, value: b.mass.propellantKg },
              ]}
              ariaLabel={`Wet mass ${kg(b.mass.wetKg)} of ${kg(b.mass.lvCapacityKg)} launch capacity`}
            />
          </GaugeRow>
        )}

        {show('power') && (
          <GaugeRow
            title="Power"
            severity={sev.power}
            headline={signedPct(b.power.marginPct)}
            headlineLabel="Power margin at end of mission"
            summary={
              <>
                needs <N>{watts(peakLoad)}</N>, makes <N>{watts(b.power.generatedEolW)}</N> at end of mission
              </>
            }
            why={
              <Why
                title="Power"
                what="Power made at the end of the mission, when the source is most worn, against the hungriest operating mode."
                explain={explainFor(b, 'power.marginPct', 'power.generatedEolW').map((e) => e.text)}
                formula={explainFor(b, 'power.marginPct', 'power.generatedEolW')[0]?.formula ?? 'margin = (power at end of life − peak load) ÷ peak load'}
                items={[
                  { label: 'Made at arrival', value: watts(b.power.generatedBolW) },
                  { label: 'Made at end of mission', value: watts(b.power.generatedEolW) },
                  { label: 'Load while doing science', value: watts(b.power.loadScienceW) },
                  { label: 'Load while sending data', value: watts(b.power.loadDownlinkW) },
                  { label: 'Load in safe mode', value: watts(b.power.loadSafeW) },
                ]}
                ruleMetric="power.marginPct"
                sourceIds={explainFor(b, 'power.marginPct', 'power.generatedEolW').flatMap((e) => e.sourceIds ?? [])}
              />
            }
          >
            <MarginBar need={peakLoad} have={b.power.generatedEolW} severity={sev.power} ariaLabel={`Peak load ${watts(peakLoad)} of ${watts(b.power.generatedEolW)} generated`} />
          </GaugeRow>
        )}

        {show('battery') && (
          <GaugeRow
            title="Battery"
            severity={sev.battery}
            headline={b.power.batteryRequiredWh <= 0 ? 'no eclipse' : signedPct(b.power.batteryMarginPct)}
            headlineLabel="Battery margin through the longest eclipse"
            summary={
              b.power.batteryRequiredWh <= 0 ? (
                'this orbit never passes through shadow'
              ) : (
                <>
                  <N>{num(b.power.eclipseMinutes)} min</N> of shadow needs <N>{wattHours(b.power.batteryRequiredWh)}</N> of <N>{wattHours(b.power.batteryWh)}</N>
                </>
              )
            }
            why={
              <Why
                title="Battery through eclipse"
                what="On every orbit the planet blocks the Sun for a while. The battery must run the science load through the longest shadow without draining too deep."
                explain={explainFor(b, 'power.batteryMarginPct').map((e) => e.text)}
                formula="battery needed = science load × eclipse hours ÷ usable depth of discharge"
                ruleMetric="power.batteryMarginPct"
                sourceIds={['nasa-sst-soa']}
              />
            }
          >
            <MarginBar need={b.power.batteryRequiredWh} have={b.power.batteryWh} severity={sev.battery} ariaLabel={`Battery need ${wattHours(b.power.batteryRequiredWh)} of ${wattHours(b.power.batteryWh)}`} />
          </GaugeRow>
        )}

        {show('deltaV') && (
          <GaugeRow
            title="Change in speed"
            headline={deltaV(b.deltaV.totalMs)}
            headlineLabel="Total Δv the engine must deliver"
            summary={
              insertion ? (
                <>
                  Δv total; braking into orbit takes <N>{deltaV(insertion.value)}</N>
                </>
              ) : (
                'Δv total the engine must deliver'
              )
            }
            why={
              <Why
                title="Δv budget"
                what="Δv (delta-v) is the total change in speed the engine must deliver over the mission. It decides how much propellant you carry, and propellant is most of your mass."
                explain={explainFor(b, 'deltaV.totalMs').map((e) => e.text)}
                formula="orbit insertion Δv = √(v∞² + 2μ/rp) − √(μ(2/rp − 1/a))"
                items={lines(b.deltaV.items, deltaV)}
                sourceIds={['nasa-trajbrowser', 'jpl-phys-par']}
              />
            }
          >
            <div className="flex h-3.5 border border-rule" role="img" aria-label={`Δv ${deltaV(b.deltaV.totalMs)}`}>
              {b.deltaV.items
                .filter((i) => i.value > 0)
                .map((i, n) => (
                  <div
                    key={i.id}
                    title={`${i.label}: ${deltaV(i.value)}`}
                    className={`h-full transition-[width] duration-300 ${i.id === 'insertion' ? 'bg-ink' : i.id === 'margin' ? 'hatch text-ink' : 'bg-ink/50'} ${n > 0 ? 'border-l border-bg' : ''}`}
                    style={{ width: `${(i.value / (b.deltaV.totalMs || 1)) * 100}%` }}
                  />
                ))}
            </div>
          </GaugeRow>
        )}

        {show('data') && (
          <GaugeRow
            title="Data"
            severity={sev.data}
            headline={signedPct(b.comms.dataMarginPct)}
            headlineLabel="Data return margin"
            summary={
              <>
                makes <N>{gigabits(b.comms.generatedGbPerDay)}</N> a day, can send <N>{gigabits(b.comms.downlinkGbPerDay)}</N>
              </>
            }
            why={
              <Why
                title="Data return"
                what="Instruments make data every day. The radio link to the Deep Space Network decides how much of it reaches Earth; the rest is lost once the recorder fills."
                explain={explainFor(b, 'comms.dataMarginPct', 'comms.rateKbpsAtMean').map((e) => e.text)}
                formula={explainFor(b, 'comms.dataMarginPct', 'comms.rateKbpsAtMean')[0]?.formula}
                items={[
                  { label: `Link rate at average distance (${b.comms.band}-band)`, value: `${num(b.comms.rateKbpsAtMean, 1)} kbps` },
                  { label: 'Link rate at the farthest point', value: `${num(b.comms.rateKbpsAtMax, 1)} kbps` },
                  { label: 'Antenna time booked', value: `${num(design.dsnHoursPerDay)} h a day` },
                  { label: 'Onboard recorder', value: gigabits(b.comms.storageGb) },
                ]}
                ruleMetric="comms.dataMarginPct"
                sourceIds={explainFor(b, 'comms.dataMarginPct', 'comms.rateKbpsAtMean').flatMap((e) => e.sourceIds ?? [])}
              />
            }
          >
            <MarginBar need={b.comms.generatedGbPerDay} have={b.comms.downlinkGbPerDay} severity={sev.data} ariaLabel={`Data made ${gigabits(b.comms.generatedGbPerDay)} per day against ${gigabits(b.comms.downlinkGbPerDay)} sent`} />
          </GaugeRow>
        )}

        {show('cost') && (
          <GaugeRow
            title="Cost"
            severity={sev.cost}
            headline={signedPct(b.cost.marginPct)}
            headlineLabel="Room under the cost cap"
            summary={
              <>
                <N>{money(b.cost.totalM)}</N> of a <N>{money(b.cost.capM)}</N> cap, with{' '}
                <span className={sev.reserve === 'green' ? '' : TONE_TEXT[sev.reserve]}>
                  <span className="num">{pct(design.reservePct)}</span> held in reserve
                </span>
              </>
            }
            why={
              <Why
                title="Cost"
                what="Everything from the first drawing to the last day of operations, in millions of 2026 dollars. Reserves are money held back to pay for surprises."
                explain={explainFor(b, 'cost.marginPct').map((e) => e.text)}
                formula="total = development + launch + operations + reserves"
                items={[
                  { label: 'Development', value: money(b.cost.developmentM) },
                  { label: 'Launch', value: money(b.cost.launchM) },
                  { label: 'Operations', value: money(b.cost.operationsM) },
                  { label: 'Reserves', value: money(b.cost.reserveM) },
                  ...lines(
                    b.cost.items.filter((i) => !['launch', 'ops', 'reserve'].includes(i.id)),
                    money,
                  ),
                ]}
                ruleMetric="cost.marginPct"
              />
            }
          >
            <MarginBar
              need={b.cost.totalM}
              have={b.cost.capM}
              severity={sev.cost}
              segments={[
                { id: 'dev', label: `Development ${money(b.cost.developmentM)}`, value: b.cost.developmentM },
                { id: 'launch', label: `Launch ${money(b.cost.launchM)}`, value: b.cost.launchM },
                { id: 'ops', label: `Operations ${money(b.cost.operationsM)}`, value: b.cost.operationsM },
                { id: 'reserve', label: `Reserves ${money(b.cost.reserveM)}`, value: b.cost.reserveM },
              ]}
              ariaLabel={`Cost ${money(b.cost.totalM)} of ${money(b.cost.capM)} cap`}
            />
          </GaugeRow>
        )}

        {show('radiation') && (
          <GaugeRow
            title="Radiation"
            severity={sev.radiation}
            headline={signedPct(b.radiation.doseMarginPct)}
            headlineLabel="Radiation design margin"
            summary={
              <>
                dose <N>{num(b.radiation.primaryDoseKrad, 1)} krad</N>, computer survives <N>{num(b.radiation.toleranceKrad)} krad</N>
              </>
            }
            why={
              <Why
                title="Radiation"
                what="Radiation slowly damages electronics. This is the total dose over the mission against what your flight computer can absorb. A krad is a unit of absorbed dose."
                explain={explainFor(b, 'radiation.doseMarginPct').map((e) => e.text)}
                formula="margin = tolerance ÷ dose − 1     dose = rate × orbit factor × shielding factor × years"
                ruleMetric="radiation.doseMarginPct"
                sourceIds={dest.sources}
              />
            }
          >
            <MarginBar need={b.radiation.primaryDoseKrad} have={b.radiation.toleranceKrad} severity={sev.radiation} ariaLabel={`Dose ${num(b.radiation.primaryDoseKrad, 1)} krad of ${num(b.radiation.toleranceKrad)} krad tolerance`} />
          </GaugeRow>
        )}

        {show('reliability') && (
          <GaugeRow
            title="Reliability"
            severity={sev.reliability}
            headline={pct(b.risk.reliabilityPct)}
            headlineLabel="Chance of surviving the primary mission"
            summary={
              b.risk.topRisks[0] ? (
                <>
                  chance nothing fatal fails; biggest risk is the <span className="text-ink">{b.risk.topRisks[0].label.toLowerCase()}</span>
                </>
              ) : (
                'chance nothing fatal fails'
              )
            }
            why={
              <Why
                title="Reliability"
                what="The chance that the launch works and no critical part fails before the primary mission ends. A backup unit turns one failure into a non-event."
                explain={explainFor(b, 'risk.reliabilityPct').map((e) => e.text)}
                formula="P = rocket reliability × Π (1 − chance each critical part fails)"
                items={b.risk.topRisks.map((r) => ({ label: r.label, value: `${num(r.pFail * 100, 1)}% chance of failure` }))}
                ruleMetric="risk.reliabilityPct"
              />
            }
          >
            <PercentBar value={b.risk.reliabilityPct} severity={sev.reliability} ticks={relRule ? [relRule.red, relRule.yellow] : []} ariaLabel={`Reliability ${pct(b.risk.reliabilityPct)}`} />
          </GaugeRow>
        )}
      </ul>
    </div>
  );
}
