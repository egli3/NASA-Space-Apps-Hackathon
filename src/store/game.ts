/**
 * Game state machine (Zustand). Owner: Track C.
 * Screens read from here; all numbers come from the engine. The store never computes physics itself.
 */
import { create } from 'zustand';
import { catalog, createJupiterDemo, JUPITER_DEMO_SEED, JUPITER_SCENARIO_ID } from '../data';
import { engine } from '../engine';
import { MissionDesign, type DecisionLog } from '../types/design';
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

const SCREENS: Screen[] = ['title', 'scenario', 'briefing', 'design', 'launch', 'review', 'growth', 'flight', 'debrief', 'credits'];

/**
 * The mission in progress survives a page refresh (and a phone browser discarding the tab) through sessionStorage:
 * one tab, one mission, gone when the tab closes. Only the player's choices are kept; every number is recomputed.
 */
const SAVE_KEY = 'margin.session.v1';

interface Saved {
  screen: Screen;
  creditsReturn: Screen;
  seed: number;
  guidedFlight: boolean;
  design?: MissionDesign;
  designTab: DesignTab;
  /** Set only once a flight has finished, so the debrief can be rebuilt by re-flying it. */
  decisions?: DecisionLog;
}

function storage(): Storage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined; // storage can be blocked outright
  }
}

/** Anything unexpected in the saved state (old build, edited by hand, a part that no longer exists) means a clean start. */
function restore(): Partial<Saved> {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (!SCREENS.includes(saved.screen as Screen) || !SCREENS.includes(saved.creditsReturn as Screen) || !Number.isInteger(saved.seed)) return {};
    const design = saved.design === undefined ? undefined : MissionDesign.parse(saved.design);
    if (design) engine.computeBudgets(catalog, design); // throws if the design refers to something this build lacks
    const decisions = saved.decisions && typeof saved.decisions === 'object' ? saved.decisions : undefined;
    return {
      screen: saved.screen,
      creditsReturn: saved.creditsReturn,
      seed: saved.seed,
      guidedFlight: saved.guidedFlight === true,
      design,
      designTab: typeof saved.designTab === 'string' ? saved.designTab : 'instruments',
      decisions,
    };
  } catch {
    return {};
  }
}

/** Re-fly a finished mission with the decisions the player made. Same seed, same choices: the same result. */
function refly(design: MissionDesign, seed: number, decisions: DecisionLog): MissionResult | undefined {
  try {
    const sim = engine.createSimulation(catalog, design, seed);
    for (let turns = 0; turns < 20_000 && !sim.state.ended; turns++) {
      const card = sim.state.pending?.card;
      if (card) sim.decide(decisions[card.id] ?? card.defaultOptionId);
      else sim.advance(1);
    }
    return sim.state.ended ? sim.result() : undefined;
  } catch {
    return undefined;
  }
}

const saved = restore();
/** The debrief was showing, or sitting behind the Credits screen, when the page went away. */
const wasOnDebrief = saved.screen === 'debrief' || (saved.screen === 'credits' && saved.creditsReturn === 'debrief');

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
  // A debrief is rebuilt just below; until then (or if it cannot be) the flight screen stands in for it.
  screen: saved.screen === 'debrief' ? 'flight' : (saved.screen ?? 'title'),
  creditsReturn: saved.creditsReturn === 'debrief' ? 'flight' : (saved.creditsReturn ?? 'title'),
  seed: saved.seed ?? newSeed(),
  guidedFlight: saved.guidedFlight ?? false,
  design: saved.design,
  designTab: saved.designTab ?? 'instruments',
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

if (wasOnDebrief && saved.design && saved.decisions) {
  const result = refly(saved.design, useGame.getState().seed, saved.decisions);
  if (result) {
    useGame.getState().finishFlight(result, saved.decisions); // lands on the debrief
    if (saved.screen === 'credits') useGame.setState({ screen: 'credits', creditsReturn: 'debrief' });
  }
}

useGame.subscribe((s) => {
  const flown = s.result !== undefined;
  const keep: Saved = {
    screen: s.screen,
    creditsReturn: s.creditsReturn,
    seed: s.seed,
    guidedFlight: s.guidedFlight,
    design: s.design,
    designTab: s.designTab,
    decisions: flown ? s.decisions : undefined,
  };
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify(keep));
  } catch {
    // a full or blocked store only costs the player the refresh safety net
  }
});

// Dev-only handle for jumping between screens from the browser console: __game.getState().go('flight')
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __game: typeof useGame }).__game = useGame;
