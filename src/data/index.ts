/**
 * Loads every static JSON file, validates it against the shared zod schemas, and exposes one typed Catalog.
 * Owner: Track B. Engine and UI import `catalog` from here — never the raw JSON.
 */
import { z } from 'zod';
import {
  Constants,
  Destination,
  EventCard,
  HistoricalMission,
  Instrument,
  LaunchVehicle,
  MissionClass,
  Part,
  PlanetaryElements,
  ReviewRule,
  Scenario,
  Source,
  SpaceWeatherEvent,
  Trajectory,
} from '../types/catalog';
import type { Catalog } from '../types/engine';

import sourcesJson from './sources.json';
import constantsJson from './constants.json';
import missionClassesJson from './mission-classes.json';
import destinationsJson from './destinations.json';
import trajectoriesJson from './trajectories.json';
import launchVehiclesJson from './launch-vehicles.json';
import partsJson from './parts.json';
import instrumentsJson from './instruments.json';
import scenariosJson from './scenarios.json';
import eventsJson from './events.json';
import spaceWeatherJson from './space-weather.json';
import historyJson from './history.json';
import reviewRulesJson from './review-rules.json';
import planetaryElementsJson from './planetary-elements.json';

function parse<T extends z.ZodType>(name: string, schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Fail loudly in dev and tests — bad data must never reach the engine silently.
    throw new Error(`[data] ${name} failed validation:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function loadCatalog(): Catalog {
  return {
    sources: parse('sources.json', z.array(Source), sourcesJson),
    constants: parse('constants.json', Constants, constantsJson),
    missionClasses: parse('mission-classes.json', z.array(MissionClass), missionClassesJson),
    destinations: parse('destinations.json', z.array(Destination), destinationsJson),
    trajectories: parse('trajectories.json', z.array(Trajectory), trajectoriesJson),
    launchVehicles: parse('launch-vehicles.json', z.array(LaunchVehicle), launchVehiclesJson),
    parts: parse('parts.json', z.array(Part), partsJson),
    instruments: parse('instruments.json', z.array(Instrument), instrumentsJson),
    scenarios: parse('scenarios.json', z.array(Scenario), scenariosJson),
    events: parse('events.json', z.array(EventCard), eventsJson),
    spaceWeather: parse('space-weather.json', z.array(SpaceWeatherEvent), spaceWeatherJson.events),
    history: parse('history.json', z.array(HistoricalMission), historyJson),
    reviewRules: parse('review-rules.json', z.array(ReviewRule), reviewRulesJson),
    planetaryElements: parse('planetary-elements.json', z.array(PlanetaryElements), planetaryElementsJson.bodies),
  };
}

export const catalog: Catalog = loadCatalog();

// ---- small typed lookups (throw on unknown ids so typos surface immediately) ----
function byId<T extends { id: string }>(list: T[], id: string, what: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`[data] unknown ${what} id "${id}"`);
  return found;
}
export const getScenario = (c: Catalog, id: string) => byId(c.scenarios, id, 'scenario');
export const getDestination = (c: Catalog, id: string) => byId(c.destinations, id, 'destination');
export const getTrajectory = (c: Catalog, id: string) => byId(c.trajectories, id, 'trajectory');
export const getLaunchVehicle = (c: Catalog, id: string) => byId(c.launchVehicles, id, 'launch vehicle');
export const getPart = (c: Catalog, id: string) => byId(c.parts, id, 'part');
export const getInstrument = (c: Catalog, id: string) => byId(c.instruments, id, 'instrument');
export const getEvent = (c: Catalog, id: string) => byId(c.events, id, 'event');
export const getHistory = (c: Catalog, id: string) => byId(c.history, id, 'historical mission');
export const getSource = (c: Catalog, id: string) => byId(c.sources, id, 'source');
export const getMissionClass = (c: Catalog, id: string) => {
  const found = c.missionClasses.find((m) => m.id === id);
  if (!found) throw new Error(`[data] unknown mission class "${id}"`);
  return found;
};
