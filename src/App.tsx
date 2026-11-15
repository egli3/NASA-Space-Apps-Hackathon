/**
 * App shell + screen router. Owner: Track C.
 * KICKOFF STUB: proves data → engine → UI works end to end. Track C replaces each placeholder with the real
 * screen from docs/tracks/TRACK_C_UI.md (files go in src/ui/screens/*.tsx).
 */
import { useMemo } from 'react';
import { catalog } from './data';
import { engine } from './engine';
import { useGame, type Screen } from './store/game';

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });

function Placeholder({ name, next }: { name: string; next?: Screen }) {
  const go = useGame((s) => s.go);
  return (
    <div className="grid h-full place-items-center">
      <div className="text-center">
        <p className="font-mono text-dim">TODO(Track C): {name} screen</p>
        {next && (
          <button className="mt-4 rounded bg-accent px-4 py-2 text-space-950" onClick={() => go(next)}>
            Continue → {next}
          </button>
        )}
      </div>
    </div>
  );
}

function Title() {
  const go = useGame((s) => s.go);
  return (
    <div className="grid h-full place-items-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-[0.3em]">MARGIN</h1>
        <p className="mt-3 text-dim">Design it. Fly it. Find out what mattered.</p>
        <button className="mt-8 rounded bg-accent px-6 py-3 font-semibold text-space-950" onClick={() => go('scenario')}>
          New mission
        </button>
      </div>
    </div>
  );
}

function ScenarioSelect() {
  const start = useGame((s) => s.startScenario);
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-6 md:grid-cols-3">
      {catalog.scenarios.map((s) => (
        <button key={s.id} onClick={() => start(s.id)} className="rounded-lg border border-grid bg-space-900 p-5 text-left hover:border-accent">
          <div className="font-mono text-xs text-dim">{s.priority} · difficulty {s.difficulty}</div>
          <h2 className="mt-1 text-xl font-semibold">{s.title}</h2>
          <p className="mt-2 text-sm text-dim">{s.tagline}</p>
        </button>
      ))}
    </div>
  );
}

/** Minimal live-budget readout to prove the engine wiring. Track C builds the real Design Studio. */
function DesignStub() {
  const design = useGame((s) => s.design)!;
  const update = useGame((s) => s.updateDesign);
  const go = useGame((s) => s.go);
  const b = useMemo(() => engine.computeBudgets(catalog, design), [design]);
  return (
    <div className="mx-auto max-w-3xl p-6 font-mono text-sm">
      <h2 className="mb-4 font-display text-2xl">{design.missionName} — design stub</h2>
      <label className="block">
        Solar array: {design.solarArrayAreaM2} m²
        <input type="range" min={0} max={80} value={design.solarArrayAreaM2} onChange={(e) => update({ solarArrayAreaM2: +e.target.value })} className="w-full" />
      </label>
      <ul className="mt-4 space-y-1">
        <li>Mass {fmt(b.mass.wetKg)} kg / LV {fmt(b.mass.lvCapacityKg)} kg (margin {fmt(b.mass.marginPct, 1)}%)</li>
        <li>Power EOL {fmt(b.power.generatedEolW)} W vs load {fmt(Math.max(b.power.loadScienceW, b.power.loadDownlinkW))} W (margin {fmt(b.power.marginPct, 1)}%)</li>
        <li>Downlink {fmt(b.comms.rateKbpsAtMean, 1)} kbps → {fmt(b.comms.downlinkGbPerDay, 1)} Gb/day vs {fmt(b.comms.generatedGbPerDay, 1)} generated</li>
        <li>Cost ${fmt(b.cost.totalM)}M / cap ${fmt(b.cost.capM)}M</li>
        <li>Expected science {fmt(b.science.expectedPct)}%</li>
      </ul>
      {b.blockers.map((x) => (
        <p key={x} className="mt-2 text-nogo">⚠ {x}</p>
      ))}
      <button className="mt-6 rounded bg-accent px-4 py-2 text-space-950" onClick={() => go('launch')}>Continue → launch</button>
    </div>
  );
}

export default function App() {
  const screen = useGame((s) => s.screen);
  switch (screen) {
    case 'title': return <Title />;
    case 'scenario': return <ScenarioSelect />;
    case 'briefing': return <Placeholder name="Briefing" next="design" />;
    case 'design': return <DesignStub />;
    case 'launch': return <Placeholder name="Launch (vehicle + trajectory + date)" next="review" />;
    case 'review': return <Placeholder name="Review Board" next="growth" />;
    case 'growth': return <Placeholder name="Mass & cost growth reveal" next="flight" />;
    case 'flight': return <Placeholder name="Flight (mission control)" next="debrief" />;
    case 'debrief': return <Placeholder name="Debrief (score, hindsight, you vs history)" next="title" />;
    case 'credits': return <Placeholder name="Credits & sources" next="title" />;
  }
}
