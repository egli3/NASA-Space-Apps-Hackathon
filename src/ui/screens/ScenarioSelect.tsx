import { catalog } from '../../data';
import { useGame } from '../../store/game';
import { Button } from '../common/Button';
import { au, km, money, years } from '../common/format';
import { PlanetGlyph } from '../common/PlanetGlyph';
import { Wordmark } from '../common/Sheet';

const DIFFICULTY = ['', 'Gentle', 'Demanding', 'Brutal'];

export function ScenarioSelect() {
  const start = useGame((s) => s.startScenario);
  const go = useGame((s) => s.go);
  const scenarios = [...catalog.scenarios].sort((a, b) => a.priority.localeCompare(b.priority) || a.difficulty - b.difficulty);

  return (
    <div className="sheet-grid scroll-quiet h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => go('title')} title="Back to the title screen">
            <Wordmark />
          </button>
          <Button variant="quiet" onClick={() => go('title')}>
            Back
          </Button>
        </div>
        <h1 className="mt-10 text-3xl sm:text-5xl font-bold">Choose a science call</h1>
        <p className="mt-3 max-w-2xl text-lg text-dim">
          Each call is a question about another world, a cost cap, and a launch window that will not wait. Pick the one you want to answer.
        </p>

        <ul className="mt-10 grid gap-6 lg:grid-cols-3">
          {scenarios.map((s) => {
            const dest = catalog.destinations.find((d) => d.id === s.destinationId)!;
            const cls = catalog.missionClasses.find((c) => c.id === s.missionClassId)!;
            return (
              <li key={s.id} className="flex">
                <button
                  type="button"
                  onClick={() => start(s.id)}
                  className="group flex w-full flex-col border border-rule bg-panel/80 text-left transition-colors hover:border-ink hover:bg-raised"
                >
                  <div className="relative flex items-center gap-3 border-b border-line px-4 py-4 sm:gap-5 sm:px-6 sm:py-6">
                    <div className="transition-transform duration-500 group-hover:rotate-6">
                      <div className="w-24 sm:w-[132px]"><PlanetGlyph id={dest.id} size={132} /></div>
                    </div>
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-dim">Destination</dt>
                        <dd className="text-lg font-bold">{dest.name}</dd>
                      </div>
                      <div>
                        <dt className="text-dim">Diameter</dt>
                        <dd className="num">{km(dest.radiusKm * 2)}</dd>
                      </div>
                      <div>
                        <dt className="text-dim">{dest.kind === 'moon' ? 'From Earth' : 'From the Sun'}</dt>
                        <dd className="num">{dest.kind === 'moon' ? km(dest.earthDistanceAU.mean * catalog.constants.auKm) : au(dest.solarDistanceAU)}</dd>
                      </div>
                    </dl>
                    {s.priority === 'P1' && <span className="absolute top-0 right-0 bg-caution px-2.5 py-1 text-sm font-bold text-[#0b2a4a]">Tutorial</span>}
                  </div>
                  <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5">
                    <h2 className="text-2xl font-bold">{s.title}</h2>
                    <p className="mt-2 flex-1 text-dim">{s.tagline}</p>
                    <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
                      <div>
                        <dt className="text-dim">Cost cap</dt>
                        <dd className="num text-lg">{money(cls.costCapM)}</dd>
                      </div>
                      <div>
                        <dt className="text-dim">Science</dt>
                        <dd className="num text-lg">{years(s.primaryMissionYears)}</dd>
                      </div>
                      <div>
                        <dt className="text-dim">Difficulty</dt>
                        <dd className="flex items-center gap-2 text-lg">
                          <span className="flex gap-1" role="img" aria-label={`${s.difficulty} of 3`}>
                            {[1, 2, 3].map((n) => (
                              <span key={n} className={`h-3 w-3 border border-ink ${n <= s.difficulty ? 'bg-ink' : ''}`} />
                            ))}
                          </span>
                          <span className="text-sm">{DIFFICULTY[s.difficulty]}</span>
                        </dd>
                      </div>
                    </dl>
                    <span className="mt-5 inline-flex self-start border border-rule px-4 py-2 font-medium transition-colors group-hover:bg-accent group-hover:text-on-accent">
                      Lead this mission
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
