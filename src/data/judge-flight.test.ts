import { describe, expect, it } from 'vitest';
import { engine } from '../engine';
import { referenceDesigns } from '../engine/reference-designs';
import { catalog } from './index';

const reference = referenceDesigns(catalog);
const flights = [
  { id: 'mro-like', seed: 2026, historyId: 'hist-mro', eventId: 'ev-aerobraking-panel' },
  { id: 'juno-like', seed: 2030, historyId: 'hist-juno', eventId: 'ev-valve-stuck' },
  { id: 'lunar-prospector-like', seed: 2026, historyId: 'hist-lunar-prospector', eventId: 'ev-sep-storm' },
];

describe('showcase missions', () => {
  it.each(flights)('$id can clear review, make a flight decision and reach debrief', ({ id, seed, historyId, eventId }) => {
    const design = reference.find((item) => item.id === id)!.design;
    expect(engine.runReview(catalog, design).go).toBe(true);
    expect(engine.revealGrowth(catalog, design, seed).mustDescope).toBe(false);

    const sim = engine.createSimulation(catalog, design, seed);
    for (let step = 0; step < 300 && !sim.state.ended; step++) {
      const pending = sim.state.pending;
      if (pending) sim.decide(pending.card.defaultOptionId);
      else sim.advance(30);
    }
    expect(sim.state.ended).toBe(true);
    expect(sim.decisions[eventId]).toBeDefined();

    const result = sim.result();
    const debrief = engine.buildDebrief(catalog, design, seed, sim.decisions, result);
    expect(result.outcome).not.toBe('lost');
    expect(result.sciencePct).toBeGreaterThan(50);
    expect(result.underBudget).toBe(true);
    expect(debrief.comparison.mission.id).toBe(historyId);
    expect(debrief.comparison.rows.length).toBeGreaterThan(0);
    expect(debrief.replays).toBeGreaterThan(0);
    if (id === 'juno-like') {
      expect(result.stars).toBe(3);
      expect(debrief.hindsight.some((item) => item.feasible && item.deltaSciencePct > 0)).toBe(true);
    }
  });

  it('a low-orbit Mars survey can measure atmospheric escape remotely and earn three stars', () => {
    const design = reference.find((item) => item.id === 'balanced-mars')!.design;
    const budget = engine.computeBudgets(catalog, design);
    expect(budget.science.expectedPct).toBeGreaterThanOrEqual(80);
    expect(budget.science.objectives.find((item) => item.objectiveId === 'mars-escape')?.coveredBy).toEqual(['ins-uvs']);
    expect(engine.runReview(catalog, design).go).toBe(true);
    const flight = engine.runHeadless(catalog, design, 2026);
    expect(flight.stars).toBe(3);
    expect(flight.underBudget).toBe(true);
  });

  it('links every incident story directly to a NASA report or mission article', () => {
    const generic = new Set(['jpl-news', 'nssdca-nmc', 'nasa-science-missions', 'nasa-llis', 'nasa-donki']);
    for (const card of catalog.events) {
      const source = catalog.sources.find((item) => item.isNasa && card.sources.includes(item.id) && !generic.has(item.id));
      expect(source, card.id).toBeDefined();
    }
  });
});
