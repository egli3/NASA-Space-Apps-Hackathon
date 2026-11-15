# MARGIN — Data Plan (how NASA data gets into the game)

Owner: **Track B**. Engine and UI consume data only through `src/data/index.ts` → `catalog`.

## 1. Principles (decided)

1. **Bake, don't fetch.** All data ships as static JSON in `src/data/`. The game makes **zero runtime API calls**, so
   the demo can't break, no API keys are needed, it works offline, and the judges' link works forever.
   Fetch scripts in `scripts/data/` refresh snapshots; their raw output is committed in `data/raw/` for provenance.
2. **Every record carries provenance**: `sources: string[]` (ids from `sources.json`) and
   `confidence: "verified" | "approx" | "game"`.
   - `verified`: transcribed from the cited source (note the table/page in `notes`).
   - `approx`: an engineering estimate. **Track B's job is to turn these into `verified` in priority order (§4).**
   - `game`: deliberately tuned for play (cost caps, review thresholds). Disclosed in-game on the Credits screen.
3. **Schemas are law.** `src/types/catalog.ts` (zod) validates every file at load time and in CI (`npm test`).
   `src/data/data.test.ts` adds referential checks. Bad data fails the build. Never weaken a schema to make data pass.
4. **The submission's NASA-data list is generated from `sources.json`** (`npm run sources:md`), so the game and the
   form can never disagree.
5. **Units in field names** (`massKg`, `c3Km2s2`, `dvMs`, `rateKbps`, `requiredGb` = gigabits, `costM` = $M FY2026).

## 2. Dataset map (which NASA resource feeds which game system)

All URLs below were checked reachable on 2026-11-14.

| Game system | NASA source | URL | How we use it | File |
|---|---|---|---|---|
| Planet positions (flight view, Earth distance, conjunctions) | JPL SSD *Approximate Positions of the Planets*, Table 1 | https://ssd.jpl.nasa.gov/planets/approx_pos.html | Keplerian elements + rates → Kepler solver in engine. **Already transcribed, verified.** | `planetary-elements.json` |
| Validation of positions | JPL Horizons API | https://ssd.jpl.nasa.gov/api/horizons.api | Vectors for Earth/Mars/Jupiter on test dates → unit tests (one already in `engine.test.ts`). | `data/raw/horizons/*.json` |
| Planet GM, radius, distances | JPL Planetary Physical Parameters; NSSDCA Planetary Fact Sheets | https://ssd.jpl.nasa.gov/planets/phys_par.html · https://nssdc.gsfc.nasa.gov/planetary/factsheet/ | μ, R, mean/min/max Earth distance, solar irradiance (1361 W/m²). | `destinations.json`, `constants.json` |
| Trajectories (C3, TOF, arrival v∞, DSM, flybys) | NASA Ames Trajectory Browser | https://trajbrowser.arc.nasa.gov/ | Query Mars 2028–29 & 2030–31 windows, Jupiter 2029 direct; record optimum C3/TOF/v∞. ΔV-EGA mirrors Juno's real profile. | `trajectories.json` |
| Launch vehicle capacity vs C3 | NASA LSP Launch Vehicle Performance Website | https://elvperf.ksc.nasa.gov/ | Performance Query → sample ~8 points per vehicle (C3 −3 … 100). Engine interpolates. | `launch-vehicles.json` |
| Component specs (solar cells, batteries, propulsion, ADCS, avionics, comms) | NASA Small Spacecraft Technology State-of-the-Art Report | https://www.nasa.gov/smallsat-institute/sst-soa/ | Efficiency, W/kg, Wh/kg, Isp, pointing accuracy, rad tolerance → part specs. | `parts.json` |
| RTG & RHU | NASA Radioisotope Power Systems Program | https://science.nasa.gov/planetary-science/programs/radioisotope-power-systems/ | MMRTG ≈110 W BOL, ≈45 kg, decay. | `parts.json` |
| DSN link (antenna gain, noise temperature) | DSN Telecommunications Link Design Handbook 810-005 | https://deepspace.jpl.nasa.gov/dsndocs/810-005/ | 34 m BWG and 70 m gains at X/Ka, system noise temperature (modules 101/103/104). | `constants.json` |
| Instruments | NSSDCA Master Catalog (experiment pages); mission pages | https://nssdc.gsfc.nasa.gov/nmc/ | Mass/power/data rate of the real instrument each archetype is modelled on (`heritage`). | `instruments.json` |
| Historical comparison | NSSDCA Master Catalog | https://nssdc.gsfc.nasa.gov/nmc/ | MRO 2005-029A, Juno 2011-040A, Lunar Prospector 1998-001A: launch/dry mass, power, LV. | `history.json` |
| Space weather events | NASA CCMC DONKI web service | https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR (and `/SEP`) | Snapshot FLR + SEP, 2014-01-01 → 2019-12-31; severity mapping (GAME_DESIGN §5.6). **Use this host; `kauai.ccmc…` timed out, and `api.nasa.gov/DONKI` returned 404 on 2026-11-14.** | `space-weather.json` |
| Anomaly event cards | NASA Lessons Learned Information System (LLIS) + NSSDCA mission histories | https://llis.nasa.gov/ | Real anomaly → card narrative, options, `realStory`, lesson. | `events.json` |
| Margins, lifecycle, reviews | NASA Systems Engineering Handbook (SP-2016-6105 Rev 2) | https://www.nasa.gov/reference/systems-engineering-handbook/ | Review-gate framing, TRL, margin philosophy → review rules (thresholds `game`). | `review-rules.json` |
| Asteroid target (P2) | JPL Small-Body Database API | https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=101955 | Orbital elements + GM for Bennu or Psyche. | `destinations.json` |
| Images | NASA Image and Video Library | https://images.nasa.gov/ | Public-domain planet images for scenario cards. **No logos, insignia, mission patches, flags.** | `public/img/*` + `public/img/credits.json` |

