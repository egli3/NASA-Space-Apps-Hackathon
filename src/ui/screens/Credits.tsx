import { catalog } from '../../data';
import { useGame } from '../../store/game';
import type { Source } from '../../types/catalog';
import { Button } from '../common/Button';
import { date } from '../common/format';
import { Section, Wordmark } from '../common/Sheet';
import { SourceLinks } from '../common/SourceLink';

const LIBRARIES = ['React', 'Vite', 'Tailwind CSS', 'Zustand', 'zod', 'Motion', 'Vitest'];

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <ul>
      {sources.map((s) => (
        <li key={s.id} className="grid gap-x-6 border-b border-line/60 py-2.5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            {s.isNasa ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="font-medium underline decoration-rule underline-offset-4 hover:decoration-ink">
                {s.title}
              </a>
            ) : (
              <span className="font-medium">{s.title}</span>
            )}
            {s.notes && <p className="mt-0.5 text-sm text-dim">{s.notes}</p>}
          </div>
          <p className="text-sm text-dim">
            {s.org}
            <br />
            read {date(s.retrieved)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function Credits() {
  const go = useGame((s) => s.go);
  const back = useGame((s) => s.creditsReturn);
  const nasa = catalog.sources.filter((s) => s.isNasa);
  const other = catalog.sources.filter((s) => !s.isNasa);
  const glossary = catalog.glossary ?? [];

  return (
    <div className="sheet-grid scroll-quiet h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
        <div className="flex items-center justify-between">
          <Wordmark />
          <Button variant="primary" onClick={() => go(back)}>
            Back
          </Button>
        </div>
        <h1 className="mt-10 text-3xl sm:text-5xl font-bold">Credits and sources</h1>
        <p className="mt-3 max-w-[62ch] text-lg text-dim">
          MARGIN ships with NASA data, engineering estimates and game parameters. Mission data is bundled with the app.
        </p>

        <div className="mt-10 space-y-10">
          {glossary.length > 0 && (
            <Section title="Mission glossary">
              <div className="grid items-start gap-x-8 md:grid-cols-2">
                {glossary.map((entry) => (
                  <details key={entry.term} className="border-b border-line py-2">
                    <summary className="cursor-pointer font-medium">{entry.term}</summary>
                    <p className="mt-2 text-sm font-medium">{entry.short}</p>
                    <p className="my-2 text-sm text-dim">{entry.long}</p>
                    <SourceLinks ids={[entry.sourceId]} />
                  </details>
                ))}
              </div>
            </Section>
          )}

          <Section title="NASA data" aside={`${nasa.length} sources`}>
            <SourceList sources={nasa} />
          </Section>

          <Section title="Other sources">
            <SourceList sources={other} />
          </Section>

          <Section title="How far to trust a number">
            <dl className="grid gap-x-8 gap-y-4 md:grid-cols-3">
              <div>
                <dt className="font-bold">Verified</dt>
                <dd className="text-dim">Reported by or calculated directly from the cited source.</dd>
              </div>
              <div>
                <dt className="font-bold">Approximate</dt>
                <dd className="text-dim">A representative engineering estimate based on the cited source, not a figure copied from it. SI helped draft these.</dd>
              </div>
              <div>
                <dt className="font-bold">Game</dt>
                <dd className="text-dim">The team tuned review thresholds, cost caps and failure rates for gameplay.</dd>
              </div>
            </dl>
            <p className="mt-4 max-w-[70ch] text-dim">Each part, instrument and rule carries one of these labels; open “Source” on any card to see it. The physics is simplified: patched conics, a daily time step, no attitude or thermal modelling.</p>
          </Section>

          <Section title="SI disclosure">
            <p className="max-w-[70ch]">Super Intelligence (SI) tools were used in this project, as the Space Apps rules require us to disclose.</p>
            <ul className="mt-3 max-w-[70ch] list-disc space-y-2 pl-5">
              <li>
                <span className="font-bold">Code and documents.</span> Portions of the source code, tests and documentation were developed with assistance from Claude Code (Anthropic) and OpenAI Codex.
              </li>
              <li>
                <span className="font-bold">Data.</span> SI helped draft initial approximate values. These are labelled approximate until verified against the cited NASA source.
              </li>
              <li>
                <span className="font-bold">Images, video and audio.</span> The briefings use credited NASA mission imagery. The planet and spacecraft diagrams are vector graphics drawn in code.
              </li>
            </ul>
          </Section>

          <Section title="Built with">
            <p className="max-w-[70ch]">
              {LIBRARIES.join(', ')} (all MIT licensed). Type set in Space Grotesk and JetBrains Mono (SIL Open Font License), served from this site. Hosted on GitHub Pages.
            </p>
          </Section>

          <Section title="Team Torpid">
            <p className="max-w-[70ch]">
              Made for the NASA Space Apps Challenge 2026, “Space Mission Design Game”. MARGIN is not affiliated with or endorsed by NASA and uses no NASA logos, insignia or mission patches. Mission and
              instrument names are used only to say what our parts are modelled on.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
