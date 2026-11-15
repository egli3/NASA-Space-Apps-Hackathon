/**
 * Engine validation & calibration tests. These double as the "Validity" evidence in our submission:
 * the physics reproduces real NASA mission numbers. Track A owns this file — add a test for every model.
 */
import { describe, expect, it } from 'vitest';
import { catalog } from '../data';
import type { Catalog } from '../types/engine';
import { computeBudgets, defaultDesign, revealGrowth, runHeadless, runReview } from './index';
import horizons from '../../data/raw/horizons/validation.json';
import { insertionDvMs, planetPositionAU, planetPositionAtJd } from './orbits';
import { linkModel, lvCapacityKg } from './budgets';
import { referenceDesigns } from './reference-designs';

const refs = referenceDesigns(catalog);
const ref = (id: string) => refs.find((r) => r.id === id)!.design;

describe('orbital mechanics', () => {
  it('reproduces Juno’s Jupiter Orbit Insertion Δv (~542 m/s) within 5%', () => {
    const jupiter = catalog.destinations.find((d) => d.id === 'jupiter')!;
    const orbit = jupiter.orbits.find((o) => o.id === 'jupiter-polar-53d')!;
    const dv = insertionDvMs(jupiter, orbit, 5.8);
    expect(Math.abs(dv - 542) / 542).toBeLessThan(0.05);
  });

  it('matches a JPL Horizons heliocentric vector for Mars (2028-01-01) within 0.01 AU', () => {
    // Horizons: COMMAND=499, CENTER=500@10, ecliptic J2000, 2028-Jan-01 00:00 TDB → X=1.3397e8 km, Y=-1.5956e8 km
    const mars = catalog.planetaryElements.find((p) => p.bodyId === 'mars')!;
    const p = planetPositionAU(mars, '2028-01-01T00:00:00Z');
    const au = 149597870.7;
    expect(Math.abs(p.x - 1.339705312808529e8 / au)).toBeLessThan(0.01);
    expect(Math.abs(p.y - -1.595613505529681e8 / au)).toBeLessThan(0.01);
  });

  // 108 reference vectors from the JPL Horizons API (scripts/data/fetch-horizons.ts): Earth, Mars and Jupiter every
  // three months over the years our missions fly. The engine uses JPL's approximate Keplerian elements instead.
  for (const body of ['earth', 'mars', 'jupiter']) {
    it(`matches JPL Horizons for ${body} on 36 dates from 2026 to 2034`, () => {
      const el = catalog.planetaryElements.find((p) => p.bodyId === body)!;
      const rows = horizons.rows.filter((r) => r.bodyId === body);
      expect(rows.length).toBe(36);
      let worstAU = 0;
      for (const r of rows) {
        const p = planetPositionAtJd(el, r.jdTdb);
        worstAU = Math.max(worstAU, Math.hypot(p.x - r.xAU, p.y - r.yAU, p.z - r.zAU));
      }
      // Measured: Earth 0.00013 AU, Mars 0.00044 AU, Jupiter 0.0050 AU at worst (Jupiter is perturbed by Saturn).
      expect(worstAU).toBeLessThan(body === 'jupiter' ? 0.01 : 0.001);
    });
  }

  it('interpolates launch vehicle curves and returns 0 beyond the curve', () => {
    const fh = catalog.launchVehicles.find((l) => l.id === 'lv-falcon-heavy')!;
    expect(lvCapacityKg(fh, 22.5)).toBeCloseTo(9622.5, 1); // halfway between the NASA LSP points at C3 20 (10,115 kg) and 25 (9,130 kg)
    expect(lvCapacityKg(fh, 500)).toBe(0);
  });
});

