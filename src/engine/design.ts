/** Starting design for a scenario: cheap, mostly-valid defaults so the Design screen never opens empty. Owner: Track A. */
import { getScenario } from '../data';
import type { SlotId } from '../types/catalog';
import type { MissionDesign } from '../types/design';
import type { Catalog } from '../types/engine';

export function defaultDesign(catalog: Catalog, scenarioId: string): MissionDesign {
  const scenario = getScenario(catalog, scenarioId);
  const dest = catalog.destinations.find((d) => d.id === scenario.destinationId)!;
  const allowed = (classes?: string[]) => !classes || classes.includes(scenario.missionClassId);
  const pick = (slot: SlotId, preferred: string[]) => {
    const options = catalog.parts.filter((p) => p.slot === slot && allowed(p.classes));
    return (preferred.map((id) => options.find((p) => p.id === id)).find(Boolean) ?? options[0])?.id;
  };
  const far = dest.solarDistanceAU > 2;
  const parts: MissionDesign['parts'] = {
    power: pick('power', ['pwr-solar-tj']),
    battery: pick('battery', [scenario.missionClassId === 'small' ? 'bat-200' : 'bat-1500']),
    propulsion: pick('propulsion', [scenario.missionClassId === 'small' ? 'prop-mono' : 'prop-biprop']),
    antenna: pick('antenna', [scenario.missionClassId === 'small' ? 'ant-lga' : far ? 'ant-hga-25' : 'ant-hga-15']),
    transmitter: pick('transmitter', [far ? 'tx-twta-35' : 'tx-sspa-20']),
    adcs: pick('adcs', ['adcs-standard']),
    avionics: pick('avionics', [scenario.missionClassId === 'small' ? 'avi-commercial' : 'avi-radtol']),
    thermal: pick('thermal', [far ? 'thm-active' : 'thm-passive']),
    shielding: pick('shielding', ['shd-none']),
  };
  return {
    scenarioId,
    missionName: scenario.title,
    parts,
    solarArrayAreaM2: far ? 40 : scenario.missionClassId === 'small' ? 2 : 10,
    instrumentIds: scenario.instrumentIds.slice(0, 2),
    commsBand: 'X',
    redundant: [],
    orbitId: dest.orbits[0].id,
    trajectoryId: scenario.trajectoryIds[0],
    launchOffsetDays: 0,
    launchVehicleId: scenario.launchVehicleIds[0],
    dsnAperture: '34m',
    dsnHoursPerDay: 8,
    assurance: 'standard',
    reservePct: 25,
  };
}
