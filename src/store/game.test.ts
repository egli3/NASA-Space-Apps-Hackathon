import { describe, expect, it } from 'vitest';
import { catalog } from '../data';
import { JUPITER_ASSIST_ROUTE, JUPITER_DEMO_SEED, JUPITER_DIRECT_ROUTE } from '../data/jupiter-demo';
import { engine } from '../engine';
import { useGame } from './game';

describe('guided Jupiter launch', () => {
  it('opens on the launch screen and makes the Earth assist a flyable choice', () => {
    useGame.getState().startJupiterDemo();
    const start = useGame.getState();
    expect(start).toMatchObject({ guidedFlight: true, screen: 'launch', seed: JUPITER_DEMO_SEED });
    const direct = start.design!;
    expect(direct.trajectoryId).toBe(JUPITER_DIRECT_ROUTE);
    const directBudget = engine.computeBudgets(catalog, direct);
    expect(directBudget.feasible).toBe(false);
    expect(directBudget.mass.lvCapacityKg).toBeCloseTo(977.5, 0);

    start.updateDesign({ trajectoryId: JUPITER_ASSIST_ROUTE });
    const assisted = useGame.getState().design!;
    expect(assisted).toEqual({ ...direct, trajectoryId: JUPITER_ASSIST_ROUTE });
    const assistedBudget = engine.computeBudgets(catalog, assisted);
    expect(assistedBudget.mass.lvCapacityKg).toBeCloseTo(5158, 0);
    expect(engine.runReview(catalog, assisted).go).toBe(true);
    expect(engine.revealGrowth(catalog, assisted, start.seed).mustDescope).toBe(false);

    const sim = engine.createSimulation(catalog, assisted, start.seed);
    for (let turns = 0; turns < 200 && !sim.state.ended; turns++) {
      const card = sim.state.pending?.card;
      if (card) sim.decide(card.defaultOptionId);
      else sim.advance(30);
    }
    const result = sim.result();
    const debrief = engine.buildDebrief(catalog, assisted, start.seed, sim.decisions, result);
    expect(sim.state.ended).toBe(true);
    expect(sim.decisions['ev-valve-stuck']).toBe('stay');
    expect(result.stars).toBe(3);
    expect(debrief.hindsight[0].replay?.sciencePct).toBeGreaterThan(result.sciencePct);
    expect(debrief.hindsight[0].replay?.firstLogDifference).toBeDefined();
  });

  it('keeps the normal scenario path and allows a player to customize the demo spacecraft', () => {
    const game = useGame.getState();
    game.startJupiterDemo();
    game.go('design');
    expect(useGame.getState()).toMatchObject({ screen: 'design', guidedFlight: false, design: { missionName: 'Jupiter demo' } });
    game.startJupiterDemo();
    game.startScenario('moon-ice');
    expect(useGame.getState()).toMatchObject({ screen: 'briefing', guidedFlight: false, design: { scenarioId: 'moon-ice' }, decisions: {} });
  });
});
