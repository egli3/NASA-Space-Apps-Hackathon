import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** Text of the trigger (also its accessible name). */
  label: string;
  /** Optional custom trigger content; defaults to the label as a dotted-underlined word. */
  trigger?: ReactNode;
  triggerClassName?: string;
  width?: number;
  children: ReactNode;
}

/**
 * A small note pinned to a trigger. Opens on click (and on hover for mouse users), closes on Escape or an outside click.
 * Rendered in a portal with fixed positioning so scrolling side panels never clip it.
 */
export function Popover({ label, trigger, triggerClassName, width = 340, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const id = useId();

  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    const p = panel.current?.getBoundingClientRect();
    if (!b || !p) return;
    const pad = 12;
    let left = b.right - p.width;
    left = Math.max(pad, Math.min(left, window.innerWidth - p.width - pad));
    let top = b.bottom + 8;
    if (top + p.height > window.innerHeight - pad) top = Math.max(pad, b.top - p.height - 8);
    setPos({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const hover = (on: boolean) => {
    window.clearTimeout(hoverTimer.current);
    if (pinned) return;
    hoverTimer.current = window.setTimeout(() => setOpen(on), on ? 180 : 220);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={trigger ? label : undefined}
        onClick={() => {
          window.clearTimeout(hoverTimer.current);
          if (open && pinned) {
            setOpen(false);
            setPinned(false);
          } else {
            setOpen(true);
            setPinned(true);
          }
        }}
        onPointerEnter={(e) => e.pointerType === 'mouse' && hover(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && hover(false)}
        className={triggerClassName ?? 'cursor-help text-dim underline decoration-dotted underline-offset-4 hover:text-ink'}
      >
        {trigger ?? label}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            onPointerEnter={(e) => e.pointerType === 'mouse' && hover(true)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && hover(false)}
            className="scroll-quiet fixed z-50 max-h-[80vh] overflow-y-auto rounded-xs border border-rule bg-panel p-4 text-ink shadow-[0_12px_40px_rgb(0_0_0/0.45)]"
            style={{ width, left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Inline definition for a piece of jargon. */
export function Term({ word, children }: { word: string; children: ReactNode }) {
  return (
    <Popover label={word} width={280}>
      <p className="text-sm">{children}</p>
    </Popover>
  );
}
