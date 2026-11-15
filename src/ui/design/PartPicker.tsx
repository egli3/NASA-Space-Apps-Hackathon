import type { ReactNode } from 'react';
import { catalog } from '../../data';
import { useGame, type DesignTab } from '../../store/game';
import type { CommsBand, Instrument, Part, RedundantSlotId, SlotId } from '../../types/catalog';
import type { Assurance, DsnAperture, MissionDesign } from '../../types/design';
import { Segmented, Slider } from '../common/Button';
import { gigabits, kg, km, money, num, pct, rate, wattHours, watts } from '../common/format';
import { MEASUREMENT_LABEL, SLOT_ORDER, TAB_HELP, TAB_LABEL, TRL_HELP } from '../common/labels';
import { Popover } from '../common/Popover';
import { SourceLinks } from '../common/SourceLink';

const TABS: DesignTab[] = ['instruments', ...SLOT_ORDER, 'orbit', 'operations'];
const REDUNDANT: RedundantSlotId[] = ['avionics', 'adcs', 'transmitter', 'battery'];
const isRedundantSlot = (s: string): s is RedundantSlotId => (REDUNDANT as string[]).includes(s);

function useScenario(design: MissionDesign) {
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId)!;
  const dest = catalog.destinations.find((d) => d.id === scenario.destinationId)!;
  const cls = catalog.missionClasses.find((c) => c.id === scenario.missionClassId)!;
  return { scenario, dest, cls };
}

/** One-line summary of the current choice, shown in the rail next to each tab. */
function tabSummary(tab: DesignTab, design: MissionDesign): string {
  if (tab === 'instruments') return `${design.instrumentIds.length} on board`;
  if (tab === 'orbit') {
    const { dest } = { dest: catalog.destinations.find((d) => d.orbits.some((o) => o.id === design.orbitId)) };
    return dest?.orbits.find((o) => o.id === design.orbitId)?.name ?? '';
  }
  if (tab === 'operations') return `${design.dsnHoursPerDay} h a day, ${pct(design.reservePct)} reserve`;
  const part = catalog.parts.find((p) => p.id === design.parts[tab]);
  if (!part) return 'none';
  const twice = isRedundantSlot(tab) && design.redundant.includes(tab) ? ' ×2' : '';
  if (tab === 'power' && part.specs.solarEfficiency) return `${part.name}, ${num(design.solarArrayAreaM2)} m²`;
  return part.name + twice;
}

