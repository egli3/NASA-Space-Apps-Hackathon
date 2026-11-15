/**
 * Engine validation & calibration tests. These double as the "Validity" evidence in our submission:
 * the physics reproduces real NASA mission numbers. Track A owns this file — add a test for every model.
 */
import { describe, expect, it } from 'vitest';
import { catalog } from '../data';
import { computeBudgets, defaultDesign, runHeadless, runReview } from './index';
import { insertionDvMs, planetPositionAU } from './orbits';
import { lvCapacityKg } from './budgets';

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

  it('interpolates launch vehicle curves and returns 0 beyond the curve', () => {
    const fh = catalog.launchVehicles.find((l) => l.id === 'lv-falcon-heavy')!;
    expect(lvCapacityKg(fh, 25)).toBeCloseTo(8800, -2);
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
