/**
 * SHARED CONTRACT — game catalog (static data) schemas.
 *
 * Owned jointly. Rules (see AGENTS.md §Contracts):
 *  - ADDITIVE changes only (new optional fields, new enum members) without a team ping.
 *  - Renames / removals / type changes need all three tracks to agree first.
 *  - Every JSON file in src/data/ is validated against these schemas by src/data/data.test.ts.
 *
 * Units are in the field names on purpose (massKg, powerW, costM = millions of USD FY2026,
 * c3Km2s2, dvMs = m/s, rateKbps, volumeGb = gigabits). Never store a number without its unit suffix.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provenance — every record says where its numbers came from.
// ---------------------------------------------------------------------------

/** verified = transcribed from the cited source; approx = engineering estimate / placeholder to be verified;
 *  game = deliberately invented or tuned for gameplay balance (must be disclosed in-game). */
export const Confidence = z.enum(['verified', 'approx', 'game']);
export type Confidence = z.infer<typeof Confidence>;

export const Source = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  org: z.string(), // e.g. "NASA JPL SSD", "NASA LSP", "NASA CCMC"
  isNasa: z.boolean(), // true → goes in the submission's "NASA Data" list; false → "Other Data"
  retrieved: z.string(), // ISO date the data was pulled / read
  notes: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

