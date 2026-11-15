/**
 * Orbital mechanics helpers. Pure functions, SI-ish units noted per function.
 * Owner: Track A.
 */
import type { Destination, OrbitOption, PlanetaryElements } from '../types/catalog';
import type { Vec2 } from '../types/engine';

const DEG = Math.PI / 180;

export function isoToJulianDay(iso: string): number {
  return Date.parse(iso) / 86400000 + 2440587.5;
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);
}

/** Solve Kepler's equation E − e·sinE = M (radians) by Newton iteration. */
export function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/**
 * Heliocentric ecliptic (J2000) position in AU from JPL "Approximate Positions of the Planets" Table 1.
 * Accuracy is ~arcminutes for 1800–2050 — plenty for a game, and validated against JPL Horizons in tests.
 */
export function planetPositionAU(el: PlanetaryElements, iso: string): Vec2 & { z: number } {
  return planetPositionAtJd(el, isoToJulianDay(iso));
}

/** Same as planetPositionAU but from a Julian day number (no date parsing — the flight sim calls this every day). */
export function planetPositionAtJd(el: PlanetaryElements, jd: number): Vec2 & { z: number } {
  const T = (jd - 2451545.0) / 36525;
  // element = value + rate × centuries since J2000 (written out: this runs twice per simulated day)
  const a = el.a[0] + el.a[1] * T, e = el.e[0] + el.e[1] * T, I = (el.I[0] + el.I[1] * T) * DEG;
  const L = el.L[0] + el.L[1] * T, varpi = el.longPeri[0] + el.longPeri[1] * T, Omega = el.longNode[0] + el.longNode[1] * T;
  const omega = (varpi - Omega) * DEG;
  let M = ((L - varpi) % 360 + 540) % 360 - 180; // normalise to [-180, 180)
  M *= DEG;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const O = Omega * DEG;
  const cw = Math.cos(omega), sw = Math.sin(omega), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: sw * sI * xp + cw * sI * yp,
  };
}

/**
 * Orbit-insertion Δv (m/s): from a hyperbolic approach with excess speed vInf to an ellipse with the given periapsis.
 * Δv = sqrt(v∞² + 2μ/rp) − sqrt(μ(2/rp − 1/a)). Validated against Juno's JOI (~542 m/s) in engine.test.ts.
 * With aerobraking the burn only captures into the loose orbit `aerobraking.captureApoapsisAltKm`.
 */
export function insertionDvMs(dest: Destination, orbit: OrbitOption, vInfKms: number): number {
  const mu = dest.muKm3s2;
  const rp = dest.radiusKm + orbit.periapsisAltKm;
  const raAlt = orbit.aerobraking ? orbit.aerobraking.captureApoapsisAltKm : orbit.apoapsisAltKm;
  const ra = dest.radiusKm + raAlt;
  const a = (rp + ra) / 2;
  const vHyp = Math.sqrt(vInfKms * vInfKms + (2 * mu) / rp);
  const vOrb = Math.sqrt(mu * (2 / rp - 1 / a));
  return (vHyp - vOrb) * 1000;
}

export function orbitPeriodS(dest: Destination, orbit: OrbitOption): number {
  const a = dest.radiusKm + (orbit.periapsisAltKm + orbit.apoapsisAltKm) / 2;
  return 2 * Math.PI * Math.sqrt((a * a * a) / dest.muKm3s2);
}

/** Worst-case eclipse (cylindrical shadow, Sun in the orbit plane), minutes per orbit. */
export function eclipseMinutes(dest: Destination, orbit: OrbitOption): number {
  const period = orbitPeriodS(dest, orbit);
  if (orbit.eclipseFractionOverride !== undefined) return (orbit.eclipseFractionOverride * period) / 60;
  const a = dest.radiusKm + (orbit.periapsisAltKm + orbit.apoapsisAltKm) / 2;
  const frac = Math.asin(Math.min(1, dest.radiusKm / a)) / Math.PI;
  return (frac * period) / 60;
}
