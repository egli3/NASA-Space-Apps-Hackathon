import { num } from './format';

/** "between 59% and 61%", or "at about 14%" when both ends round to the same number. */
export function PctRange({ lo, hi }: { lo: number; hi: number }) {
  if (num(lo) === num(hi)) {
    return (
      <>
        at about <span className="num text-ink">{num(lo)}%</span>
      </>
    );
  }
  return (
    <>
      between <span className="num text-ink">{num(lo)}%</span> and <span className="num text-ink">{num(hi)}%</span>
    </>
  );
}
