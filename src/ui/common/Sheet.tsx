import type { ReactNode } from 'react';
import { useGame, type Screen } from '../../store/game';
import { Button } from './Button';

/** The mission is a set of seven sheets, drawn in order. The numbering is real: each sheet gates the next. */
const SHEETS: { screen: Screen; name: string }[] = [
  { screen: 'briefing', name: 'Briefing' },
  { screen: 'design', name: 'Design studio' },
  { screen: 'launch', name: 'Launch' },
  { screen: 'review', name: 'Review board' },
  { screen: 'growth', name: 'Reality check' },
  { screen: 'flight', name: 'Flight' },
  { screen: 'debrief', name: 'Debrief' },
];

/** Sheets the player may flip back to: only the planning ones, and only until the hardware is built. */
const REVISITABLE: Screen[] = ['briefing', 'design', 'launch', 'review'];

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-bold tracking-[0.28em] ${className}`}>MARGIN</span>;
}

/** Title block across the top of every in-mission sheet: wordmark, mission name, and where you are in the set. */
export function SheetHeader() {
  const screen = useGame((s) => s.screen);
  const design = useGame((s) => s.design);
  const go = useGame((s) => s.go);
  const index = SHEETS.findIndex((s) => s.screen === screen);
  const canRevisit = REVISITABLE.includes(screen);

  return (
    <header className="flex h-12 shrink-0 items-stretch border-b border-line bg-panel text-sm">
      <button type="button" onClick={() => go('title')} className="flex items-center border-r border-line px-5 hover:bg-ink/8" title="Back to the title screen">
        <Wordmark />
      </button>
      <div className="flex min-w-0 items-center border-r border-line px-5">
        <span className="truncate font-medium">{design?.missionName || 'Unnamed mission'}</span>
      </div>
      <nav aria-label="Mission sheets" className="ml-auto flex items-stretch">
        <ol className="flex items-stretch">
          {SHEETS.map((s, i) => {
            const current = i === index;
            const done = i < index;
            const clickable = done && canRevisit && REVISITABLE.includes(s.screen);
            const body = (
              <>
                <span className={`num grid h-5 w-5 place-items-center text-xs ${current ? 'bg-ink text-bg' : done ? 'border border-rule text-ink' : 'border border-line text-dim'}`}>
                  {i + 1}
                </span>
                <span className={`${current ? 'font-medium text-ink' : 'text-dim'} ${current ? '' : 'hidden xl:inline'}`}>{s.name}</span>
              </>
            );
            return (
              <li key={s.screen} aria-current={current ? 'step' : undefined} className="flex border-l border-line">
                {clickable ? (
                  <button type="button" onClick={() => go(s.screen)} className="flex items-center gap-2 px-3 hover:bg-ink/8" title={`Back to ${s.name}`}>
                    {body}
                  </button>
                ) : (
                  <span className="flex items-center gap-2 px-3">{body}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
}

interface ActionBarProps {
  back?: { label: string; onClick: () => void };
  primary: { label: string; onClick: () => void; disabled?: boolean };
  /** Why the primary button is disabled, or a one-line status. */
  note?: ReactNode;
}

/** Bottom strip of a sheet: where you came from on the left, the single next step on the right. */
export function ActionBar({ back, primary, note }: ActionBarProps) {
  return (
    <footer data-coach="next" className="flex h-16 shrink-0 items-center gap-4 border-t border-line bg-panel px-5">
      {back && (
        <Button variant="secondary" onClick={back.onClick}>
          {back.label}
        </Button>
      )}
      <div className="ml-auto min-w-0 text-right text-sm text-dim">{note}</div>
      <Button variant="primary" onClick={primary.onClick} disabled={primary.disabled}>
        {primary.label}
      </Button>
    </footer>
  );
}

/** Standard in-mission frame: header, scrolling body, action bar. */
export function Sheet({ children, actions, grid = true }: { children: ReactNode; actions?: ReactNode; grid?: boolean }) {
  return (
    <div className={`flex h-full flex-col ${grid ? 'sheet-grid' : ''}`}>
      <SheetHeader />
      <main className="min-h-0 flex-1">{children}</main>
      {actions}
    </div>
  );
}

/** A titled region of a sheet. The heading is a real heading; no decorative eyebrow. */
export function Section({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {aside && <div className="text-sm text-dim">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
