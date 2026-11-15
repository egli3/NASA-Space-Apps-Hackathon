import { catalog } from '../../data';
import type { Confidence } from '../../types/catalog';

const CONFIDENCE_NOTE: Record<Confidence, string> = {
  verified: 'Copied from the cited source',
  approx: 'Engineering estimate, pending a check against the source',
  game: 'Tuned for play, not a real-world value',
};

/** "Where does this number come from?" One link per source id, NASA sources first. Opens in a new tab. */
export function SourceLinks({ ids, confidence }: { ids: string[]; confidence?: Confidence }) {
  const sources = [...new Set(ids)]
    .map((id) => catalog.sources.find((s) => s.id === id))
    .filter((s) => s !== undefined)
    .sort((a, b) => Number(b.isNasa) - Number(a.isNasa));
  if (sources.length === 0 && !confidence) return null;
  return (
    <div className="text-sm">
      {sources.length > 0 && (
        <ul className="space-y-1">
          {sources.map((s) => (
            <li key={s.id} className="flex gap-2">
              <InfoGlyph />
              {s.url.includes('github.com') || !s.isNasa ? (
                <span className="text-dim">{s.title}</span>
              ) : (
                <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-rule underline-offset-2 hover:decoration-ink">
                  {s.org}: {shortTitle(s.title)}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {confidence && <p className="mt-1.5 text-dim">{CONFIDENCE_NOTE[confidence]}.</p>}
    </div>
  );
}

/** Source titles in the data often start with the org name; don't say it twice. */
function shortTitle(title: string) {
  const cut = title.split(' — ');
  return cut.length > 1 ? cut.slice(1).join(' — ') : title;
}

function InfoGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" className="mt-[3px] shrink-0 text-dim" aria-hidden>
      <circle cx="7" cy="7" r="5.6" />
      <path d="M7 6.3v3.5M7 4.2v.2" strokeLinecap="round" />
    </svg>
  );
}
