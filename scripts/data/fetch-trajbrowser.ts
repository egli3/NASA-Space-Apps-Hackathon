/**
 * Snapshot of the NASA Ames Trajectory Browser for the launch windows the game uses.
 * Owner: Track B. Run: `npx tsx scripts/data/fetch-trajbrowser.ts`
 *
 * Posts the search form (custom target list, one-way, minimise ΔV, "all trajectories") and reads the `var segs = {…}`
 * object the page embeds for its own table. Writes `data/raw/trajbrowser/windows.json`. `src/data/trajectories.json`
 * is transcribed from that file by hand, so this script never edits game data.
 *
 * Units in the site's object: T = seconds past J2000, DV = m/s, R = m and V = m/s relative to the body of that event.
 * Keep each query to a two-year launch range: the site answered HTTP 500 for 2028–2032 on 2026-11-15.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = 'https://trajbrowser.arc.nasa.gov/traj_browser.php';
const UA = 'margin-game-data-script';
const OUT = 'data/raw/trajbrowser/windows.json';
const MU_EARTH_M3S2 = 3.986004418e14;
const LEO_RADIUS_M = 6_571_000;

interface Query { id: string; target: string; type: 'rendezvous' | 'flyby'; from: number; to: number; maxYears: number; maxDvKms: number }
const QUERIES: Query[] = [
  { id: 'mars-2028', target: 'Mars', type: 'rendezvous', from: 2028, to: 2030, maxYears: 2, maxDvKms: 7 },
  { id: 'mars-2030', target: 'Mars', type: 'rendezvous', from: 2030, to: 2032, maxYears: 2, maxDvKms: 7 },
  { id: 'jupiter-flyby-2028', target: 'Jupiter', type: 'flyby', from: 2028, to: 2030, maxYears: 4, maxDvKms: 7 },
  { id: 'jupiter-rendezvous-2028', target: 'Jupiter', type: 'rendezvous', from: 2028, to: 2030, maxYears: 6, maxDvKms: 10 },
];

interface Segs { Traj_ID: number[]; SPK_ID: number[]; T: number[]; DV: number[]; RX: number[]; RY: number[]; RZ: number[]; VX: number[]; VY: number[]; VZ: number[] }

const isoDate = (secPastJ2000: number) => new Date(Date.UTC(2000, 0, 1, 12) + secPastJ2000 * 1000).toISOString().slice(0, 10);
const round = (x: number, digits: number) => Number(x.toFixed(digits));

async function run(q: Query) {
  const form = new URLSearchParams({
    chk_maxMag: 'on', maxMag: '25', chk_maxOCC: 'on', maxOCC: '4', chk_target_list: 'on', target_list: q.target,
    mission_class: 'oneway', mission_type: q.type, LD1: String(q.from), LD2: String(q.to),
    maxDT: String(q.maxYears), DTunit: 'yrs', maxDV: String(q.maxDvKms), min: 'DV', wdw_width: '-1', submit: 'Search',
  });
  // The site answers HTTP 500 now and then; a retry a few seconds later usually works.
  let html = '';
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(URL_, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    if (res.ok) { html = await res.text(); break; }
    if (attempt === 4) throw new Error(`${res.status} for ${q.id}`);
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  const message = (html.match(/Query took[^<\r\n]*/) ?? html.match(/Query error[^<\r\n]*/) ?? ['no result message'])[0];
  const m = html.match(/var segs = (\{[\s\S]*?\});/);
  if (!m) return { query: q, message, trajectories: [] };
  const t = JSON.parse(m[1]) as Segs;

  // `segs` lists every event of every trajectory, tagged with its Traj_ID and the body the event is relative to.
  const radius = (i: number) => Math.hypot(t.RX[i], t.RY[i], t.RZ[i]);
  const ids = [...new Set(t.Traj_ID)];
  const trajectories = ids.map((id) => {
    const s = t.Traj_ID.indexOf(id);
    const e = t.Traj_ID.lastIndexOf(id);
    if (Math.abs(radius(s) - LEO_RADIUS_M) > 5000) throw new Error(`Trajectory ${id} does not start in a 200 km Earth orbit`);
    const vCirc = Math.sqrt(MU_EARTH_M3S2 / LEO_RADIUS_M);
    const c3 = ((vCirc + t.DV[s]) ** 2 - 2 * vCirc ** 2) / 1e6;
    const postInjection = t.DV.slice(s + 1, e + 1).reduce((a, b) => a + b, 0);
    // At a rendezvous the last burn slows the spacecraft to exactly escape speed (C3 = 0) at the listed position,
    // so the speed after the burn is the local escape speed and v∞² = (v_esc + Δv)² − v_esc².
    const vAfter = Math.hypot(t.VX[e], t.VY[e], t.VZ[e]);
    return {
      trajId: id,
      route: t.SPK_ID.slice(s, e + 1).join(' → '), // SPK ids: 399 Earth, 10 Sun (deep-space correction), 299 Venus, 499 Mars, 599 Jupiter
      launch: isoDate(t.T[s]),
      arrival: isoDate(t.T[e]),
      durationDays: Math.round((t.T[e] - t.T[s]) / 86400),
      events: e - s + 1, // 4 = direct (injection, small deep-space correction, sphere of influence, arrival)
      injectionC3Km2s2: round(c3, 2),
      injectionDvKms: round(t.DV[s] / 1000, 3),
      postInjectionDvKms: round(postInjection / 1000, 3),
      arrivalBurnDvKms: round(t.DV[e] / 1000, 3),
      eventDays: t.T.slice(s, e + 1).map((x) => Math.round((x - t.T[s]) / 86400)), // days after launch, one per route entry
      eventDvMs: t.DV.slice(s, e + 1).map((x) => Math.round(x)),
      arrivalRadiusKm: Math.round(radius(e) / 1000),
      ...(q.type === 'rendezvous' ? { arrivalVinfKms: round(Math.sqrt((vAfter + t.DV[e]) ** 2 - vAfter ** 2) / 1000, 2) } : {}),
    };
  });
  trajectories.sort((a, b) => a.injectionDvKms + a.postInjectionDvKms - (b.injectionDvKms + b.postInjectionDvKms));
  return { query: q, message, trajectories };
}

async function main() {
  const results = [];
  for (const q of QUERIES) {
    const r = await run(q);
    results.push(r);
    console.log(`\n${q.id}: ${r.message.trim()}`);
    for (const x of r.trajectories)
      console.log(`  ${x.launch} → ${x.arrival}  ${String(x.durationDays).padStart(4)} d  C3 ${String(x.injectionC3Km2s2).padStart(6)}  post-inj ${x.postInjectionDvKms} km/s  route ${x.route}${'arrivalVinfKms' in x ? `  v∞ ${x.arrivalVinfKms}` : ''}`);
    await new Promise((res) => setTimeout(res, 500));
  }
  mkdirSync('data/raw/trajbrowser', { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    source: 'NASA Ames Trajectory Browser (one-way, custom target list, minimise ΔV, show all trajectories)',
    url: URL_,
    retrieved: new Date().toISOString().slice(0, 10),
    notes: 'Sorted by total ΔV, lowest first. C3 is derived from the injection ΔV out of a 200 km circular orbit (radius 6,571 km). arrivalVinfKms is derived from the arrival burn, which the site defines as slowing to escape speed at the listed radius.',
    results,
  }, null, 1) + '\n');
  console.log(`\nWrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