describe('budgets', () => {
  for (const s of catalog.scenarios) {
    it(`default design for ${s.id} produces finite numbers`, () => {
      const d = defaultDesign(catalog, s.id);
      const b = computeBudgets(catalog, d);
      for (const [k, v] of Object.entries(b.metrics)) expect(Number.isFinite(v), k).toBe(true);
      expect(b.mass.wetKg).toBeGreaterThan(0);
      expect(b.cost.totalM).toBeGreaterThan(0);
    });
  }

  it('bigger solar array → more power and more mass (the core trade-off)', () => {
    const d = defaultDesign(catalog, 'jupiter-interior');
    const small = computeBudgets(catalog, { ...d, solarArrayAreaM2: 20 });
    const big = computeBudgets(catalog, { ...d, solarArrayAreaM2: 60 });
    expect(big.power.generatedEolW).toBeGreaterThan(small.power.generatedEolW * 2.5);
    expect(big.mass.wetKg).toBeGreaterThan(small.mass.wetKg);
  });

  it('aerobraking at Mars saves over 1 km/s of insertion Δv', () => {
    const d = defaultDesign(catalog, 'mars-climate');
    const direct = computeBudgets(catalog, { ...d, orbitId: 'mars-low-circular' });
    const aero = computeBudgets(catalog, { ...d, orbitId: 'mars-low-aerobrake' });
    expect(direct.deltaV.totalMs - aero.deltaV.totalMs).toBeGreaterThan(1000);
  });
});

describe('mass: the rocket equation', () => {
  it('wet/dry equals e^(Δv / (Isp·g0)) once tanks are included', () => {
    for (const id of ['mro-like', 'juno-like', 'lunar-prospector-like']) {
      const d = ref(id);
      const b = computeBudgets(catalog, d);
      const isp = catalog.parts.find((p) => p.id === d.parts.propulsion)!.specs.ispS!;
      expect(b.mass.wetKg / b.mass.dryKg).toBeCloseTo(Math.exp(b.deltaV.totalMs / (isp * catalog.constants.g0Ms2)), 9);
      expect(b.mass.wetKg).toBeCloseTo(b.mass.dryKg + b.mass.propellantKg, 9);
    }
  });

  it('the mass spiral: 10 kg more payload costs more than 10 kg at launch', () => {
    const d = ref('juno-like');
    const heavier: Catalog = structuredClone(catalog);
    heavier.instruments.find((i) => i.id === 'ins-mwr')!.massKg += 10;
    const extra = computeBudgets(heavier, d).mass.wetKg - computeBudgets(catalog, d).mass.wetKg;
    expect(extra).toBeGreaterThan(20); // structure + harness + growth + tanks + propellant all follow
  });

  it('"the rocket equation wins": an impossible Δv is a blocker, not NaN', () => {
    const hard: Catalog = structuredClone(catalog);
    hard.trajectories.find((t) => t.id === 'mars-2028')!.dsmDvMs = 12000;
    const b = computeBudgets(hard, defaultDesign(hard, 'mars-climate'));
    expect(b.mass.converged).toBe(false);
    expect(b.feasible).toBe(false);
    expect(b.blockers.some((x) => x.includes('rocket equation'))).toBe(true);
    for (const [k, v] of Object.entries(b.metrics)) expect(Number.isFinite(v), k).toBe(true);
  });

  it('a rocket that cannot reach the C3 at all is a blocker', () => {
    const b = computeBudgets(catalog, { ...ref('juno-like'), trajectoryId: 'jupiter-direct-2029', launchOffsetDays: 300 });
    expect(b.mass.lvCapacityKg).toBe(0);
    expect(b.feasible).toBe(false);
  });
});

describe('power calibration', () => {
  it('Juno-like: 60 m² of triple-junction cells at Jupiter give 400–550 W at end of mission', () => {
    // Juno's ~60 m² arrays made roughly 500 W at Jupiter arrival; sunlight there is 1/27 of Earth's.
    const b = computeBudgets(catalog, ref('juno-like'));
    expect(b.power.source).toBe('solar');
    expect(b.power.generatedEolW).toBeGreaterThan(400);
    expect(b.power.generatedEolW).toBeLessThan(550);
    expect(b.power.generatedBolW).toBeGreaterThan(b.power.generatedEolW);
  });

  it('solar power falls with the square of distance: the same array makes ~11× less at Jupiter than at Mars', () => {
    const mars = computeBudgets(catalog, { ...defaultDesign(catalog, 'mars-climate'), solarArrayAreaM2: 40 });
    const jup = computeBudgets(catalog, { ...defaultDesign(catalog, 'jupiter-interior'), solarArrayAreaM2: 40 });
    const ratio = mars.power.generatedBolW / jup.power.generatedBolW;
    const inverseSquare = (5.203 / 1.524) ** 2; // 11.7
    expect(ratio).toBeGreaterThan(inverseSquare); // plus the low-intensity low-temperature loss beyond 3 AU
    expect(ratio).toBeLessThan(inverseSquare * 1.3);
  });
});

