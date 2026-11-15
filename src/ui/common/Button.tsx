import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent font-bold hover:brightness-95 active:translate-y-px',
  secondary: 'border border-rule text-ink font-medium hover:bg-ink/8 active:translate-y-px',
  quiet: 'text-dim font-medium underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg';
  children: ReactNode;
}

/** Every screen has exactly one primary button; everything else is secondary or quiet. */
export function Button({ variant = 'secondary', size = 'md', className = '', children, ...rest }: Props) {
  const pad = variant === 'quiet' ? 'px-1 py-1' : size === 'lg' ? 'px-7 py-3.5 text-lg' : 'px-5 py-2.5';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xs transition-[filter,background-color,transform] disabled:cursor-not-allowed disabled:opacity-35 ${pad} ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string; disabled?: boolean }[];
  onChange: (value: T) => void;
}

/** A small set of mutually exclusive choices drawn as one divided box. */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xs border border-rule">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${i > 0 ? 'border-l border-rule' : ''} ${
              on ? 'bg-ink text-bg' : 'text-ink hover:bg-ink/8'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Formatted current value, shown at the right of the label. */
  display: string;
  /** Optional tick on the track (e.g. the review board's minimum). */
  mark?: { value: number; label: string };
}

export function Slider({ label, value, min, max, step = 1, onChange, display, mark }: SliderProps) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-4">
        <span className="font-medium">{label}</span>
        <span className="num text-lg">{display}</span>
      </span>
      <span className="relative block">
        <input
          type="range"
          className="slider"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ ['--fill' as string]: `${fill}%` }}
        />
        {mark && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-[3px] h-[18px] border-l border-dashed border-caution"
            style={{ left: `calc(${((mark.value - min) / (max - min)) * 100}% )` }}
          >
            <span className="absolute top-[18px] left-1 text-xs whitespace-nowrap text-caution">{mark.label}</span>
          </span>
        )}
      </span>
    </label>
  );
}
