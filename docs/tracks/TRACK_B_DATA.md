# Track B: Data, Story & Submission ("Science Office")

> **For the AI agent on this track:** you are the science and data lead for MARGIN. Read `AGENTS.md`, `docs/MASTER_PLAN.md`,
> **all of** `docs/DATA_PLAN.md`, and GAME_DESIGN §3–§5 and §7. Your outputs are validated JSON, real-history content,
> and the submission package. Accuracy beats volume: one verified number with a citation is worth ten guesses.

## You own
`src/data/**` (JSON + `index.ts` + `data.test.ts`), `scripts/data/**`, `data/raw/**`, `public/img/**`, `docs/SUBMISSION.md`,
the NASA-data / other-data / SI sections of `README.md`.
**Shared, additive-only:** `src/types/catalog.ts` (if you need a new field, add it as optional and announce `[CONTRACT]`).
**Don't edit:** `src/engine/**`, `src/ui/**`.

## What already exists
- Seed JSON for 3 scenarios (Mars P0, Jupiter P0, Moon P1), 3 destinations, 6 trajectories, 4 launch vehicles, 32 parts,
  14 instruments, 7 event cards, 3 historical missions, 9 review rules, 16 sources, plus constants and JPL planetary elements (verified).
- 2 real DONKI flare records (seed). `data.test.ts` checks schemas and references.
- Most numbers are `confidence: "approx"`. **Your first job is to verify the Mars path.**

## Status
- **M1 done:** launch-vehicle curves (item 1), Mars trajectories (2), Mars destination and DSN gains (3), DONKI snapshot (4).
  Falcon 9 is listed by NASA LSP only up to C3 10, so it cannot fly the late-2030 Mars window (C3 10.2). System noise temperatures stay representative (see `constants.json` notes).
- **M2 done:** 14 event cards (5), Jupiter trajectories and Juno stats (6), Horizons validation data (7).
- **M3:** audited instrument and part heritage, documented modeled fields, checked the Lunar Prospector comparison and lunar transfer analogues, and added 13 sourced glossary entries. Six credited WebPs cover the three destinations and science calls. Added regression tests against the raw Ames and LSP snapshots and the image manifest.
- **M4–M5:** the balance harness reports 17 passes and five existing misses. The MAVEN-like design reaches 64.4% escape and 19.3% total science. The balanced Mars reference reaches 36.0% science. The Juno-like design has 52.8% power margin, and direct flight on Falcon Heavy is feasible without cuts. The seven-slide demo and submission copy are in [SUBMISSION.md](../SUBMISSION.md). Public link testing and form submission are team actions after integration.
- **Judge walkthrough:** all 14 incident cards now link to their own NASA report or mission article. The submission kit walks through the verified Juno-inspired design, and showcase tests exercise review through debrief for all three destinations.
- **UI contract:** `catalog.glossary` is optional. Scenario and destination `imageUrl` values are relative to the Vite base URL. Credit records are in `public/img/credits.json`.
- New scripts: `fetch-lsp.ts` and `fetch-trajbrowser.ts` re-create `data/raw/lsp/performance-query.json` and `data/raw/trajbrowser/windows.json`.

## Tasks

### By M1 (Sat 23:30): Mars numbers verified
1. **Launch vehicles** (`launch-vehicles.json`): on https://elvperf.ksc.nasa.gov/ use Performance Query for Falcon 9, Falcon Heavy (expendable)
   and Vulcan (or the closest listed configuration). Sample C3 = −3, 0, 10, 20, 30, 40, 60, 80, 100 where available. Mark `verified`, cite the
   query settings in `notes`. If a vehicle isn't listed, keep `approx` and say so. Costs: public contract values; cite as non-NASA if needed.
2. **Mars trajectories** (`trajectories.json`): https://trajbrowser.arc.nasa.gov/ → Mars, launch 2028–2031, minimum C3 or Δv.
   Record launch date, C3, TOF, arrival v∞ for the 2028–29 and 2030–31 windows.
3. **Mars destination & DSN constants**: verify μ, R and Earth distances (JPL phys par + NSSDCA fact sheet); DSN 34 m/70 m gains and
   Tsys at X and Ka (810-005 modules 101/104). Update `constants.json` notes with module numbers.
4. **`scripts/data/fetch-donki.ts`** → full `space-weather.json` snapshot (DATA_PLAN §3.1).

### By M2 (Sun 03:00): content for a real flight
5. **Event deck to ≥ 12 cards** (`events.json`), using the idea list in DATA_PLAN §4.5. Each card:
   - `narrative` (present tense, 2–3 sentences, what the flight team sees), 2–3 `options` with real trade-offs, `defaultOptionId` = the prudent choice.
   - `realStory`: mission, year, **two factual sentences**, **one lesson**. Check facts against NSSDCA / mission pages / LLIS.
   - Use only `EffectKind`s that exist; if you need a new one, ask Track A first.
   - Add the card id to each scenario's `eventIds` where it makes sense (e.g. aerobraking only on Mars).
6. **Jupiter**: verify `jupiter-direct-2029` / `jupiter-dveega-2029` (Trajectory Browser + Juno's real profile), Juno stats in `history.json` (NSSDCA 2011-040A).
7. **`scripts/data/fetch-horizons.ts`** → `data/raw/horizons/validation.json` (hand to Track A for tests).

### By M3 (Sun 13:00): depth and polish
8. **Parts & instruments**: check every `heritage` claim and its mass/power/data rate against NSSDCA experiment pages or the SoA report.
   Fix outliers and note sources. Keep `blurb`s ≤ 25 words for a 15-year-old.
9. **Images**: 1 per destination + 1 per scenario card from https://images.nasa.gov/ (public domain, **no logos/insignia/patches**).
   Save ≤ 300 KB WebP/JPG to `public/img/`, add `public/img/credits.json` `[ { file, title, credit, url } ]`, set `imageUrl` fields.
10. **Glossary** (`src/data/glossary.json`: `[ { term, short, long, sourceId } ]`) for the terms in GAME_DESIGN §8. Add the schema to `catalog.ts`
    (optional field on Catalog → announce `[CONTRACT]`) and the loader in `index.ts`.
11. **Moon scenario** check (Lunar Prospector stats, NSSDCA 1998-001A).
12. **`npm run sources:md`** works and the output goes into SUBMISSION.md.

### By M4 → M5 (Sun 17:00 → 21:00): ship it
13. **Balance pass with Track A** (GAME_DESIGN §7): adjust data, not formulas, unless A agrees.
14. **Submission package** (`docs/SUBMISSION.md` has drafts and the checklist): final summary (≤ 1500 chars), project details,
    **30-second demo video** (follow the storyboard; screen-record the deployed build; captions on; upload to YouTube as public or
    unlisted, or Google Drive "anyone with the link"; the link must work with no login, password or permission request), 7-slide backup deck,
    NASA data links, other resources, SI disclosure.
15. **Link check in a private browser window**: game URL, repo, video, slides. Then submit (MASTER_PLAN §6 M5).

## Quality bar
- Never invent a historical fact. If unsure, phrase it conservatively or drop it.
- Never raise a number just to make the game easier. Tune `game`-confidence values (caps, thresholds) instead, and say so in `notes`.
- After every data change: `npm test`. After balance-relevant changes: `npm run balance` and post the table.
