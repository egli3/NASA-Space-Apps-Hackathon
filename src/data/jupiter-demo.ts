import type { MissionDesign } from '../types/design';

export const JUPITER_DEMO_SEED = 2030;
export const JUPITER_SCENARIO_ID = 'jupiter-interior';
export const JUPITER_DIRECT_ROUTE = 'jupiter-direct-2029';
export const JUPITER_ASSIST_ROUTE = 'jupiter-dveega-2029';

export function createJupiterDemo(base: MissionDesign): MissionDesign {
  return {
    ...base,
    missionName: 'Jupiter demo',
    parts: { ...base.parts, shielding: 'shd-vault' },
    instrumentIds: ['ins-wac', 'ins-mwr', 'ins-gravity', 'ins-mag', 'ins-particles', 'ins-uvs'],
    solarArrayAreaM2: 60,
    commsBand: 'Ka',
    trajectoryId: JUPITER_DIRECT_ROUTE,
    launchVehicleId: 'lv-vulcan-vc4',
  };
}