export const GlossaryEntry = z.object({
  term: z.string().min(1),
  short: z.string().min(1),
  long: z.string().min(1),
  sourceId: z.string().min(1),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntry>;

const provenance = {
  sources: z.array(z.string()).default([]), // ids into sources.json
  confidence: Confidence.default('approx'),
  notes: z.string().optional(),
};

// ---------------------------------------------------------------------------
// Enums shared across systems
// ---------------------------------------------------------------------------

export const SlotId = z.enum([
  'power', // solar array type or RTG
  'battery',
  'propulsion',
  'antenna',
  'transmitter',
  'adcs', // attitude determination & control
  'avionics', // command & data handling + recorder
  'thermal',
  'shielding', // radiation vault (optional slot: "none" part exists)
]);
export type SlotId = z.infer<typeof SlotId>;

/** Slots that may be made dual-string (redundant). */
export const RedundantSlotId = z.enum(['avionics', 'adcs', 'transmitter', 'battery']);
export type RedundantSlotId = z.infer<typeof RedundantSlotId>;

export const MeasurementType = z.enum([
  'imaging_context', // wide-angle / medium-res visible imaging
  'imaging_hires', // telescope-class high-resolution imaging
  'vis_ir_spectroscopy', // surface mineralogy, ices
  'uv_spectroscopy', // upper atmosphere, aurora
  'gamma_neutron', // subsurface hydrogen / elemental composition
  'radar_sounding', // subsurface layering / ice
  'laser_altimetry', // topography
  'magnetometry',
  'particles_fields', // plasma, energetic particles
  'mass_spectrometry', // in-situ neutral/ion composition
  'microwave_radiometry', // deep atmosphere water / ammonia
  'gravity_science', // radio science via the comms system
  'thermal_ir', // surface/atmosphere temperature
]);
export type MeasurementType = z.infer<typeof MeasurementType>;

export const CommsBand = z.enum(['X', 'Ka']);
export type CommsBand = z.infer<typeof CommsBand>;

export const MissionClassId = z.enum(['small', 'medium', 'large']);
export type MissionClassId = z.infer<typeof MissionClassId>;

export const MissionPhase = z.enum(['cruise', 'arrival', 'science', 'extended', 'any']);
export type MissionPhase = z.infer<typeof MissionPhase>;

// ---------------------------------------------------------------------------
// Spacecraft parts (one table, slot-specific numbers live in `specs`)
// ---------------------------------------------------------------------------

export const PartSpecs = z.object({
  // power: solar
  solarEfficiency: z.number().min(0).max(1).optional(), // cell efficiency at 1 AU, 28 °C
  solarKgPerM2: z.number().optional(),
  solarCostMPerM2: z.number().optional(),
  solarDegradationPerYear: z.number().optional(), // fractional loss / yr (before destination radiation extra)
  // power: RTG
  rtgBolW: z.number().optional(), // electrical W at beginning of life
  rtgDecayPerYear: z.number().optional(), // fractional loss / yr
  // battery
  batteryWh: z.number().optional(),
  maxDepthOfDischarge: z.number().min(0).max(1).optional(),
  // propulsion
  ispS: z.number().optional(),
  tankFraction: z.number().optional(), // tank + feed mass per kg of propellant
  propulsionKind: z.enum(['monoprop', 'biprop', 'electric']).optional(),
  thrustN: z.number().optional(),
  // antenna
  diameterM: z.number().optional(), // 0 = low-gain only (use fixedGainDbi)
  fixedGainDbi: z.number().optional(), // low-gain / medium-gain antennas with no dish
  apertureEfficiency: z.number().optional(),
  bands: z.array(CommsBand).optional(),
  // transmitter
  rfPowerW: z.number().optional(), // RF output; DC draw = rfPowerW / dcEfficiency (powerW must equal that)
  dcEfficiency: z.number().optional(),
  // adcs
  pointingDeg: z.number().optional(), // 3-sigma pointing accuracy
  // avionics
  radToleranceKrad: z.number().optional(), // total ionizing dose before failures ramp up
  storageGb: z.number().optional(), // onboard recorder, gigabits
  // thermal
  minSolarFluxFraction: z.number().optional(), // below this flux (rel. to 1 AU) the part needs heater power
  heaterWPerAU: z.number().optional(), // extra heater W per AU beyond 1 AU
  // shielding
  doseFactor: z.number().optional(), // multiplies radiation dose received by electronics (vault ≈ 0.1)
});
export type PartSpecs = z.infer<typeof PartSpecs>;

export const Part = z.object({
  id: z.string(),
  slot: SlotId,
  name: z.string(),
  blurb: z.string(), // ≤ 25 words, plain English for a 15-year-old
  heritage: z.string().optional(), // "flew on MRO", "SoA report Table 3-2"
  massKg: z.number().nonnegative(), // fixed hardware mass (solar: fixed mechanism mass; per-m² mass in specs)
  powerW: z.number(), // steady draw while on (W). Generators use 0 here.
  costM: z.number().nonnegative(), // fixed cost (solar: + area × solarCostMPerM2)
  trl: z.number().int().min(1).max(9),
  failureRatePerYear: z.number().nonnegative(), // base λ for a single string, standard assurance
  classes: z.array(MissionClassId).optional(), // restrict availability (e.g. RTG large only)
  specs: PartSpecs.default({}),
  ...provenance,
});
export type Part = z.infer<typeof Part>;

export const Instrument = z.object({
  id: z.string(),
  name: z.string(),
  blurb: z.string(),
  heritage: z.string(), // the real instrument it is modelled on, e.g. "HiRISE on MRO"
  massKg: z.number().nonnegative(),
  powerW: z.number().nonnegative(),
  costM: z.number().nonnegative(),
  trl: z.number().int().min(1).max(9),
  failureRatePerYear: z.number().nonnegative(),
  dataRateKbps: z.number().nonnegative(), // while operating
  dutyCycle: z.number().min(0).max(1), // fraction of science-phase time it operates
  pointingReqDeg: z.number().positive(), // ADCS pointingDeg must be ≤ this or quality is halved
  ifovUrad: z.number().optional(), // imaging only: ground sample distance (m) = altitude(km) × ifovUrad / 1000
  measures: z.array(z.object({ type: MeasurementType, quality: z.number().min(0).max(1) })).min(1),
  classes: z.array(MissionClassId).optional(),
  ...provenance,
});
export type Instrument = z.infer<typeof Instrument>;

// ---------------------------------------------------------------------------
// Destinations, orbits, trajectories, launch vehicles
// ---------------------------------------------------------------------------

export const OrbitOption = z.object({
  id: z.string(),
  name: z.string(),
  blurb: z.string(),
  periapsisAltKm: z.number(),
  apoapsisAltKm: z.number(),
  inclinationDeg: z.number(),
  maintenanceDvMsPerYear: z.number().nonnegative(),
  /** If set, the spacecraft captures into a loose orbit and aerobrakes down to this one:
   *  insertion Δv is computed to `captureApoapsisAltKm` instead, science starts `aerobrakingDays` later. */
  aerobraking: z
    .object({ captureApoapsisAltKm: z.number(), aerobrakingDays: z.number(), riskEventId: z.string().optional() })
    .optional(),
  /** Multiplies instrument quality for a measurement type (e.g. low orbit 1.0 imaging, high orbit 0.6). */
  scienceModifiers: z.partialRecord(MeasurementType, z.number()).default({}),
  eclipseFractionOverride: z.number().min(0).max(1).optional(), // engine computes if absent
  radiationMultiplier: z.number().positive().default(1), // × destination radiationKradPerYear
  dutyCycleMultiplier: z.number().positive().default(1), // × every instrument's duty cycle (e.g. Jupiter: science only near perijove)
  ...provenance,
});
export type OrbitOption = z.infer<typeof OrbitOption>;

export const Destination = z.object({
  id: z.string(), // 'moon' | 'mars' | 'jupiter' | small-body designation
  name: z.string(),
  kind: z.enum(['planet', 'moon', 'small_body']),
  muKm3s2: z.number().positive(), // GM
  radiusKm: z.number().positive(), // mean volumetric radius
  solarDistanceAU: z.number().positive(), // mean distance from the Sun (Moon: 1.0)
  earthDistanceAU: z.object({ min: z.number(), mean: z.number(), max: z.number() }),
  elementsBodyId: z.string().optional(), // key into planetary-elements.json for positions on a date
  horizonsId: z.string().optional(), // JPL Horizons COMMAND id (e.g. '499' Mars) for validation pulls
  radiationKradPerYear: z.number().nonnegative(), // TID behind ~2.5 mm Al in the science orbit
  solarArrayExtraDegradationPerYear: z.number().nonnegative().default(0),
  hasAtmosphere: z.boolean(),
  orbits: z.array(OrbitOption).min(1),
  imageUrl: z.string().optional(), // public/img/... (NASA public-domain imagery, no logos)
  ...provenance,
});
export type Destination = z.infer<typeof Destination>;

export const Trajectory = z.object({
  id: z.string(),
  destinationId: z.string(),
  name: z.string(),
  blurb: z.string(),
  kind: z.enum(['direct', 'gravity_assist', 'lunar_transfer']),
  launchDate: z.string(), // ISO date — nominal (optimal) launch
  launchWindowDays: z.number().positive(), // window length; leaving off-optimal costs C3 (engine rule)
  c3Km2s2: z.number(), // launch energy the launch vehicle must deliver
  dsmDvMs: z.number().nonnegative().default(0), // deep-space manoeuvres the spacecraft must perform
  tcmDvMs: z.number().nonnegative().default(30), // trajectory correction budget
  arrivalVinfKms: z.number().nonnegative(), // hyperbolic excess speed at the destination
  tofDays: z.number().positive(), // launch → arrival
  flybys: z.array(z.object({ bodyId: z.string(), dayOffset: z.number() })).default([]),
  maxSunDistanceAU: z.number().optional(), // for power/thermal worst case during cruise
  minSunDistanceAU: z.number().optional(),
  ...provenance,
});
export type Trajectory = z.infer<typeof Trajectory>;

export const LaunchVehicle = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  blurb: z.string(),
  costM: z.number().positive(),
  reliability: z.number().min(0).max(1), // historical success rate
  fairingDiameterM: z.number().positive(),
  /** Performance curve sampled from the NASA LSP Performance Website: mass deliverable vs C3.
   *  Sorted by ascending c3Km2s2; engine interpolates linearly and returns 0 outside the range. */
  performance: z.array(z.object({ c3Km2s2: z.number(), massKg: z.number().nonnegative() })).min(2),
  classes: z.array(MissionClassId).optional(),
  ...provenance,
});
export type LaunchVehicle = z.infer<typeof LaunchVehicle>;