describe('comms calibration (DSN link budget)', () => {
  it('MRO-like (100 W, 3 m dish, X-band, 34 m DSN): megabits from Mars, like the real orbiter', () => {
    // The real MRO returns roughly 0.5–6 Mbps depending on the Earth–Mars distance.
    const d = ref('mro-like');
    const b = computeBudgets(catalog, d);
    expect(b.comms.rateKbpsAtMean).toBeGreaterThan(1000); // 1.52 AU
    expect(b.comms.rateKbpsAtMean).toBeLessThan(6000);
    expect(b.comms.rateKbpsAtMax).toBeGreaterThan(300); // 2.68 AU
    expect(b.comms.rateKbpsAtMax).toBeLessThan(1500);
  });

  it('Juno-like (35 W, 2.5 m dish, X-band, 34 m DSN) at 5.2 AU: 20–120 kbps', () => {
    const b = computeBudgets(catalog, { ...ref('juno-like'), commsBand: 'X' });
    expect(b.comms.rateKbpsAtMean).toBeGreaterThan(20);
    expect(b.comms.rateKbpsAtMean).toBeLessThan(120);
  });

  it('data rate falls with distance² and a 70 m dish is worth ~4× a 34 m one', () => {
    const d = ref('mro-like');
    const link34 = linkModel(catalog, d);
    expect(link34.rateBps(1) / link34.rateBps(2)).toBeCloseTo(4, 6);
    const link70 = linkModel(catalog, { ...d, dsnAperture: '70m' });
    const x = catalog.constants.bands.X; // 810-005 gains: 74.6 − 68.3 = +6.3 dB, i.e. (70 / 34)² within a few percent
    expect(link70.rateBps(2) / link34.rateBps(2)).toBeCloseTo(10 ** ((x.dsn70GainDbi - x.dsn34GainDbi) / 10), 6);
    expect(link70.rateBps(2) / link34.rateBps(2)).toBeGreaterThan(3.8);
    expect(link70.rateBps(2) / link34.rateBps(2)).toBeLessThan(4.6);
  });

  it('Ka-band on a 70 m dish is treated as 34 m (the 70 m antennas have no Ka downlink)', () => {
    const d = { ...ref('juno-like'), commsBand: 'Ka' as const };
    const a = computeBudgets(catalog, { ...d, dsnAperture: '34m' }).comms.rateKbpsAtMean;
    const b = computeBudgets(catalog, { ...d, dsnAperture: '70m' }).comms.rateKbpsAtMean;
    expect(b).toBe(a);
  });

  it('Ka-band beats X-band with fine pointing, and loses badly with coarse pointing', () => {
    const d = ref('juno-like');
    const rate = (band: 'X' | 'Ka', adcs: string) => computeBudgets(catalog, { ...d, commsBand: band, parts: { ...d.parts, adcs } }).comms.rateKbpsAtMean;
    expect(rate('Ka', 'adcs-precision')).toBeGreaterThan(rate('X', 'adcs-precision') * 3);
    expect(rate('Ka', 'adcs-basic')).toBeLessThan(rate('X', 'adcs-basic'));
  });
});

