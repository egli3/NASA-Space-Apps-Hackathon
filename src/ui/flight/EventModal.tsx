import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { EventCard } from '../../types/catalog';
import type { LogEntry, PendingEvent } from '../../types/engine';
import { Button } from '../common/Button';
import { num, pct } from '../common/format';
import { SourceLinks } from '../common/SourceLink';

function Overlay({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/70 p-6" role="dialog" aria-modal="true" aria-label={label}>
      <motion.div ref={ref} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }} className="w-full max-w-3xl border border-caution bg-panel shadow-[0_24px_80px_rgb(0_0_0/0.6)]">
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
      <div className="flex items-baseline justify-between gap-4 border-b border-caution bg-caution px-6 py-2.5 text-on-accent">
        <span className="font-bold">Decision needed</span>
        <span className="num text-sm">
          {date}, mission day {num(pending.day)}
        </span>
      </div>
      <div className="px-6 py-5">
        <h2 className="text-3xl font-bold">{card.title}</h2>
        <p className="mt-3 max-w-[64ch] text-lg">{card.narrative}</p>
        {pending.context.length > 0 && (
          <ul className="num mt-4 space-y-1 border-l-2 border-caution pl-4 text-sm text-caution">
            {pending.context.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {card.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onDecide(o.id)}
              className="group flex flex-col border border-rule bg-raised p-4 text-left transition-colors hover:border-caution"
            >
              <span className="text-xl font-bold group-hover:text-caution">{o.label}</span>
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
    <Overlay label="What really happened">
      <div className="px-6 py-5">
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
          <p className="mt-3 max-w-[64ch] text-lg">{card.realStory.summary}</p>
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