// ---------------------------------------------------------------------------
// Scenarios & mission classes
// ---------------------------------------------------------------------------

export const MissionClass = z.object({
  id: MissionClassId,
  name: z.string(), // "Small", "Medium", "Large"
  blurb: z.string(),
  inspiredBy: z.string(), // real-world program it is loosely modelled on (text only — no logos)
  costCapM: z.number().positive(), // includes launch + operations in this game
  minReservePct: z.number().min(0).max(100), // review board flags below this
  rtgAllowed: z.boolean(),
  ...provenance,
});
export type MissionClass = z.infer<typeof MissionClass>;

export const ScienceObjective = z.object({
  id: z.string(),
  name: z.string(),
  blurb: z.string(),
  weight: z.number().positive(), // objective weights in a scenario sum to 100
  /** any = one matching measurement is enough; all = every listed measurement needed (quality = min). */
  combine: z.enum(['any', 'all']),
  /** requiredGb = downlinked volume of THIS measurement type for 100% credit (at quality 1.0).
   *  any → credit = max over measurements; all → credit = min over measurements. */
  measurements: z
    .array(z.object({ type: MeasurementType, minQuality: z.number().min(0).max(1), requiredGb: z.number().positive() }))
    .min(1),
  thresholdPct: z.number().min(0).max(100), // "threshold mission" level for this objective
  maxGsdM: z.number().optional(), // imaging objectives: worst acceptable ground sample distance
});
export type ScienceObjective = z.infer<typeof ScienceObjective>;