describe('science, radiation & reliability', () => {
  it('an "any" objective is credited by its one covered measurement, and says which', () => {
    const b = computeBudgets(catalog, ref('mro-like')); // radar on board, no gamma/neutron
    const ice = b.science.objectives.find((o) => o.objectiveId === 'mars-ice')!;
    expect(ice.expectedPct).toBeGreaterThan(50);
    expect(ice.reason).toContain('radar_sounding');
    expect(ice.reason).not.toContain('No instrument');
    const escape = b.science.objectives.find((o) => o.objectiveId === 'mars-escape')!;
    expect(escape.expectedPct).toBe(0);
    expect(escape.reason).toContain('No instrument');
  });

  it('expected science is the weighted sum of objective credits', () => {
    const d = ref('juno-like');
    const b = computeBudgets(catalog, d);
    const scenario = catalog.scenarios.find((s) => s.id === d.scenarioId)!;
    const sum = scenario.objectives.reduce((a, o, i) => a + (o.weight * b.science.objectives[i].expectedPct) / 100, 0);
    expect(b.science.expectedPct).toBeCloseTo(sum, 9);
    expect(b.science.expectedPct).toBeLessThanOrEqual(100);
  });

  it('a radiation vault at Jupiter turns a red dose margin green', () => {
    expect(computeBudgets(catalog, ref('juno-no-vault')).radiation.doseMarginPct).toBeLessThan(0);
    expect(computeBudgets(catalog, ref('juno-like')).radiation.doseMarginPct).toBeGreaterThan(100);
  });

  it('redundancy and rigorous assurance each raise reliability; lean assurance lowers it', () => {
    const d = ref('single-string-mars');
    const rel = (x: Partial<typeof d>) => computeBudgets(catalog, { ...d, ...x }).risk.reliabilityPct;
    expect(rel({ redundant: ['avionics', 'adcs', 'transmitter', 'battery'] })).toBeGreaterThan(rel({}));
    expect(rel({ assurance: 'rigorous' })).toBeGreaterThan(rel({}));
    expect(rel({ assurance: 'lean' })).toBeLessThan(rel({}));
  });
});

describe('reality check (revealGrowth)', () => {
  const d = ref('mro-like');

  it('is deterministic for a seed and differs between seeds', () => {
    expect(revealGrowth(catalog, d, 7)).toEqual(revealGrowth(catalog, d, 7));
    expect(revealGrowth(catalog, d, 7).massGrowthKg).not.toBe(revealGrowth(catalog, d, 8).massGrowthKg);
  });

  it('lines add up to the totals, and every line grows by 0.3–1.5× its TRL allowance', () => {
    const b = computeBudgets(catalog, d);
    for (const seed of [1, 2, 3, 99]) {
      const g = revealGrowth(catalog, d, seed);
      expect(g.lines.reduce((a, l) => a + l.massKg, 0)).toBeCloseTo(g.massGrowthKg, 9);
      expect(g.lines.reduce((a, l) => a + l.costM, 0)).toBeCloseTo(g.costGrowthM, 9);
      expect(g.massGrowthKg).toBeGreaterThanOrEqual(0.3 * b.mass.growthAllowanceKg);
      expect(g.massGrowthKg).toBeLessThanOrEqual(1.5 * b.mass.growthAllowanceKg);
      expect(g.reserveRemainingM).toBeCloseTo(b.cost.reserveM - g.costGrowthM, 9);
      expect(g.massAllowanceKg).toBe(b.mass.growthAllowanceKg);
      // growing by less than the allowance improves the mass margin; growing by more eats into it
      expect(g.newMassMarginPct > b.mass.marginPct).toBe(g.massGrowthKg < b.mass.growthAllowanceKg);
    }
  });

  it('descoping an instrument does not re-roll the growth of everything else', () => {
    const before = revealGrowth(catalog, d, 11);
    const after = revealGrowth(catalog, { ...d, instrumentIds: d.instrumentIds.filter((i) => i !== 'ins-hires') }, 11);
    expect(after.lines.find((l) => l.id === 'ins-hires')).toBeUndefined();
    for (const l of after.lines) expect(l).toEqual(before.lines.find((x) => x.id === l.id));
  });

  it('low-TRL hardware grows more than flight-proven hardware', () => {
    const deployable = { ...d, parts: { ...d.parts, antenna: 'ant-hga-50-deploy' } }; // TRL 6 vs TRL 9
    let proven = 0, novel = 0;
    for (let seed = 0; seed < 40; seed++) {
      const a = revealGrowth(catalog, d, seed).lines.find((l) => l.id === 'ant-hga-30')!;
      const b = revealGrowth(catalog, deployable, seed).lines.find((l) => l.id === 'ant-hga-50-deploy')!;
      proven += a.massKg / 38;
      novel += b.massKg / 30;
    }
    expect(novel).toBeGreaterThan(proven * 3);
  });

  it('forces a descope when there is no reserve to pay for cost growth, or no mass margin left', () => {
    expect(revealGrowth(catalog, { ...d, reservePct: 0 }, 5).mustDescope).toBe(true);
    expect(revealGrowth(catalog, d, 5).mustDescope).toBe(false);
    const tight: Catalog = structuredClone(catalog);
    const lv = tight.launchVehicles.find((l) => l.id === d.launchVehicleId)!;
    const wet = computeBudgets(catalog, d).mass.wetKg;
    lv.performance = lv.performance.map((p) => ({ ...p, massKg: wet + 1 })); // designed with 1 kg to spare
    const seeds = Array.from({ length: 40 }, (_, i) => i);
    const descoped = seeds.filter((s) => revealGrowth(tight, d, s).mustDescope).length;
    expect(descoped).toBeGreaterThan(0); // some builds overrun the allowance…
    expect(descoped).toBeLessThan(seeds.length); // …and some come in under it
  });
});