export function SlotRail({ design }: { design: MissionDesign }) {
  const tab = useGame((s) => s.designTab);
  const setTab = useGame((s) => s.setDesignTab);
  return (
    <nav aria-label="Parts of the design" className="scroll-quiet h-full overflow-y-auto border-r border-line bg-panel/70">
      <ul role="tablist" aria-orientation="vertical">
        {TABS.map((t) => {
          const on = t === tab;
          return (
            <li key={t}>
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t)}
                className={`block w-full border-b border-line px-4 py-2 text-left transition-colors ${on ? 'bg-ink text-bg' : 'hover:bg-ink/8'} ${
                  t === 'instruments' || t === 'orbit' ? 'border-t border-t-rule first:border-t-0' : ''
                }`}
              >
                <span className="block leading-tight font-bold">{TAB_LABEL[t]}</span>
                <span className={`block truncate text-xs ${on ? 'text-bg/70' : 'text-dim'}`}>{tabSummary(t, design)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------------------------------------------------

function Stat({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <span className="whitespace-nowrap" title={help}>
      <span className="text-dim">{label} </span>
      <span className="num">{value}</span>
    </span>
  );
}

/** The slot-specific numbers worth showing on a card, in plain words. */
function specStats(p: Part): { label: string; value: string; help?: string }[] {
  const s = p.specs;
  const out: { label: string; value: string; help?: string }[] = [];
  if (s.solarEfficiency !== undefined) {
    out.push({ label: 'efficiency', value: pct(s.solarEfficiency * 100) });
    if (s.solarKgPerM2 !== undefined) out.push({ label: 'per m²', value: `${num(s.solarKgPerM2, 1)} kg, ${money(s.solarCostMPerM2 ?? 0)}` });
  }
  if (s.rtgBolW !== undefined) out.push({ label: 'makes', value: `${watts(s.rtgBolW)} anywhere`, help: 'A radioisotope generator turns the heat of decaying plutonium into electricity. It does not need sunlight.' });
  if (s.batteryWh !== undefined) out.push({ label: 'stores', value: wattHours(s.batteryWh) });
  if (s.ispS !== undefined)
    out.push({ label: 'Isp', value: `${num(s.ispS)} s`, help: 'Specific impulse: how much push you get from each kilogram of propellant. Higher is better.' });
  if (s.thrustN !== undefined) out.push({ label: 'thrust', value: `${num(s.thrustN, s.thrustN < 1 ? 2 : 0)} N` });
  if (s.diameterM !== undefined && s.diameterM > 0) out.push({ label: 'dish', value: `${num(s.diameterM, 1)} m` });
  if (s.bands) out.push({ label: 'bands', value: s.bands.join(' and ') });
  if (s.rfPowerW !== undefined) out.push({ label: 'radio output', value: watts(s.rfPowerW) });
  if (s.pointingDeg !== undefined) out.push({ label: 'aims within', value: `${s.pointingDeg}°` });
  if (s.radToleranceKrad !== undefined) out.push({ label: 'survives', value: `${num(s.radToleranceKrad)} krad`, help: 'Total radiation dose the electronics can absorb before failures ramp up.' });
  if (s.storageGb !== undefined) out.push({ label: 'records', value: gigabits(s.storageGb) });
  if (s.doseFactor !== undefined && s.doseFactor < 1) out.push({ label: 'cuts dose to', value: pct(s.doseFactor * 100) });
  if (s.heaterWPerAU) out.push({ label: 'heaters', value: `${num(s.heaterWPerAU)} W per AU from the Sun` });
  return out;
}

function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M2.5 7.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface CardProps {
  role: 'radio' | 'checkbox';
  selected: boolean;
  onClick: () => void;
  title: string;
  note?: string;
  blurb: string;
  stats: ReactNode;
  footer?: ReactNode;
}

/** A selectable card. Selected cards get a filled corner tab with a tick, not just a colour change. */
function ChoiceCard({ role, selected, onClick, title, note, blurb, stats, footer }: CardProps) {
  return (
    <div className={`relative flex flex-col border transition-colors ${selected ? 'border-ink bg-raised' : 'border-line bg-panel/70 hover:border-rule'}`}>
      <button type="button" role={role} aria-checked={selected} onClick={onClick} className="flex-1 px-4 pt-3 pb-3 text-left">
        <span className="flex items-start justify-between gap-3">
          <span className="text-[17px] leading-snug font-bold">{title}</span>
          <span className={`grid h-5 w-5 shrink-0 place-items-center border ${selected ? 'border-ink bg-ink text-bg' : 'border-rule text-transparent'} ${role === 'radio' ? 'rounded-full' : ''}`}>
            <Tick />
          </span>
        </span>
        {note && <span className="mt-0.5 block text-sm text-dim">{note}</span>}
        <span className="mt-1.5 block text-sm">{blurb}</span>
        <span className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">{stats}</span>
      </button>
      {footer && <div className="border-t border-line px-4 py-2 text-sm">{footer}</div>}
    </div>
  );
}

function Provenance({ sources, confidence, heritage }: Pick<Part, 'sources' | 'confidence'> & { heritage?: string }) {
  return (
    <Popover label="Where these numbers come from" trigger="Source" width={320}>
      {heritage && <p className="mb-2 text-sm">{heritage}</p>}
      <SourceLinks ids={sources} confidence={confidence} />
    </Popover>
  );
}

function PartCard({ part, selected, onSelect }: { part: Part; selected: boolean; onSelect: () => void }) {
  const solar = part.specs.solarEfficiency !== undefined;
  return (
    <ChoiceCard
      role="radio"
      selected={selected}
      onClick={onSelect}
      title={part.name}
      blurb={part.blurb}
      stats={
        <>
          <Stat label="mass" value={solar ? `${kg(part.massKg)} + panels` : kg(part.massKg)} />
          {part.powerW > 0 && <Stat label="draws" value={watts(part.powerW)} />}
          <Stat label="cost" value={solar ? `${money(part.costM)} + panels` : money(part.costM)} />
          <Stat label="TRL" value={String(part.trl)} help={TRL_HELP} />
          {specStats(part).map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </>
      }
      footer={<Provenance sources={part.sources} confidence={part.confidence} heritage={part.heritage} />}
    />
  );
}

function InstrumentCard({ ins, design, selected, onToggle }: { ins: Instrument; design: MissionDesign; selected: boolean; onToggle: () => void }) {
  const { scenario } = useScenario(design);
  const serves = scenario.objectives.filter((o) => o.measurements.some((m) => ins.measures.some((x) => x.type === m.type && x.quality >= m.minQuality)));
  return (
    <ChoiceCard
      role="checkbox"
      selected={selected}
      onClick={onToggle}
      title={ins.name}
      note={`Modelled on ${ins.heritage}`}
      blurb={ins.blurb}
      stats={
        <>
          <Stat label="mass" value={kg(ins.massKg)} />
          <Stat label="draws" value={watts(ins.powerW)} />
          <Stat label="cost" value={money(ins.costM)} />
          <Stat label="data" value={`${rate(ins.dataRateKbps)}, on ${pct(ins.dutyCycle * 100)} of the time`} />
          {ins.trl < 9 && <Stat label="TRL" value={String(ins.trl)} help={TRL_HELP} />}
        </>
      }
      footer={
        <div className="flex items-start justify-between gap-3">
          <span className={serves.length ? '' : 'text-dim'}>{serves.length ? `Serves: ${serves.map((o) => o.name).join('; ')}` : 'Serves no objective in this call'}</span>
          <Provenance sources={ins.sources} confidence={ins.confidence} />
        </div>
      }
    />
  );
}

function Field({ title, help, children }: { title: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="border border-line bg-panel/70 px-4 py-3.5">
      <h3 className="font-bold">{title}</h3>
      {help && <p className="mt-0.5 mb-3 text-sm text-dim">{help}</p>}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border border-line bg-panel/70 px-4 py-3.5">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border peer-focus-visible:outline-2 peer-focus-visible:outline-caution ${checked ? 'border-ink bg-ink text-bg' : 'border-rule text-transparent'}`}>
        <Tick />
      </span>
      <span>
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-dim">{help}</span>
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------------------------------------------------

export function OptionsPanel({ design }: { design: MissionDesign }) {
  const tab = useGame((s) => s.designTab);
  const update = useGame((s) => s.updateDesign);
  const { scenario, dest, cls } = useScenario(design);
  const K = catalog.constants;

  let body: ReactNode;

  if (tab === 'instruments') {
    const shelf = scenario.instrumentIds.map((id) => catalog.instruments.find((i) => i.id === id)).filter((i) => i !== undefined);
    const toggle = (id: string) =>
      update({ instrumentIds: design.instrumentIds.includes(id) ? design.instrumentIds.filter((x) => x !== id) : [...design.instrumentIds, id] });
    body = (
      <div className="grid gap-3 xl:grid-cols-2">
        {shelf.map((ins) => (
          <InstrumentCard key={ins.id} ins={ins} design={design} selected={design.instrumentIds.includes(ins.id)} onToggle={() => toggle(ins.id)} />
        ))}
      </div>
    );
  } else if (tab === 'orbit') {
    body = (
      <div className="grid gap-3 xl:grid-cols-2">
        {dest.orbits.map((o) => {
          const mods = Object.entries(o.scienceModifiers) as [keyof typeof MEASUREMENT_LABEL, number][];
          const wanted = new Set(scenario.objectives.flatMap((x) => x.measurements.map((m) => m.type)));
          const weak = mods.filter(([t, v]) => v <= 0.6 && wanted.has(t)).map(([t]) => MEASUREMENT_LABEL[t]);
          return (
            <ChoiceCard
              key={o.id}
              role="radio"
              selected={design.orbitId === o.id}
              onClick={() => update({ orbitId: o.id })}
              title={o.name}
              blurb={o.blurb}
              stats={
                <>
                  <Stat label="altitude" value={o.periapsisAltKm === o.apoapsisAltKm ? km(o.periapsisAltKm) : `${num(o.periapsisAltKm)} to ${km(o.apoapsisAltKm)}`} />
                  <Stat label="tilt" value={`${num(o.inclinationDeg)}°`} />
                  <Stat label="upkeep" value={`${num(o.maintenanceDvMsPerYear)} m/s a year`} />
                  {o.aerobraking && <Stat label="aerobraking" value={`${num(o.aerobraking.aerobrakingDays)} days before science starts`} />}
                </>
              }
              footer={
                <div className="flex items-start justify-between gap-3">
                  <span className={weak.length ? '' : 'text-dim'}>{weak.length ? `Weak for ${weak.join(', ')}` : 'No instrument is handicapped here'}</span>
                  <Provenance sources={o.sources} confidence={o.confidence} />
                </div>
              }
            />
          );
        })}
      </div>
    );
  } else if (tab === 'operations') {
    const reserveRule = catalog.reviewRules.find((r) => r.metric === 'cost.reservePct');
    const assuranceHelp = (a: Assurance) => {
      const x = K.assurance[a];
      return x ? `failure rates ×${x.hazardMultiplier}, development cost +${pct(x.costFraction * 100)}` : '';
    };
    body = (
      <div className="grid gap-3 xl:grid-cols-2">
        <Field title="Deep Space Network time" help="You rent time on NASA’s giant dishes on Earth. More hours bring more data home and cost more every year of the mission.">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented<DsnAperture>
              label="Dish size"
              value={design.dsnAperture}
              onChange={(dsnAperture) => update({ dsnAperture })}
              options={[
                { value: '34m', label: '34 m dish' },
                { value: '70m', label: '70 m dish' },
              ]}
            />
            <span className="text-sm text-dim">
              <span className="num text-ink">${num((K.dsnCostPerHourM[design.dsnAperture] ?? 0) * 1e6)}</span> an hour
            </span>
          </div>
          {design.commsBand === 'Ka' && design.dsnAperture === '70m' && <p className="mb-3 text-sm text-caution">The 70 m dishes cannot receive Ka-band, so this link performs like a 34 m dish.</p>}
          <Slider label="Hours a day" value={design.dsnHoursPerDay} min={1} max={24} onChange={(dsnHoursPerDay) => update({ dsnHoursPerDay })} display={`${design.dsnHoursPerDay} h`} />
        </Field>

        <Field title="Testing and assurance" help="How hard you test before launch. Thorough testing finds the failures on the ground, where they are cheap.">
          <Segmented<Assurance>
            label="Assurance level"
            value={design.assurance}
            onChange={(assurance) => update({ assurance })}
            options={[
              { value: 'lean', label: 'Lean' },
              { value: 'standard', label: 'Standard' },
              { value: 'rigorous', label: 'Rigorous' },
            ]}
          />
          <p className="mt-3 text-sm">
            <span className="capitalize">{design.assurance}</span>: {assuranceHelp(design.assurance)}.
          </p>
        </Field>

        <Field title="Budget reserves" help="Money held back for the surprises that always come. It pays for cost growth before launch and for trouble in flight.">
          <Slider
            label="Share of development cost"
            value={design.reservePct}
            min={0}
            max={60}
            onChange={(reservePct) => update({ reservePct })}
            display={pct(design.reservePct)}
            mark={reserveRule ? { value: reserveRule.yellow, label: `board wants ${pct(reserveRule.yellow)}` } : undefined}
          />
          <div className="h-4" />
        </Field>

        <Field title="Mission class" help={cls.blurb}>
          <p className="text-sm">
            {cls.name} class, cost cap <span className="num">{money(cls.costCapM)}</span>. Loosely modelled on {cls.inspiredBy}.
          </p>
        </Field>
      </div>
    );
  } else {
    const slot: SlotId = tab;
    const options = catalog.parts.filter((p) => p.slot === slot && (!p.classes || p.classes.includes(scenario.missionClassId)));
    const current = catalog.parts.find((p) => p.id === design.parts[slot]);
    const select = (p: Part) => {
      const patch: Partial<MissionDesign> = { parts: { ...design.parts, [slot]: p.id } };
      // An antenna that cannot do Ka-band drops the link back to X-band rather than leaving an impossible design.
      if (slot === 'antenna' && design.commsBand === 'Ka' && p.specs.bands && !p.specs.bands.includes('Ka')) patch.commsBand = 'X';
      update(patch);
    };
    const kaAllowed = current?.specs.bands?.includes('Ka') ?? false;
    body = (
      <>
        <div role="radiogroup" aria-label={TAB_LABEL[tab]} className="grid gap-3 xl:grid-cols-2">
          {options.map((p) => (
            <PartCard key={p.id} part={p} selected={design.parts[slot] === p.id} onSelect={() => select(p)} />
          ))}
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {slot === 'power' && current?.specs.solarEfficiency !== undefined && (
            <Field title="Solar array area" help="Power grows with area. So do mass and cost.">
              <Slider
                label="Area"
                value={design.solarArrayAreaM2}
                min={1}
                max={80}
                onChange={(solarArrayAreaM2) => update({ solarArrayAreaM2 })}
                display={`${num(design.solarArrayAreaM2)} m²`}
              />
            </Field>
          )}

          {slot === 'antenna' && (
            <Field title="Radio band" help="Ka-band squeezes about ten times more data through the same dish, but needs fine pointing and fades more in bad weather on Earth.">
              <Segmented<CommsBand>
                label="Radio band"
                value={design.commsBand}
                onChange={(commsBand) => update({ commsBand })}
                options={[
                  { value: 'X', label: 'X-band' },
                  { value: 'Ka', label: 'Ka-band', disabled: !kaAllowed, hint: kaAllowed ? undefined : 'This antenna cannot transmit Ka-band' },
                ]}
              />
              {!kaAllowed && <p className="mt-2 text-sm text-dim">This antenna cannot transmit Ka-band.</p>}
            </Field>
          )}

          {isRedundantSlot(slot) && (
            <Toggle
              checked={design.redundant.includes(slot)}
              onChange={(on) => update({ redundant: on ? [...design.redundant, slot] : design.redundant.filter((x) => x !== slot) })}
              label="Fly a second unit as a backup"
              help={`If one fails, the other takes over. Costs ${pct((K.redundancy.massMultiplier - 1) * 100)} more mass and ${pct((K.redundancy.costMultiplier - 1) * 100)} more money for this part.`}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <div role="tabpanel" aria-label={TAB_LABEL[tab]} className="scroll-quiet h-full overflow-y-auto px-5 py-4">
      <div className="mb-3 flex flex-col gap-x-4 gap-y-1 xl:flex-row xl:items-baseline">
        <h2 className="shrink-0 text-xl font-bold">{TAB_LABEL[tab]}</h2>
        <p className="text-sm text-dim">{TAB_HELP[tab]}</p>
      </div>
      {body}
    </div>
  );
}
