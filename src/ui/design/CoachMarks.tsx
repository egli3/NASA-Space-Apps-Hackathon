import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../common/Button';

const KEY = 'margin.coach.design.v1';

/** localStorage can throw (private windows, blocked storage); the tips must work without it. */
function seen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'done';
  } catch {
    return false;
  }
}
function remember() {
  try {
    window.localStorage.setItem(KEY, 'done');
  } catch {
    /* tips simply show again next time */
  }
}

const TIPS: { target: string; title: string; body: string }[] = [
  {
    target: 'schematic',
    title: 'This is your spacecraft',
    body: 'It redraws itself as you change the design. A first draft is already on the sheet, and it has problems.',
  },
  {
    target: 'parts',
    title: 'Start with the instruments',
    body: 'Each one serves a science objective. Each one also adds mass, draws power, costs money and makes data you must send home. Then work down the list.',
  },
  {
    target: 'budgets',
    title: 'These are your margins',
    body: 'The solid bar is what you use. The hatching is what you have left. Keep them green, and ask “Why?” on any number to see the formula and its NASA source.',
  },
  {
    target: 'next',
    title: 'Then pick a rocket',
    body: 'Nothing is final yet. A review board checks the design before anything gets built, and it will tell you exactly what to fix.',
  },
];

/** First-visit tips for the Design Studio: four call-outs, each boxing the part of the sheet it talks about. */
export function CoachMarks() {
  const [step, setStep] = useState(() => (seen() ? -1 : 0));
  const [box, setBox] = useState<DOMRect | null>(null);
  const tip = step >= 0 ? TIPS[step] : undefined;

  const measure = useCallback(() => {
    if (!tip) return;
    setBox(document.querySelector(`[data-coach="${tip.target}"]`)?.getBoundingClientRect() ?? null);
  }, [tip]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    if (!tip) return;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tip, measure]);

  const close = useCallback(() => {
    remember();
    setStep(-1);
  }, []);

  useEffect(() => {
    if (!tip) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tip, close]);

  if (!tip || !box) return null;

  const last = step === TIPS.length - 1;
  const width = 340;
  // Sit next to the boxed region, never on top of it: under the schematic, beside the parts list and the budgets, above the action bar.
  const clampLeft = (x: number) => Math.min(window.innerWidth - width - 12, Math.max(12, x));
  const place: Record<string, CSSProperties> = {
    schematic: { left: clampLeft(box.left + 16), top: box.bottom + 14 },
    parts: { left: clampLeft(box.right + 16), top: box.top + 16 },
    budgets: { left: clampLeft(box.left - width - 16), top: box.top + 16 },
    next: { left: clampLeft(box.right - width - 16), bottom: window.innerHeight - box.top + 14 },
  };

  return createPortal(
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed z-40 border-2 border-caution shadow-[0_0_0_9999px_rgb(4_18_34/0.55)]"
        style={{ left: box.left + 3, top: box.top + 3, width: box.width - 6, height: box.height - 6 }}
      />
      <div role="dialog" aria-label={`Tip ${step + 1} of ${TIPS.length}: ${tip.title}`} className="fixed z-50 border border-caution bg-panel p-5 shadow-[0_12px_40px_rgb(0_0_0/0.5)] " style={{ width, ...place[tip.target] }}>
        <p className="num text-sm text-caution">
          {step + 1} of {TIPS.length}
        </p>
        <h2 className="mt-1 text-xl font-bold">{tip.title}</h2>
        <p className="mt-2">{tip.body}</p>
        <div className="mt-4 flex items-center justify-between">
          {last ? <span /> : (
            <Button variant="quiet" onClick={close}>
              Skip the tips
            </Button>
          )}
          <Button variant="primary" className="!px-4 !py-2" onClick={() => (last ? close() : setStep(step + 1))} autoFocus>
            {last ? 'Start designing' : 'Next'}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
