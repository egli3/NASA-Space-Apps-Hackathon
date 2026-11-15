/**
 * Snapshot of the NASA Launch Services Program Launch Vehicle Performance Website (Performance Query, High Energy).
 * Owner: Track B. Run: `npx tsx scripts/data/fetch-lsp.ts`
 *
 * Asks the site for every vehicle's separated spacecraft mass at each C3 below and writes the raw answers to
 * `data/raw/lsp/performance-query.json`. `src/data/launch-vehicles.json` is transcribed from that file by hand
 * (the curves are short), so this script never edits game data.
 *
 * The site is an ASP.NET form: load Query.aspx, post back the "High Energy" radio button, then post the C3 to
 * Results.aspx. Query.aspx redirects to the home page unless the request carries a Referer from the site.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'https://elvperf.ksc.nasa.gov/Pages/';
const UA = 'margin-game-data-script';
const C3_LIST = [-3, -2, -1.5, -1, 0, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 80, 85, 90, 95, 100];
const OUT = 'data/raw/lsp/performance-query.json';

async function request(url: string, referer: string, form?: Record<string, string>): Promise<string> {
  const res = await fetch(url, {
    method: form ? 'POST' : 'GET',
    headers: {
      'User-Agent': UA,
      Referer: referer,
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.text();
}

const hiddenFields = (html: string): Record<string, string> =>
  Object.fromEntries([...html.matchAll(/<input type="hidden" name="(__[A-Z]+)"[^>]*?value="([^"]*)"/g)].map((m) => [m[1], m[2]]));

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

interface Row { vehicle: string; launchSite: string; massKg: number; fairing: string }

/** One result row = one <tr> holding a vehicle checkbox; cells are: checkbox, name, site, capability, fairing, adapter, rules. */
function parseResults(html: string): Row[] {
  const rows: Row[] = [];
  for (const tr of html.split(/<tr[\s>]/).slice(1)) {
    if (!tr.includes('cbVehicle')) continue;
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
    const massKg = Number(cells[3]);
    if (!cells[1] || !Number.isFinite(massKg)) continue;
    rows.push({ vehicle: cells[1].replace(/\s+\)/g, ')'), launchSite: cells[2], massKg, fairing: cells[4] });
  }
  return rows;
}

async function main() {
  const queryUrl = BASE + 'Query.aspx';
  const first = await request(queryUrl, BASE + 'Default.aspx');
  const highEnergy = await request(queryUrl, queryUrl, {
    ...hiddenFields(first),
    __EVENTTARGET: 'ctl00$cphPageBody$rblOrbit$2',
    __EVENTARGUMENT: '',
    'ctl00$cphPageBody$rblOrbit': 'High Energy',
    'ctl00$cphPageBody$ddlInclination': '0',
    'ctl00$cphPageBody$tbAltitude': '',
  });
  const fields = hiddenFields(highEnergy);
  if (!fields.__PREVIOUSPAGE) throw new Error('The High Energy form did not load; has the site changed?');

  /** vehicle → curve, in the same shape as `performance` in launch-vehicles.json (ascending C3) */
  const vehicles: Record<string, { c3Km2s2: number; massKg: number }[]> = {};
  const details: Record<string, { launchSite: string; fairing: string }> = {};
  for (const c3 of C3_LIST) {
    const html = await request(BASE + 'Results.aspx', queryUrl, {
      ...fields,
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      'ctl00$cphPageBody$rblOrbit': 'High Energy',
      'ctl00$cphPageBody$tbC3': String(c3),
      'ctl00$cphPageBody$btnGenerate': 'Execute',
    });
    const rows = parseResults(html);
    for (const r of rows) {
      (vehicles[r.vehicle] ??= []).push({ c3Km2s2: c3, massKg: r.massKg });
      details[r.vehicle] = { launchSite: r.launchSite, fairing: r.fairing };
    }
    console.log(`C3 ${String(c3).padStart(5)}: ${rows.length} vehicles`);
    await new Promise((r) => setTimeout(r, 400)); // be polite to the server
  }

  mkdirSync('data/raw/lsp', { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    source: 'NASA Launch Services Program Launch Vehicle Performance Website, Performance Query, Orbit Class = High Energy',
    url: queryUrl,
    retrieved: new Date().toISOString().slice(0, 10),
    units: 'separated spacecraft mass in kg at each C3 (km2/s2). A C3 missing for a vehicle means the site did not list that vehicle at that C3.',
    c3Queried: C3_LIST,
    details,
    vehicles,
  }, null, 2) + '\n');
  console.log(`\nWrote ${OUT}`);
  for (const [name, curve] of Object.entries(vehicles))
    console.log(`${name}: ${curve.map((p) => `${p.c3Km2s2}→${p.massKg}`).join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
