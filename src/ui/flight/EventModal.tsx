import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { EventCard } from '../../types/catalog';
import type { LogEntry, PendingEvent } from '../../types/engine';
import { Button } from '../common/Button';
import { num, pct } from '../common/format';
import { SourceLinks } from '../common/SourceLink';

function Overlay({ children, label, focusButton = false }: { children: ReactNode; label: string; focusButton?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A decision card takes focus on the panel, not on an option: the player may be mid-keypress on Space
    // (pause) when it appears, and that must never pick an option for them.
    (focusButton ? ref.current?.querySelector<HTMLElement>('button') : ref.current)?.focus();
  }, [focusButton]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <motion.div ref={ref} tabIndex={-1} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto border border-caution sm:max-h-[calc(100dvh-3rem)] bg-panel shadow-[0_24px_80px_rgb(0_0_0/0.6)] outline-none">
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Time stops. The flight team has a decision to make. */
export function EventModal({ pending, date, onDecide }: { pending: PendingEvent; date: string; onDecide: (optionId: string) => void }) {
  const { card } = pending;
  return (
    <Overlay label={card.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-caution bg-caution px-4 py-2.5 sm:px-6 text-on-accent">
        <span className="font-bold">Decision needed</span>
        <span className="num text-sm">
          {date}, mission day {num(pending.day)}
        </span>
      </div>
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <h2 className="text-2xl font-bold sm:text-3xl">{card.title}</h2>
        <p className="mt-3 max-w-[64ch] text-base sm:text-lg">{card.narrative}</p>
        {pending.context.length > 0 && (
          <ul className="num mt-4 space-y-1 border-l-2 border-caution pl-4 text-sm text-caution">
            {pending.context.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-3">
          {card.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onDecide(o.id)}
              className="group flex flex-col border border-rule bg-raised p-3 text-left sm:p-4 transition-colors hover:border-caution"
            >
              <span className="text-lg font-bold group-hover:text-caution sm:text-xl">{o.label}</span>
              <span className="mt-1.5 flex-1 text-dim">{o.description}</span>
              {o.successProbability !== undefined && (
                <span className="mt-3 text-sm">
                  A gamble: works about <span className="num text-caution">{pct(o.successProbability * 100)}</span> of the time.
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

/** After the decision: what happened to you, then what happened to the real mission this card is drawn from. */
export function RealStoryCard({ card, optionId, outcome, onResume }: { card: EventCard; optionId: string; outcome: LogEntry[]; onResume: () => void }) {
  const option = card.options.find((o) => o.id === optionId);
  const results = outcome.filter((l) => l.kind !== 'decision');
  return (
    <Overlay label="What really happened" focusButton>
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <p className="text-dim">
          You chose to <span className="font-bold text-ink">{option?.label.toLowerCase() ?? optionId}</span>.
        </p>
        {results.length > 0 && (
          <ul className="mt-3 space-y-1">
            {results.map((l, i) => (
              <li key={i} className={l.kind === 'anomaly' ? 'text-nogo' : 'text-ink'}>
                {l.text}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 border-t border-line pt-5">
          <h2 className="text-2xl font-bold">What really happened</h2>
          <p className="mt-1 text-caution">
            {card.realStory.mission}, <span className="num">{card.realStory.year}</span>
          </p>
          <p className="mt-3 max-w-[64ch] text-base sm:text-lg">{card.realStory.summary}</p>
          <p className="mt-3 max-w-[64ch] border-l-2 border-go pl-4 text-lg">{card.realStory.lesson}</p>
          <div className="mt-4">
            <SourceLinks ids={card.sources} />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onResume}>
            Resume the mission
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
