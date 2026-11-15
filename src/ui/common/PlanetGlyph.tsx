/**
 * Destinations drawn as drafting globes (meridians, parallels, a few defining features) rather than photos:
 * no image licensing to track, no NASA insignia risk, and they sit naturally on a blueprint sheet.
 */
export function PlanetGlyph({ id, size = 160 }: { id: string; size?: number }) {
  const r = 70;
  const c = 80;
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="1" className="h-auto max-w-full" aria-hidden>
      <defs>
        <clipPath id={`disc-${id}`}>
          <circle cx={c} cy={c} r={r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#disc-${id})`} opacity="0.55">
        {id === 'jupiter' ? (
          <>
            {/* cloud belts and the Great Red Spot */}
            {[-46, -30, -19, -6, 9, 22, 38, 52].map((y, i) => (
              <path key={y} d={`M 6 ${c + y} q 37 ${i % 2 ? 5 : -5} 74 0 t 74 0`} />
            ))}
            <ellipse cx="104" cy="96" rx="15" ry="8" />
            <ellipse cx="104" cy="96" rx="8" ry="4" />
          </>
        ) : id === 'moon' ? (
          <>
            {/* a few large craters; shading is left to the imagination */}
            {[
              [52, 58, 13],
              [98, 46, 8],
              [108, 92, 17],
              [62, 106, 9],
              [84, 76, 5],
              [40, 86, 5],
              [92, 122, 6],
            ].map(([x, y, cr]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r={cr} />
                <path d={`M ${x - cr * 0.6} ${y + cr * 0.35} a ${cr * 0.75} ${cr * 0.75} 0 0 0 ${cr * 1.2} 0`} opacity="0.6" />
              </g>
            ))}
          </>
        ) : (
          <>
            {/* Mars: graticule, polar caps, and the Valles Marineris scar */}
            {[0.35, 0.7].map((k) => (
              <ellipse key={k} cx={c} cy={c} rx={r * k} ry={r} />
            ))}
            {[-40, -20, 0, 20, 40].map((y) => (
              <path key={y} d={`M ${c - Math.sqrt(r * r - y * y)} ${c + y} q ${Math.sqrt(r * r - y * y)} 9 ${2 * Math.sqrt(r * r - y * y)} 0`} />
            ))}
            <path d="M 46 22 q 34 16 68 0" strokeWidth="1.6" />
            <path d="M 54 141 q 26 -11 52 0" strokeWidth="1.6" />
            <path d="M 44 92 q 22 -9 40 -2 t 34 -6" strokeWidth="1.8" />
          </>
        )}
      </g>
      <circle cx={c} cy={c} r={r} strokeWidth="1.5" />
      {/* centre mark */}
      <path d={`M ${c - 5} ${c} h 10 M ${c} ${c - 5} v 10`} opacity="0.5" />
    </svg>
  );
}
