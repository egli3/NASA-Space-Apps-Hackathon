/**
 * Game state machine (Zustand). Owner: Track C.
 * Screens read from here; all numbers come from the engine — the store never computes physics itself.
 */
import { create } from 'zustand';
import { catalog } from '../data';
import { engine } from '../engine';
import type { DecisionLog, MissionDesign } from '../types/design';
import type { Debrief, MissionResult } from '../types/engine';

export type Screen = 'title' | 'scenario' | 'briefing' | 'design' | 'launch' | 'review' | 'growth' | 'flight' | 'debrief' | 'credits';

interface GameState {
  screen: Screen;
  seed: number;
  design?: MissionDesign;
  decisions: DecisionLog;
  result?: MissionResult;
  debrief?: Debrief;
  go: (screen: Screen) => void;
  startScenario: (scenarioId: string) => void;
  updateDesign: (patch: Partial<MissionDesign>) => void;
  finishFlight: (result: MissionResult, decisions: DecisionLog) => void;
  retry: () => void; // same scenario, keep design, new seed → back to design
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'title',
  seed: Math.floor(Math.random() * 2 ** 31), // UI may use Math.random; the ENGINE never does
  decisions: {},
  go: (screen) => set({ screen }),
  startScenario: (scenarioId) => set({ design: engine.defaultDesign(catalog, scenarioId), screen: 'briefing', decisions: {}, result: undefined, debrief: undefined }),
  updateDesign: (patch) => {
    const d = get().design;
    if (d) set({ design: { ...d, ...patch } });
  },
  finishFlight: (result, decisions) => {
    const { design, seed } = get();
    if (!design) return;
    set({ result, decisions, debrief: engine.buildDebrief(catalog, design, seed, decisions, result), screen: 'debrief' });
  },
  retry: () => set({ seed: Math.floor(Math.random() * 2 ** 31), decisions: {}, result: undefined, debrief: undefined, screen: 'design' }),
}));
