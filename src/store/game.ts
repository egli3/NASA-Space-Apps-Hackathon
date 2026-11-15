/**
 * Game state machine (Zustand). Owner: Track C.
 * Screens read from here; all numbers come from the engine. The store never computes physics itself.
 */
import { create } from 'zustand';
import { catalog } from '../data';
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

const newSeed = () => Math.floor(Math.random() * 2 ** 31); // the UI may use Math.random; the ENGINE never does

interface GameState {
  screen: Screen;
  /** Where "back" from the Credits screen returns to. */
  creditsReturn: Screen;
  seed: number;
  design?: MissionDesign;
  designTab: DesignTab;
  decisions: DecisionLog;
  result?: MissionResult;
  debrief?: Debrief;
  go: (screen: Screen) => void;
  setDesignTab: (tab: DesignTab) => void;
  startScenario: (scenarioId: string) => void;
  updateDesign: (patch: Partial<MissionDesign>) => void;
  finishFlight: (result: MissionResult, decisions: DecisionLog) => void;
  retry: () => void; // same scenario, keep design, new seed → back to design
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'title',
  creditsReturn: 'title',
  seed: newSeed(),
  designTab: 'instruments',
  decisions: {},
  go: (screen) => set(screen === 'credits' ? { screen, creditsReturn: get().screen === 'credits' ? get().creditsReturn : get().screen } : { screen }),
  setDesignTab: (designTab) => set({ designTab }),
  startScenario: (scenarioId) =>
    set({
      design: engine.defaultDesign(catalog, scenarioId),
      screen: 'briefing',
      designTab: 'instruments',
      seed: newSeed(),
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
    set({ result, decisions, debrief: engine.buildDebrief(catalog, design, seed, decisions, result), screen: 'debrief' });
  },
  retry: () => set({ seed: newSeed(), decisions: {}, result: undefined, debrief: undefined, screen: 'design' }),
}));

// Dev-only handle for jumping between screens from the browser console: __game.getState().go('flight')
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;