describe('balance harness', () => {
  for (const r of refs)
    it(`reference design "${r.id}" produces finite budgets`, () => {
      const b = computeBudgets(catalog, r.design);
      for (const [k, v] of Object.entries(b.metrics)) expect(Number.isFinite(v), k).toBe(true);
      for (const c of r.checks) expect(typeof c.actual(b, runReview(catalog, r.design))).toBe('string');
    });

  // GAME_DESIGN §7: targets that hold today are locked in, so data tuning cannot quietly break them.
  // The known misses are listed as todo; when a data change fixes one, delete its line here and it becomes a test.
  const KNOWN_MISSES = new Set([
    'juno-like: Power margin 10–40%',
    'juno-direct-fh: Feasible only with cuts (infeasible as-is)',
  ]);
  describe('balance targets (GAME_DESIGN §7)', () => {
    for (const r of refs)
      for (const c of r.checks) {
        const name = `${r.id}: ${c.target}`;
        if (KNOWN_MISSES.has(name)) it.todo(`${name} (needs data tuning with Track B)`);
        else
          it(name, () => {
            const b = computeBudgets(catalog, r.design);
            const review = runReview(catalog, r.design, c.target.includes('Monte Carlo') ? { monteCarloRuns: 50 } : undefined);
            expect(c.pass(b, review), c.actual(b, review)).toBe(true);
          });
      }

    it('the list of known misses has no stale entries', () => {
      const all = new Set(refs.flatMap((r) => r.checks.map((c) => `${r.id}: ${c.target}`)));
      for (const miss of KNOWN_MISSES) expect(all.has(miss), miss).toBe(true);
    });
  });

  it('computeBudgets stays well under 1 ms per call', () => {
    const d = ref('juno-like');
    computeBudgets(catalog, d);
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) computeBudgets(catalog, d);
    expect((performance.now() - t0) / 500).toBeLessThan(1);
  });
});

describe('review & simulation', () => {
  it('review returns one finding per rule', () => {
    const d = defaultDesign(catalog, 'mars-climate');
    const r = runReview(catalog, d);
    expect(r.findings.filter((f) => f.ruleId !== 'blocker').length).toBe(catalog.reviewRules.length);
  });

  it('headless run is deterministic and completes', () => {
    const d = defaultDesign(catalog, 'mars-climate');
    const a = runHeadless(catalog, d, 42);
    const b = runHeadless(catalog, d, 42);
    expect(a.sciencePct).toBe(b.sciencePct);
    expect(a.finalState.ended).toBe(true);
  });
});
