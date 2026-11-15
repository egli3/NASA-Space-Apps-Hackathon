/** Plain-English names for ids that come from the data contracts. Owner: Track C. */
import type { MeasurementType, SlotId } from '../../types/catalog';
import type { SimPhase } from '../../types/engine';
import type { DesignTab } from '../../store/game';

export const SLOT_ORDER: SlotId[] = ['power', 'battery', 'propulsion', 'antenna', 'transmitter', 'adcs', 'avionics', 'thermal', 'shielding'];

export const TAB_LABEL: Record<DesignTab, string> = {
  instruments: 'Instruments',
  power: 'Power',
  battery: 'Battery',
  propulsion: 'Engine',
  antenna: 'Antenna',
  transmitter: 'Transmitter',
  adcs: 'Pointing',
  avionics: 'Computer',
  thermal: 'Thermal',
  shielding: 'Shielding',
  orbit: 'Science orbit',
  operations: 'Operations',
};

/** One sentence per tab: what the choice is and what it costs you. */
export const TAB_HELP: Record<DesignTab, string> = {
  instruments: 'Instruments are why the mission flies. Each one adds mass, draws power, costs money and makes data you must send home.',
  power: 'Sunlight fades with the square of distance. At Jupiter a panel makes 4% of what it does at Earth.',
  battery: 'The battery carries the spacecraft through the planet’s shadow on every orbit.',
  propulsion: 'The engine brakes you into orbit. A more efficient engine needs far less propellant for the same change in speed.',
  antenna: 'A dish twice as wide sends four times the data. It is also heavier.',
  transmitter: 'More radio power means a faster link, and more electrical power to feed it.',
  adcs: 'Pointing keeps cameras steady and the dish aimed at Earth. Sharp instruments and Ka-band need fine pointing.',
  avionics: 'The flight computer runs the spacecraft and stores data until it can be sent. Radiation slowly kills ordinary chips.',
  thermal: 'Far from the Sun, the spacecraft must make its own warmth or freeze.',
  shielding: 'Shielding cuts the radiation dose your electronics absorb. It is dead weight until the day it saves the mission.',
  orbit: 'The orbit decides how well each instrument sees, how long the shadows are and how much braking you need.',
  operations: 'How you run the mission: antenna time on Earth, how hard you test, and how much money you hold back.',
};

export const MEASUREMENT_LABEL: Record<MeasurementType, string> = {
  imaging_context: 'wide-area imaging',
  imaging_hires: 'high-resolution imaging',
  vis_ir_spectroscopy: 'mineral spectroscopy',
  uv_spectroscopy: 'ultraviolet spectroscopy',
  gamma_neutron: 'gamma-ray and neutron sensing',
  radar_sounding: 'radar sounding',
  laser_altimetry: 'laser altimetry',
  magnetometry: 'magnetic field measurement',
  particles_fields: 'particle and plasma sensing',
  mass_spectrometry: 'gas composition sampling',
  microwave_radiometry: 'microwave sounding',
  gravity_science: 'gravity mapping by radio',
  thermal_ir: 'temperature mapping',
};

export const PHASE_LABEL: Record<SimPhase, string> = {
  launch: 'Launch',
  cruise: 'Cruise',
  arrival: 'Arrival',
  aerobraking: 'Aerobraking',
  science: 'Science',
  extended: 'Extended mission',
  ended: 'Mission complete',
};

export const TRL_HELP =
  'Technology readiness level, 1 to 9. A 9 has flown in space before; lower numbers are newer hardware that tends to come in heavier and costlier than promised.';
