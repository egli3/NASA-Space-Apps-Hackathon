import { catalog } from '../../data';
import { useGame } from '../../store/game';
import { date, duration, money, years } from '../common/format';
import { MEASUREMENT_LABEL } from '../common/labels';
import { PlanetGlyph } from '../common/PlanetGlyph';
import { ActionBar, Section, Sheet } from '../common/Sheet';

export function Briefing() {
  const design = useGame((s) => s.design)!;
  const update = useGame((s) => s.updateDesign);
  const go = useGame((s) => s.go);
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId)!;
  const dest = catalog.destinations.find((d) => d.id === scenario.destinationId)!;
  const cls = catalog.missionClasses.find((c) => c.id === scenario.missionClassId)!;
  const rival = catalog.history.find((h) => h.id === scenario.historicalMissionId);
  const windows = scenario.trajectoryIds.map((id) => catalog.trajectories.find((t) => t.id === id)!);
  const maxWeight = Math.max(...scenario.objectives.map((o) => o.weight));

  return (
    <Sheet
      actions={
        <ActionBar
          back={{ label: 'Other science calls', onClick: () => go('scenario') }}
          primary={{ label: 'Open the design studio', onClick: () => go('design'), disabled: design.missionName.trim() === '' }}
          note={design.missionName.trim() === '' ? 'Give the mission a name first.' : undefined}
        />
      }
    >
      <div className="scroll-quiet h-full overflow-y-auto">
        <div className="mx-auto grid max-w-7xl gap-x-14 gap-y-10 px-4 py-6 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:px-12">
          <div>
            <div className="flex items-start gap-3 sm:gap-6">
              <div className="w-16 shrink-0 sm:w-28"><PlanetGlyph id={dest.id} size={112} /></div>
              <div>
                <p className="text-dim">Announcement of opportunity, {cls.name.toLowerCase()} class</p>
                <h1 className="mt-1 text-3xl sm:text-5xl leading-tight font-bold">{scenario.title}</h1>
              </div>
            </div>
            <p className="mt-6 text-2xl font-medium">{scenario.tagline}</p>
            <p className="mt-4 max-w-[62ch] text-lg text-dim">{scenario.briefing}</p>

            {scenario.imageUrl && (
              <figure className="mt-6 max-w-xl">
                <img
                  src={`${import.meta.env.BASE_URL}${scenario.imageUrl}`}
                  alt={`NASA mission imagery of ${dest.name}`}
                  width={900}
                  height={510}
                  decoding="async"
                  className="aspect-[30/17] h-auto w-full border border-rule bg-black object-cover"
                />
                <figcaption className="mt-1 text-sm text-dim">
                  <a href={`${import.meta.env.BASE_URL}img/credits.json`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    NASA image credits
                  </a>
                </figcaption>
              </figure>
            )}

            <label className="mt-8 block max-w-md">
              <span className="font-medium">Name your mission</span>
              <input
                type="text"
                value={design.missionName}
                maxLength={32}
                onChange={(e) => update({ missionName: e.target.value })}
                className="mt-2 w-full border border-rule bg-panel px-4 py-3 text-xl font-bold placeholder:font-normal placeholder:text-dim"
                placeholder="For example: Aquifer"
                spellCheck={false}
              />
            </label>

            <dl className="mt-8 grid max-w-xl grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-6">
              <div>
                <dt className="text-dim">Cost cap, launch and operations included</dt>
                <dd className="num mt-1 text-3xl">{money(cls.costCapM)}</dd>
              </div>
              <div>
                <dt className="text-dim">Primary science mission</dt>
                <dd className="num mt-1 text-3xl">{years(scenario.primaryMissionYears)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-dim">Launch windows</dt>
                <dd className="mt-1 space-y-1">
                  {windows.map((t) => (
                    <div key={t.id} className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1">
                      <span>{t.name}</span>
                      <span className="num shrink-0 text-dim">
                        {date(t.launchDate)}, {duration(t.tofDays)} in transit
                      </span>
                    </div>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-10">
            <Section title="What the science team wants" aside="share of the mission’s science value">
              <ul className="space-y-4">
                {scenario.objectives.map((o) => (
                  <li key={o.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-3 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-4">
                    <div className="num pt-0.5 text-right text-2xl">{o.weight}%</div>
                    <div>
                      <div className="h-2.5 border border-rule">
                        <div className="h-full bg-ink" style={{ width: `${(o.weight / maxWeight) * 100}%` }} />
                      </div>
                      <h3 className="mt-2 font-bold">{o.name}</h3>
                      <p className="text-dim">{o.blurb}</p>
                      <p className="mt-1 text-sm text-dim">
                        Needs {o.measurements.map((m) => MEASUREMENT_LABEL[m.type]).join(o.combine === 'all' ? ' and ' : ' or ')}.
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            {rival && (
              <Section title="The mission you will be measured against">
                <p className="text-xl font-bold">
                  {rival.name}, <span className="num font-medium">{rival.launchYear}</span>
                </p>
                <p className="mt-2 max-w-[62ch] text-dim">{rival.summary}</p>
                <p className="mt-2 max-w-[62ch] text-dim">At the debrief your spacecraft is set beside this one, for scale.</p>
              </Section>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
