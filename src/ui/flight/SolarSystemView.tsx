import type { SimState, Vec2 } from '../../types/engine';

interface Props {
  state: SimState;
  /** The cruise path from Earth to the destination. */
  trail: Vec2[];
  /** The most recent positions, drawn brighter. */
  tail: Vec2[];
  destName: string;
  destAU: number;
  /** The Moon rides on top of Earth at this scale, so the map says so instead of drawing a second dot. */
  targetIsMoon: boolean;
  linkUp: boolean;
}

const R = 250; // px radius available around the Sun

/**
 * Top-down map of the mission. Inner-system missions use a linear scale; anything past 3 AU switches to the
 * log-ish scale from the track brief (r_px ∝ log2(1 + r/0.3)) so Earth and Jupiter both fit.
 */
export function SolarSystemView({ state, trail, tail, destName, destAU, targetIsMoon, linkUp }: Props) {
  const far = destAU > 3;
  const outer = Math.max(1.15, destAU * 1.1);
  const radial = (au: number) => (far ? (Math.log2(1 + au / 0.3) / Math.log2(1 + outer / 0.3)) * R : (au / outer) * R);
  const map = (p: Vec2) => {
    const r = Math.hypot(p.x, p.y);
    if (r < 1e-9) return { x: 0, y: 0 };
    const k = radial(r) / r;
    return { x: p.x * k, y: -p.y * k };
  };

  const earth = map(state.earth);
  const target = map(state.target);
  const craft = map(state.spacecraft);
  const rings = far ? [0.5, 2, 5] : outer > 1.3 ? [0.5, 1, 1.5] : [0.5, 1];
  const path = (pts: Vec2[]) => pts.map((p) => map(p)).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const atTarget = Math.hypot(craft.x - target.x, craft.y - target.y) < 6 && !targetIsMoon;
  const labelSide = (p: { x: number }) => (p.x > 150 ? { dx: -10, anchor: 'end' as const } : { dx: 10, anchor: 'start' as const });

  return (
    <svg viewBox="-300 -300 600 600" className="h-full w-full" role="img" aria-label={`Map of the inner solar system: spacecraft ${state.sunDistanceAU.toFixed(2)} AU from the Sun, ${state.earthDistanceAU.toFixed(2)} AU from Earth`}>
      {/* range rings */}
      <g fill="none" stroke="currentColor" className="text-rule" strokeWidth="1">
        {rings.map((au) => (
          <circle key={au} r={radial(au)} strokeDasharray="1 5" opacity="0.7" />
        ))}
        <path d="M-290 0H290M0 -290V290" opacity="0.25" />
      </g>
      <g className="num fill-current text-[10px] text-dim">
        {rings.map((au) => (
          <text key={au} x={4} y={-radial(au) - 3}>
            {au} AU
          </text>
        ))}
      </g>

      {/* destination orbit, as a guide */}
      {!targetIsMoon && <circle r={radial(destAU)} fill="none" stroke="currentColor" className="text-rule" strokeWidth="1" />}
      <circle r={radial(1)} fill="none" stroke="currentColor" className="text-rule" strokeWidth="1" />

      {/* Sun */}
      <circle r="7" className="fill-caution" />
      <circle r="12" fill="none" stroke="currentColor" className="text-caution" opacity="0.35" />

      {/* radio link to Earth */}
      {linkUp && <line x1={craft.x} y1={craft.y} x2={earth.x} y2={earth.y} stroke="currentColor" className="text-caution" strokeWidth="1" strokeDasharray="3 4" opacity="0.8" />}

      {/* flown path */}
      <path d={path(trail)} fill="none" stroke="currentColor" className="text-go" strokeWidth="1.2" opacity="0.45" />
      <path d={path(tail)} fill="none" stroke="currentColor" className="text-go" strokeWidth="1.8" strokeLinecap="round" />

      {/* Earth */}
      <circle cx={earth.x} cy={earth.y} r="5" className="fill-ink" />
      <text x={earth.x + labelSide(earth).dx} y={earth.y + 15} textAnchor={labelSide(earth).anchor} className="fill-current text-[13px] text-ink">
        {targetIsMoon ? 'Earth and Moon' : 'Earth'}
      </text>

      {/* destination */}
      {!targetIsMoon && (
        <>
          <circle cx={target.x} cy={target.y} r="6" className="fill-bg" stroke="currentColor" strokeWidth="1.6" />
          <text x={target.x + labelSide(target).dx} y={target.y + 17} textAnchor={labelSide(target).anchor} className="fill-current text-[13px] text-ink">
            {destName}
          </text>
        </>
      )}

      {/* spacecraft */}
      <g transform={`translate(${craft.x} ${craft.y})`} className="text-go">
        {atTarget || (targetIsMoon && state.phase !== 'cruise' && state.phase !== 'launch') ? (
          <circle r="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
        ) : (
          <path d="M0 -6L5 0L0 6L-5 0Z" fill="currentColor" />
        )}
      </g>
    </svg>
  );
}
