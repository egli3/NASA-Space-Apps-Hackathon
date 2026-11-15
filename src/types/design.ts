/**
 * SHARED CONTRACT — the player's mission design (everything the player decides before launch).
 * Serializable (saved to localStorage / share URL). Additive changes only — see AGENTS.md §Contracts.
 */
import { z } from 'zod';
import { CommsBand, RedundantSlotId, SlotId } from './catalog';

export const Assurance = z.enum(['lean', 'standard', 'rigorous']);
export type Assurance = z.infer<typeof Assurance>;

export const DsnAperture = z.enum(['34m', '70m']);
export type DsnAperture = z.infer<typeof DsnAperture>;

export const MissionDesign = z.object({
  scenarioId: z.string(),
  missionName: z.string().max(32),
  /** One part id per slot. 'shielding' may point at the "none" part. */
  parts: z.partialRecord(SlotId, z.string()),
  solarArrayAreaM2: z.number().nonnegative(), // ignored when the power part is an RTG
  instrumentIds: z.array(z.string()),
  commsBand: CommsBand,
  redundant: z.array(RedundantSlotId),
  orbitId: z.string(),
  trajectoryId: z.string(),
  launchOffsetDays: z.number().int(), // days from the trajectory's optimal date (0 = optimal)
  launchVehicleId: z.string(),
  dsnAperture: DsnAperture,
  dsnHoursPerDay: z.number().min(1).max(24),
  assurance: Assurance,
  reservePct: z.number().min(0).max(60), // cost reserve held back for surprises
});
export type MissionDesign = z.infer<typeof MissionDesign>;

/** Choices made during flight, keyed by event card id → option id. Used to replay a mission deterministically. */
export type DecisionLog = Record<string, string>;
