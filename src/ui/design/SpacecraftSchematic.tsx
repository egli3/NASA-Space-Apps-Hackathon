import { AnimatePresence, motion } from 'motion/react';
import { catalog } from '../../data';
import type { RedundantSlotId } from '../../types/catalog';
import type { MissionDesign } from '../../types/design';
import type { BudgetReport } from '../../types/engine';
import { kg, num, watts } from '../common/format';

const W = 980;
const H = 300;
const CX = W / 2;
const SPRING = { type: 'spring', stiffness: 170, damping: 24, mass: 0.9 } as const;

/**
 * The spacecraft as a drafting sketch that redraws itself as the design changes. Dish diameter and solar array
 * area are drawn to one scale (see the scale bar); the bus and tanks are sized from the engine's dry mass and
 * propellant so that heavier designs visibly grow. Purely presentational: no number shown here is computed in the UI.
 */
export function SpacecraftSchematic({ design, budgets }: { design: MissionDesign; budgets: BudgetReport }) {
  const part = (slot: keyof MissionDesign['parts']) => catalog.parts.find((p) => p.id === design.parts[slot]);
  const power = part('power');
  const antenna = part('antenna');
  const shielding = part('shielding');
  const solar = power?.specs.solarEfficiency !== undefined;
  const rtg = power?.specs.rtgBolW !== undefined;
  const red = (s: RedundantSlotId) => design.redundant.includes(s);
  const instruments = design.instrumentIds.map((id) => catalog.instruments.find((i) => i.id === id)).filter((i) => i !== undefined);

  // --- geometry in metres -------------------------------------------------------------------------------------------
  const busM = Math.min(4, Math.max(1.1, 0.25 * Math.cbrt(Math.max(1, budgets.mass.dryKg))));
  const area = solar ? Math.max(0, design.solarArrayAreaM2) : 0;
  const wingHM = Math.min(busM * 0.86, 2.6);
  const wingLenM = area > 0 ? area / 2 / wingHM : 0;
  const gapM = 0.35;
  const dishM = antenna?.specs.diameterM ?? 0;
  const dishStackM = 0.3 + (dishM > 0 ? dishM * 0.48 : 0.35);
  const prop = Number.isFinite(budgets.mass.propellantKg) ? Math.max(0, budgets.mass.propellantKg) : 0;
  const tankM = Math.min(busM * 0.21, Math.cbrt((3 * (prop / 1000 / 2)) / (4 * Math.PI)));
  const spanM = Math.max(busM + 2 * (wingLenM > 0 ? wingLenM + gapM : rtg ? 1.9 : 0), dishM, busM + 1.5);
  const heightM = busM + dishStackM + 0.55;

  const s = Math.min(60, (W - 300) / spanM, (H - 92) / heightM); // px per metre
  const bus = busM * s;
  const cy = 44 + dishStackM * s + bus / 2;
  const bx = CX - bus / 2;
  const by = cy - bus / 2;
  const wingH = wingHM * s;
  const wingLen = wingLenM * s;
  const gap = gapM * s;
  const dish = dishM * s;
  const mastTop = by - 0.3 * s;
  const rimY = mastTop - dish * 0.2;
  const tank = Math.max(3, tankM * s);
  const cell = bus * 0.15;
  const cells: { id: string; x: number; twice: boolean }[] = [
    { id: 'avionics', x: 0.09, twice: red('avionics') },
    { id: 'battery', x: 0.32, twice: red('battery') },
    { id: 'adcs', x: 0.55, twice: red('adcs') },
    { id: 'transmitter', x: 0.78, twice: red('transmitter') },
  ];
  const vault = (shielding?.specs.doseFactor ?? 1) < 1;
  const heavyVault = (shielding?.specs.doseFactor ?? 1) <= 0.1;
  const n = instruments.length;
  const g = Math.min(0.42 * s, (bus * 0.94) / Math.max(1, n));
  const panels = Math.max(1, Math.round(wingLenM / 1.1));
  const scaleBar = s >= 30 ? 1 : s >= 12 ? 2 : 5;

  const stroke = { stroke: 'currentColor', fill: 'none', strokeWidth: 1.4, vectorEffect: 'non-scaling-stroke' as const };
  const note = 'fill-current text-[15px]';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full text-ink" role="img" aria-label={`Sketch of the spacecraft: ${kg(budgets.mass.dryKg)} dry, ${n} instruments`}>
      {/* solar wings */}
      {[-1, 1].map((side) => {
        const x = side < 0 ? bx - gap - wingLen : bx + bus + gap;
        return (
          <g key={side} opacity={solar && area > 0 ? 1 : 0} style={{ transition: 'opacity .3s' }}>
            <motion.line {...stroke} initial={false} animate={{ x1: side < 0 ? bx : bx + bus, x2: side < 0 ? bx - gap : bx + bus + gap, y1: cy, y2: cy }} transition={SPRING} />
            <motion.rect {...stroke} className="fill-ink/10" initial={false} animate={{ attrX: x, attrY: cy - wingH / 2, width: wingLen, height: wingH }} transition={SPRING} />
            {Array.from({ length: 10 }, (_, i) => {
              const on = i < panels - 1;
              const px = x + ((i + 1) * wingLen) / panels;
              return <motion.line key={i} {...stroke} strokeWidth={0.8} opacity={on ? 0.55 : 0} initial={false} animate={{ x1: on ? px : x, x2: on ? px : x, y1: cy - wingH / 2, y2: cy + wingH / 2 }} transition={SPRING} />;
            })}
            <motion.line {...stroke} strokeWidth={0.8} opacity={0.55} initial={false} animate={{ x1: x, x2: x + wingLen, y1: cy, y2: cy }} transition={SPRING} />
          </g>
        );
      })}

      {/* radioisotope generator on a boom */}
      <g opacity={rtg ? 1 : 0} style={{ transition: 'opacity .3s' }}>
        <motion.line {...stroke} initial={false} animate={{ x1: bx + bus, x2: bx + bus + 0.9 * s, y1: cy, y2: cy }} transition={SPRING} />
        <motion.rect {...stroke} className="fill-ink/10" initial={false} animate={{ attrX: bx + bus + 0.9 * s, attrY: cy - 0.17 * s, width: 0.7 * s, height: 0.34 * s }} transition={SPRING} />
        {[0.15, 0.35, 0.55].map((f) => (
          <motion.line key={f} {...stroke} initial={false} animate={{ x1: bx + bus + (0.9 + f) * s, x2: bx + bus + (0.9 + f) * s, y1: cy - 0.32 * s, y2: cy + 0.32 * s }} transition={SPRING} />
        ))}
      </g>

      {/* antenna */}
      <motion.line {...stroke} initial={false} animate={{ x1: CX, x2: CX, y1: by, y2: dish > 0 ? rimY + dish * 0.2 : by - 0.42 * s }} transition={SPRING} />
      {dish > 0 ? (
        <>
          <motion.path
            {...stroke}
            strokeWidth={1.8}
            strokeDasharray={antenna?.id.includes('deploy') ? '5 3' : undefined}
            className="fill-ink/10"
            initial={false}
            animate={{ d: `M ${CX - dish / 2} ${rimY} Q ${CX} ${rimY + dish * 0.4} ${CX + dish / 2} ${rimY} Z` }}
            transition={SPRING}
          />
          <motion.path {...stroke} strokeWidth={0.9} initial={false} animate={{ d: `M ${CX - dish / 2} ${rimY} L ${CX} ${rimY - dish * 0.24} L ${CX + dish / 2} ${rimY}` }} transition={SPRING} />
        </>
      ) : (
        <motion.path {...stroke} initial={false} animate={{ d: `M ${CX - 0.12 * s} ${by - 0.6 * s} L ${CX} ${by - 0.42 * s} L ${CX + 0.12 * s} ${by - 0.6 * s} Z` }} transition={SPRING} />
      )}

      {/* bus */}
      <motion.rect {...stroke} strokeWidth={2} className="fill-bg" initial={false} animate={{ attrX: bx, attrY: by, width: bus, height: bus }} transition={SPRING} />

      {/* radiation shielding around the electronics bay */}
      <motion.rect
        {...stroke}
        strokeWidth={heavyVault ? 3.2 : 1.4}
        strokeDasharray={heavyVault ? undefined : '4 3'}
        opacity={vault ? 1 : 0}
        style={{ transition: 'opacity .3s' }}
        initial={false}
        animate={{ attrX: bx + bus * 0.04, attrY: by + bus * 0.06, width: bus * 0.92, height: bus * 0.3 }}
        transition={SPRING}
      />

      {/* electronics bay: computer, battery, pointing, radio. A second outline means a backup unit. */}
      {cells.map((c) => {
        const x = bx + bus * c.x;
        const y = by + bus * 0.13;
        return (
          <g key={c.id}>
            <motion.rect {...stroke} strokeWidth={1} opacity={c.twice ? 0.8 : 0} style={{ transition: 'opacity .25s' }} initial={false} animate={{ attrX: x + cell * 0.22, attrY: y + cell * 0.22, width: cell, height: cell }} transition={SPRING} />
            <motion.rect {...stroke} strokeWidth={1} className="fill-bg" initial={false} animate={{ attrX: x, attrY: y, width: cell, height: cell }} transition={SPRING} />
            {c.id === 'avionics' && <motion.rect {...stroke} strokeWidth={0.9} initial={false} animate={{ attrX: x + cell * 0.28, attrY: y + cell * 0.28, width: cell * 0.44, height: cell * 0.44 }} transition={SPRING} />}
            {c.id === 'battery' && <motion.path {...stroke} strokeWidth={0.9} initial={false} animate={{ d: `M ${x + cell * 0.3} ${y + cell * 0.5} H ${x + cell * 0.7} M ${x + cell * 0.5} ${y + cell * 0.3} V ${y + cell * 0.7}` }} transition={SPRING} />}
            {c.id === 'adcs' && <motion.circle {...stroke} strokeWidth={0.9} initial={false} animate={{ cx: x + cell / 2, cy: y + cell / 2, r: cell * 0.28 }} transition={SPRING} />}
            {c.id === 'transmitter' && <motion.path {...stroke} strokeWidth={0.9} initial={false} animate={{ d: `M ${x + cell * 0.2} ${y + cell * 0.62} Q ${x + cell * 0.35} ${y + cell * 0.2} ${x + cell * 0.5} ${y + cell * 0.5} T ${x + cell * 0.8} ${y + cell * 0.38}` }} transition={SPRING} />}
          </g>
        );
      })}

      {/* propellant tanks */}
      {[-1, 1].map((side) => (
        <motion.circle key={side} {...stroke} className="fill-ink/15" initial={false} animate={{ cx: CX + side * bus * 0.23, cy: by + bus * 0.69, r: tank }} transition={SPRING} />
      ))}

      {/* instruments on the planet-facing deck */}
      <AnimatePresence initial={false}>
        {instruments.map((ins, i) => {
          const x = CX - (n * g) / 2 + i * g + g / 2;
          const y = by + bus;
          const kind = ins.measures[0]?.type ?? '';
          const boom = kind === 'magnetometry' || kind === 'particles_fields';
          const lens = kind.startsWith('imaging');
          return (
            <motion.g key={ins.id} initial={{ opacity: 0, x, y: y - 8 }} animate={{ opacity: 1, x, y }} exit={{ opacity: 0, x, y: y + 8 }} transition={SPRING}>
              <title>{ins.name}</title>
              {boom ? (
                <>
                  <line {...stroke} strokeWidth={1} x1={0} y1={0} x2={0} y2={g * 1.25} />
                  <rect {...stroke} strokeWidth={1} className="fill-bg" x={-g * 0.2} y={g * 1.05} width={g * 0.4} height={g * 0.4} transform={`rotate(45 0 ${g * 1.25})`} />
                </>
              ) : (
                <>
                  <rect {...stroke} strokeWidth={1} className="fill-bg" x={-g * 0.36} y={0} width={g * 0.72} height={g * 0.62} />
                  {lens ? <circle {...stroke} strokeWidth={1} cx={0} cy={g * 0.62} r={g * 0.22} className="fill-bg" /> : <path {...stroke} strokeWidth={1} d={`M ${-g * 0.22} ${g * 0.62} L ${-g * 0.34} ${g * 0.98} H ${g * 0.34} L ${g * 0.22} ${g * 0.62}`} />}
                </>
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* --- call-outs: every number here is engine output or a catalogue value -------------------------------------- */}
      <g className="text-dim">
        {/* dish diameter, dimensioned */}
        {dish > 0 ? (
          <>
            <motion.path {...stroke} strokeWidth={1} initial={false} animate={{ d: `M ${CX - dish / 2} 24 V 14 M ${CX + dish / 2} 24 V 14 M ${CX - dish / 2} 19 H ${CX + dish / 2}` }} transition={SPRING} />
            <text x={CX} y={11} textAnchor="middle" className={note}>
              dish <tspan className="num fill-ink">{num(dishM, 1)} m</tspan>
            </text>
          </>
        ) : (
          <text x={CX} y={16} textAnchor="middle" className={note}>
            low-gain antenna, no dish
          </text>
        )}

        {/* dry mass: leader to the bus */}
        <motion.path {...stroke} strokeWidth={1} initial={false} animate={{ d: `M 170 30 L ${bx} ${by}` }} transition={SPRING} />
        <text x={16} y={26} className={note}>
          spacecraft, dry
        </text>
        <text x={16} y={50} className="num fill-ink text-[22px]">
          {kg(budgets.mass.dryKg)}
        </text>

        {/* propellant: leader to a tank */}
        <motion.path {...stroke} strokeWidth={1} initial={false} animate={{ d: `M ${W - 170} 30 L ${CX + bus * 0.23 + tank * 0.7} ${by + bus * 0.69 - tank * 0.7}` }} transition={SPRING} />
        <text x={W - 16} y={26} textAnchor="end" className={note}>
          propellant
        </text>
        <text x={W - 16} y={50} textAnchor="end" className="num fill-ink text-[22px]">
          {budgets.mass.converged ? kg(prop) : 'runaway'}
        </text>

        {/* power source */}
        <text x={W - 16} y={H - 34} textAnchor="end" className={note}>
          {rtg ? 'radioisotope generator' : `solar array ${num(area)} m²`}
        </text>
        <text x={W - 16} y={H - 12} textAnchor="end" className="num fill-ink text-[22px]">
          {watts(budgets.power.generatedEolW)}
        </text>

        {/* instruments */}
        <text x={16} y={H - 34} className={note}>
          payload
        </text>
        <text x={16} y={H - 12} className="fill-ink text-[22px]">
          <tspan className="num">{n}</tspan> {n === 1 ? 'instrument' : 'instruments'}
        </text>

        {/* scale bar */}
        <motion.path {...stroke} strokeWidth={1} initial={false} animate={{ d: `M ${CX - (scaleBar * s) / 2} ${H - 10} v -6 M ${CX + (scaleBar * s) / 2} ${H - 10} v -6 M ${CX - (scaleBar * s) / 2} ${H - 13} H ${CX + (scaleBar * s) / 2}` }} transition={SPRING} />
        <text x={CX} y={H - 19} textAnchor="middle" className="num fill-current text-[13px]">
          {scaleBar} m
        </text>
      </g>
    </svg>
  );
}