export const Scenario = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string(),
  briefing: z.string(), // 3–6 sentences, second person, the "Announcement of Opportunity"
  destinationId: z.string(),
  missionClassId: MissionClassId,
  difficulty: z.number().int().min(1).max(3),
  primaryMissionYears: z.number().positive(),
  extendedMissionYears: z.number().nonnegative(),
  objectives: z.array(ScienceObjective).min(1),
  trajectoryIds: z.array(z.string()).min(1),
  launchVehicleIds: z.array(z.string()).min(1),
  instrumentIds: z.array(z.string()).min(1), // the instrument shelf offered in this scenario
  eventIds: z.array(z.string()).default([]), // event deck
  historicalMissionId: z.string(), // "You vs. History" comparison
  imageUrl: z.string().optional(), // relative to the Vite base URL
  priority: z.enum(['P0', 'P1', 'P2']), // build order — see docs/MASTER_PLAN.md
  ...provenance,
});
export type Scenario = z.infer<typeof Scenario>;

// ---------------------------------------------------------------------------
// Events (data-driven: Track B authors cards, Track A interprets effects)
// ---------------------------------------------------------------------------

export const Condition = z.object({
  fact: z.string(), // key into the engine's Facts map, e.g. "design.assurance", "redundant.adcs", "power.kind"
  op: z.enum(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
});
export type Condition = z.infer<typeof Condition>;

export const EffectKind = z.enum([
  'science_pause_days', // no science collected for N days
  'safe_mode_days', // science paused AND downlink limited to engineering data
  'lose_data_gb', // onboard (not yet downlinked) data lost
  'instrument_disable', // target = instrument id or "random"
  'instrument_degrade', // target = instrument id or "random"; value = quality multiplier (0..1)
  'subsystem_fail', // target = SlotId; redundancy absorbs one failure
  'subsystem_degrade', // target = SlotId; value = performance multiplier (0..1)
  'propellant_use_kg',
  'cost_m', // spend $M from reserves (negative = refund)
  'mission_years_delta', // shorten / extend operations
  'dose_krad', // add radiation dose to electronics
  'data_rate_factor', // value multiplies downlink rate for `days` (target = "days:N"; no target = permanent)
  'science_rate_factor', // value multiplies all science data generation from now on (permanent)
  'science_bonus_pct', // add N percentage points to an objective (target = objective id or "all")
  'mission_loss', // ends mission (target = cause text)
]);
export type EffectKind = z.infer<typeof EffectKind>;

export const Effect = z.object({
  kind: EffectKind,
  target: z.string().optional(),
  value: z.number().default(0),
});
export type Effect = z.infer<typeof Effect>;

export const EventCard = z.object({
  id: z.string(),
  title: z.string(),
  narrative: z.string(), // what the flight team sees (2–3 sentences, present tense)
  realStory: z.object({
    mission: z.string(),
    year: z.number().int(),
    summary: z.string(), // what actually happened (1–2 sentences)
    lesson: z.string(), // the engineering lesson (1 sentence)
  }),
  trigger: z.object({
    kind: z.enum(['hazard', 'scheduled', 'space_weather', 'random']),
    subsystem: z.union([SlotId, z.literal('instrument')]).optional(), // hazard: which failure draws this card
    phase: MissionPhase.default('any'),
    probabilityPerYear: z.number().nonnegative().optional(), // random: base rate
    dayOffset: z.number().optional(), // scheduled: days after phase start
    minSeverity: z.string().optional(), // space_weather: e.g. "X1" flare class or SEP
  }),
  conditions: z.array(Condition).default([]), // all must hold for the card to be eligible
  options: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(), // ≤ 6 words, imperative ("Ride it out")
        description: z.string(),
        effects: z.array(Effect).default([]),
        successProbability: z.number().min(0).max(1).optional(), // gamble: effects on success, failureEffects otherwise
        failureEffects: z.array(Effect).default([]),
      }),
    )
    .min(1),
  defaultOptionId: z.string(), // used by auto-policy (Monte Carlo, hindsight replays)
  ...provenance,
});
export type EventCard = z.infer<typeof EventCard>;

/** Snapshot of real solar events (NASA DONKI) replayed during flight. */
export const SpaceWeatherEvent = z.object({
  id: z.string(), // DONKI activity id
  kind: z.enum(['FLR', 'SEP', 'CME', 'GST']),
  time: z.string(), // ISO time
  classType: z.string().optional(), // flares: "X9.3"
  severity: z.number().min(0).max(1), // normalised 0..1 for the engine (Track B defines mapping in DATA_PLAN)
  link: z.string().optional(),
});
export type SpaceWeatherEvent = z.infer<typeof SpaceWeatherEvent>;

