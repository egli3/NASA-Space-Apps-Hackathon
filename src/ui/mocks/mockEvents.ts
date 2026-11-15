/**
 * UI-development mock, opt-in with `?mockEvents` in the URL. Owner: Track C.
 *
 * Until the engine's flight simulator raises real event cards (Track A, GAME_DESIGN §5.3–5.4), this wrapper pauses
 * the flight every few hundred days with a card from the scenario's deck so the event modal and "what really
 * happened" card can be built and tested. The choice is logged but has NO effect on the mission. Never on by default.
 */
import type { EventCard } from '../../types/catalog';
import type { AdvanceResult, PendingEvent, SimState, Simulation } from '../../types/engine';

export const mockEventsRequested = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mockEvents');

export function withMockEvents(sim: Simulation, deck: EventCard[], everyDays = 240): Simulation {
  let pending: PendingEvent | undefined;
  let next = 60;
  let dealt = 0;
  const view = (): SimState => (pending ? { ...sim.state, pending } : sim.state);

  return {
    get state() {
      return view();
    },
    get log() {
      return sim.log;
    },
    get decisions() {
      return sim.decisions;
    },
    result: () => sim.result(),
    advance(days: number): AdvanceResult {
      if (pending) return { state: view(), newLog: [], pending };
      const start = sim.log.length;
      let left = days;
      while (left > 0 && !sim.state.ended && !sim.state.pending) {
        const step = Math.max(1, Math.min(left, next - sim.state.day));
        sim.advance(step);
        left -= step;
        if (sim.state.day >= next && !sim.state.ended && dealt < deck.length) {
          pending = { card: deck[dealt++], day: sim.state.day, context: ['Mock card for interface testing: your choice does not change the mission.'] };
          next += everyDays;
          break;
        }
      }
      return { state: view(), newLog: sim.log.slice(start), pending: pending ?? sim.state.pending };
    },
    decide(optionId: string): AdvanceResult {
      if (!pending) return sim.decide(optionId);
      const card = pending.card;
      pending = undefined;
      const entry = { day: sim.state.day, date: sim.state.date, kind: 'decision' as const, text: `${card.title}: ${card.options.find((o) => o.id === optionId)?.label ?? optionId}`, eventId: card.id, optionId };
      sim.log.push(entry);
      return { state: view(), newLog: [entry] };
    },
  };
}
