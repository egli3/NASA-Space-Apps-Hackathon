/**
 * Game state machine (Zustand). Owner: Track C.
 * Screens read from here; all numbers come from the engine. The store never computes physics itself.
 */
import { create } from 'zustand';
import { catalog, createJupiterDemo, JUPITER_DEMO_SEED, JUPITER_SCENARIO_ID } from '../data';
import { engine } from '../engine';
import type { DecisionLog, MissionDesign } from '../types/design';
import type { Debrief, MissionResult } from '../types/engine';

export type Screen = 'title' | 'scenario' | 'briefing' | 'design' | 'launch' | 'review' | 'growth' | 'flight' | 'debrief' | 'credits';

/** Tabs of the Design Studio. Kept in the store so the Review Board can send the player straight to the right one. */
export type DesignTab =
  | 'instruments'
  | 'power'
  | 'battery'
  | 'propulsion'
  | 'antenna'
  | 'transmitter'
  | 'adcs'
  | 'avionics'
  | 'thermal'
  | 'shielding'
  | 'orbit'
  | 'operations';

/** Alternate universes flown for the Review Board prediction and the Debrief (GAME_DESIGN §6.3). */
export const MONTE_CARLO_RUNS = 50;

const newSeed = () => Math.floor(Math.random() * 2 ** 31); // the UI may use Math.random; the ENGINE never does

interface GameState {
  screen: Screen;
  /** Where "back" from the Credits screen returns to. */
  creditsReturn: Screen;
  seed: number;
  guidedFlight: boolean;
  design?: MissionDesign;
  designTab: DesignTab;
  decisions: DecisionLog;
  result?: MissionResult;
  debrief?: Debrief;
  go: (screen: Screen) => void;
  setDesignTab: (tab: DesignTab) => void;
  startJupiterDemo: () => void;
  startScenario: (scenarioId: string) => void;
  updateDesign: (patch: Partial<MissionDesign>) => void;
  finishFlight: (result: MissionResult, decisions: DecisionLog) => void;
  retry: () => void; // same scenario, keep design, new seed → back to design
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'title',
  creditsReturn: 'title',
  seed: newSeed(),
  guidedFlight: false,
  designTab: 'instruments',
  decisions: {},
  go: (screen) => {
    if (screen === 'credits') {
      set({ screen, creditsReturn: get().screen === 'credits' ? get().creditsReturn : get().screen });
    } else if (screen === 'title' || screen === 'scenario' || screen === 'design' || screen === 'briefing') {
      set({ screen, guidedFlight: false });
    } else {
      set({ screen });
    }
  },
  setDesignTab: (designTab) => set({ designTab }),
  startJupiterDemo: () =>
    set({
      design: createJupiterDemo(engine.defaultDesign(catalog, JUPITER_SCENARIO_ID)),
      screen: 'launch',
      designTab: 'instruments',
      seed: JUPITER_DEMO_SEED,
      guidedFlight: true,
      decisions: {},
      result: undefined,
      debrief: undefined,
    }),
  startScenario: (scenarioId) =>
    set({
      design: engine.defaultDesign(catalog, scenarioId),
      screen: 'briefing',
      designTab: 'instruments',
      seed: newSeed(),
      guidedFlight: false,
      decisions: {},
      result: undefined,
      debrief: undefined,
    }),
  updateDesign: (patch) => {
    const d = get().design;
    if (d) set({ design: { ...d, ...patch } });
  },
  finishFlight: (result, decisions) => {
    const { design, seed } = get();
    if (!design) return;
    // Show the outcome at once; Hindsight and Monte Carlo re-fly the mission ~100 times in a Web Worker and
    // arrive a moment later (the Debrief screen shows a "replaying" state until `debrief` is set).
    set({ result, decisions, debrief: undefined, screen: 'debrief' });
    const opts = { monteCarloRuns: MONTE_CARLO_RUNS };
    const keep = (debrief: Debrief) => {
      if (get().result === result) set({ debrief });
    };
    engine
      .buildDebriefAsync(catalog, design, seed, decisions, result, opts)
      .then(keep)
      .catch(() => keep(engine.buildDebrief(catalog, design, seed, decisions, result, opts)));
  },
  retry: () => set({ seed: newSeed(), guidedFlight: false, decisions: {}, result: undefined, debrief: undefined, screen: 'design' }),
}));

// Dev-only handle for jumping between screens from the browser console: __game.getState().go('flight')
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __game: typeof useGame }).__game = useGame;