// ---------------------------------------------------------------------------
// History, review rules, constants, ephemeris
// ---------------------------------------------------------------------------

export const HistoricalMission = z.object({
  id: z.string(),
  name: z.string(),
  launchYear: z.number().int(),
  destinationId: z.string(),
  summary: z.string(),
  outcome: z.string(),
  funFact: z.string(),
  stats: z.object({
    launchMassKg: z.number(),
    dryMassKg: z.number().optional(),
    powerAtTargetW: z.number().optional(),
    powerSource: z.string().optional(),
    costM: z.number().optional(), // as reported, then-year $M
    costYear: z.number().int().optional(),
    downlinkKbps: z.number().optional(), // typical/max as reported
    instruments: z.number().int().optional(),
    launchVehicle: z.string().optional(),
    primaryMissionYears: z.number().optional(),
    actualOperationsYears: z.number().optional(),
  }),
  imageUrl: z.string().optional(),
  ...provenance,
});
export type HistoricalMission = z.infer<typeof HistoricalMission>;

export const ReviewRule = z.object({
  id: z.string(),
  metric: z.string(), // key the engine computes, e.g. "mass.marginPct", "power.marginPct", "cost.reservePct"
  /** Comparison: value below yellow → yellow; below red → red (for 'min' rules). 'max' rules invert. */
  direction: z.enum(['min', 'max']),
  yellow: z.number(),
  red: z.number(),
  title: z.string(),
  message: z.string(), // shown when not green; may contain {value} and {threshold}
  fixHint: z.string(),
  ...provenance,
});
export type ReviewRule = z.infer<typeof ReviewRule>;

/** Keplerian elements for approximate planet positions (JPL SSD "Approximate Positions of the Planets", Table 1). */
export const PlanetaryElements = z.object({
  bodyId: z.string(), // 'earth' (EM barycenter), 'mars', 'jupiter', ...
  a: z.tuple([z.number(), z.number()]), // [value au, rate au/century]
  e: z.tuple([z.number(), z.number()]),
  I: z.tuple([z.number(), z.number()]), // deg, deg/cy
  L: z.tuple([z.number(), z.number()]), // mean longitude deg, deg/cy
  longPeri: z.tuple([z.number(), z.number()]),
  longNode: z.tuple([z.number(), z.number()]),
});
export type PlanetaryElements = z.infer<typeof PlanetaryElements>;

export const Constants = z.object({
  solarConstantWm2: z.number(),
  g0Ms2: z.number(),
  auKm: z.number(),
  muSunKm3s2: z.number(),
  boltzmannDbW: z.number(), // −228.6 dBW/K/Hz
  bands: z.record(
    z.string(),
    z.object({ freqGHz: z.number(), dsn34GainDbi: z.number(), dsn70GainDbi: z.number(), systemNoiseTempK: z.number(), extraLossDb: z.number() }),
  ),
  linkRequiredEbN0Db: z.number(),
  linkMarginDb: z.number(),
  linkMiscLossDb: z.number(),
  dsnCostPerHourM: z.record(z.string(), z.number()), // { "34m": x, "70m": y } $M per tracking hour
  structureFraction: z.number(), // structure mass per kg of other dry mass
  harnessFraction: z.number(),
  massGrowthByTrl: z.record(z.string(), z.number()), // "9": 0.03 ...
  costWrapFraction: z.record(MissionClassId, z.number()), // systems eng + PM + I&T as fraction of hardware cost
  busBaseMassKg: z.record(MissionClassId, z.number()), // primary structure, mechanisms, cabling core not modelled as parts
  busBaseCostM: z.record(MissionClassId, z.number()),
  disposalDvMs: z.number().nonnegative(), // end-of-mission disposal / planetary-protection burn
  dvMarginPct: z.number().nonnegative(), // added on top of the Δv budget
  opsCostPerYearM: z.record(MissionClassId, z.number()),
  assurance: z.record(z.string(), z.object({ hazardMultiplier: z.number(), costFraction: z.number() })),
  redundancy: z.object({ massMultiplier: z.number(), costMultiplier: z.number(), commonCauseBeta: z.number() }),
  offOptimalC3PerDay: z.number(), // C3 penalty (km²/s²) per day away from optimal launch date
  ...provenance,
});
export type Constants = z.infer<typeof Constants>;