## 3. Fetch scripts (Track B writes these; run with `npx tsx scripts/data/<name>.ts`)

All scripts: Node 22 `fetch`, generic User-Agent (`margin-game-data-script`), write raw responses to `data/raw/<source>/`
(committed), then transform into `src/data/*.json`, preserving `sources` and `confidence: "verified"`. Print a diff summary.

1. **`fetch-donki.ts`**: GET `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
   in yearly chunks for 2014–2019, and the same for `/SEP`. Keep M- and X-class flares plus all SEPs. Map to
   `SpaceWeatherEvent` with the severity formula. Write `space-weather.json` as `{ sources, confidence, notes, events[] }`.
2. **`fetch-horizons.ts`**: for bodies 399 (Earth), 499 (Mars), 599 (Jupiter), get vectors at 4 dates/year for 2026–2034:
   `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='499'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='500@10'&START_TIME='2028-01-01'&STOP_TIME='2028-01-02'&STEP_SIZE='1%20d'&VEC_TABLE='2'&OUT_UNITS='KM-S'&CSV_FORMAT='YES'`.
   Parse between `$$SOE` and `$$EOE`. Output `data/raw/horizons/validation.json` → Track A turns it into a table-driven test.
3. **`fetch-sbdb.ts`** (P2): `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=101955&phys-par=1` → elements, GM, diameter.
4. **`fetch-lsp.ts`**: posts the LSP Performance Query form (High Energy) for C3 = -3 … 100 and writes every listed vehicle's
   separated mass to `data/raw/lsp/performance-query.json`. The curves in `launch-vehicles.json` are copied from that file.
5. **`fetch-trajbrowser.ts`**: posts the Trajectory Browser search for the Mars 2028 and 2030 windows and Jupiter 2028-29
   (two-year launch ranges; Jupiter needs the limits raised to 6 years and 10 km/s) and writes `data/raw/trajbrowser/windows.json`
   with launch, arrival, C3, burns and the derived arrival v∞. `trajectories.json` is copied from that file.
6. **`sources-to-markdown.ts`**: prints the NASA list and the other-resources list in submission-form format (already stubbed).

Manual transcription (no API): SoA report, 810-005, NSSDCA pages.
For each, put the exact page/table/figure in the record's `notes`.

## 4. Verification priority (Track B work queue)

1. **Mars blocking path (by M1):** `lv-falcon9`, `lv-vulcan-vc4`, `lv-falcon-heavy` curves; `mars-2028`, `mars-2031` trajectories;
   Mars destination numbers; DSN gains/Tsys in `constants.json`.
2. **Jupiter (by M2):** `jupiter-direct-2029`, `jupiter-dveega-2029`; Jupiter radiation (game-scale; document the reasoning);
   Juno history stats.
3. **DONKI snapshot (by M2).**
4. **Parts & instruments (by M3):** check each `heritage` claim against NSSDCA or the SoA report; fix mass/power/data-rate outliers.
5. **Events (by M3):** ≥ 12 cards, each with a real `realStory` (mission, year, two factual sentences, one lesson). Ideas:
   Galileo high-gain antenna (1991), Mars Polar Lander premature engine cut-off (1999), Genesis parachute (2004),
   Mars Observer propulsion (1993), Kepler wheels (2013), Dawn wheels, Juno valves (2016), MGS aerobraking (1997),
   MRO safe modes, Spirit flash-memory reboot (2004), Voyager 2 antenna mis-pointing and "shout" (2023), DSN over-subscription,
   Lunar Trailblazer loss of contact (2025), CRISM cryocooler end-of-life, Sept-2017 solar storms, Mars solar conjunction.
   Use the `hazard` trigger for hardware cards, `random` for process/software, `scheduled` for phase-tied ones.
6. **Moon scenario (P1).** Lunar Prospector stats; rideshare capacity (keep `game`, explain it in notes).

Confidence rule of thumb: if you can't find a NASA number in 10 minutes, keep `approx`, write what you tried in `notes`,
and move on. The engine and UI are never blocked on verification.

## 5. Adding a new record (checklist)

- [ ] id is kebab-case with a type prefix (`pwr-`, `ins-`, `lv-`, `ev-`, `hist-`, `rr-`).
- [ ] All unit-suffixed fields filled; `blurb` ≤ 25 words, plain English.
- [ ] `sources` reference ids that exist in `sources.json` (add the source first).
- [ ] `confidence` set honestly; `notes` say where exactly the number came from.
- [ ] `npm test` passes (schema + referential checks).
- [ ] If it changes balance, run `npm run balance` (Track A's harness) and tell Track A.

## 6. Branding & licensing rules (non-negotiable)

- **No NASA logos, the "meatball" or "worm", insignia, mission patches or flags** anywhere: UI, images, video, slides, favicon.
  This includes AI-generated imagery (Space Apps rule).
- NASA imagery is generally not copyrighted, but we still credit each image (title, NASA/JPL-Caltech etc., URL) in `public/img/credits.json` and on the Credits screen.
- Mission names (MRO, Juno …) appear only as factual references, never styled as branding.
- Fonts: Space Grotesk and JetBrains Mono (SIL OFL), self-hosted via `@fontsource`. Listed under "Other data".
- If any SI-generated image is used, it must carry a visible "AI-generated" watermark. Default: don't use any.
