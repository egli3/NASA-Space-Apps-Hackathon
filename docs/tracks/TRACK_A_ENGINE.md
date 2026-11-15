# Track A: Engine ("Flight Dynamics")

> **For the AI agent on this track:** you are the engine engineer for MARGIN. Read `AGENTS.md`, `docs/MASTER_PLAN.md`
> §3–§7 and **all of** `docs/GAME_DESIGN.md` first. Then work through the task list below in order, keeping `npm run check` green.
> You write pure TypeScript: no React, no DOM, no `Math.random()`, no network.

## You own
`src/engine/**` (including `*.test.ts`), `scripts/balance/**`.
**Shared, additive-only:** `src/types/**` (announce `[CONTRACT]` changes). **Don't edit:** `src/ui/**`, `src/store/**`, `src/data/*.json` (ask Track B).

## What already exists (engine v0, kickoff)
- `growth.ts`: `revealGrowth` / `realizedBudgets` (Reality Check, §4.7). `reference-designs.ts`: §7 yardsticks for `npm run balance`.
- `budgets.ts`: full `computeBudgets` (Δv, mass spiral, power, battery, comms link budget, science expectation, radiation, reliability, cost, blockers, metrics, explain). Matches GAME_DESIGN §4.
- `orbits.ts`: Kepler solver, planet positions from JPL elements, insertion Δv, eclipse.
- `review.ts`: data-driven review findings. `design.ts`: `defaultDesign`.
- `sim.ts`: **nominal-only** daily sim (phases, positions, downlink, storage, science). `TODO(Track A)` marks every gap.
- `debrief.ts`: headline + You-vs-History rows; hindsight/monte carlo TODO.
- `rng.ts`: seeded named streams. `engine.test.ts`: Juno JOI, Horizons position, LV interpolation, trade-off tests.

## Public API (contract: `src/types/engine.ts` → `EngineApi`)
`defaultDesign`, `computeBudgets`, `runReview`, `revealGrowth`, `createSimulation`, `runHeadless`, `buildDebrief`, all
exported from `src/engine/index.ts` as `engine`. Track C calls only these. Keep signatures stable. Add optional fields freely.

## Tasks

### By M1 (Sat 23:30): trustworthy budgets — ✅ tasks 1–4 done (Sat 20:50)
Notes: rocket equation is now closed-form; `hardwareItems()` / `linkModel()` are shared helpers; reference designs live in
`src/engine/reference-designs.ts`; `npm run balance` shows 16 targets pass, 5 miss (MAVEN-like ×2, Balanced Mars science,
Juno power margin, direct-on-Falcon-Heavy), all of which need data tuning with Track B at M4, not engine changes.

1. **Read and own `budgets.ts`.** Fix anything that disagrees with GAME_DESIGN §4. Keep it < 1 ms per call (it runs on every slider move).
2. **`revealGrowth`** (GAME_DESIGN §4.7): seeded per-part growth, `lines[]` for the UI animation, `mustDescope`.
3. **Calibration tests** (`engine.test.ts`): comms (MRO-like and Juno-like targets in §4.4), power (Juno-like 60 m² TJ at Jupiter ≈ 400–550 W EOL), insertion Δv (already in for Juno), Mars aerobraking saves > 1 km/s (already in).
4. **Balance harness** `scripts/balance/reference-designs.ts` + `npm run balance` (add the script to package.json, telling C since it's in a shared file): prints the table of reference designs from GAME_DESIGN §7 with mass/power/data/cost/science/reliability. Share the output in chat at every milestone.

### By M2 (Sun 03:00): the flight sim comes alive
5. **Hazards** (§5.3): daily per-slot/instrument draws on `hazard:<id>` streams; redundancy absorbs the first failure; default consequences.
6. **Events** (§5.4): the four trigger kinds, conditions over the **Facts** list (implement `facts(state, design)` exactly as listed), at most once per card, one pending at a time; `advance()` stops when pending.
7. **Effects interpreter**: every `EffectKind`; `successProbability` gambles on `gamble:<cardId>`; `cost_m` from reserves; `mission_loss`.
8. **Phase rules**: launch reliability roll, insertion burn roll, aerobraking delay, extended-mission eligibility, propellant use for maintenance, dose accumulation, safe-mode days, science pause.
9. **Space-weather replay** (§5.6) from `catalog.spaceWeather` with a context line naming the real flare.
10. **Tests:** determinism (same seed + decisions → identical result); a lost-mission path; redundancy absorbs a failure; every event card in data can fire in some setup (table-driven).

### By M3 (Sun 13:00): the signature features
11. **Hindsight** (§6.2), including `bestDecision` and the plain-English `explanation` templates. ≤ 300 ms total; if slower, give C a `buildDebriefAsync` that runs in a Web Worker (`src/engine/worker.ts`, Vite worker import).
12. **Outcome/stars** exactly per §6.1. `MissionResult.objectives[].pct` must use the same credit formula as `sciencePct`; fix the v0 approximation in `summarize()`.
13. **Monte Carlo** (§6.3) behind `opts.monteCarloRuns`; wire into `runReview` (`predictedSuccessPct`, `predictedSciencePct`).
14. **Richer `explain[]`**: one entry per gauge (mass, power, battery, Δv, data, cost, radiation, reliability) with `sourceIds`.

### By M4 (Sun 17:00): balance & polish
15. Balance pass with Track B until §7 targets hold, then convert them into tests so they stay true.
16. P1: solar conjunction blackout; P2: Lambert porkchop for Mars (`orbits.ts`), exposing `porkchop(catalog, trajectoryId) → grid`.
17. Performance check: a full `buildDebrief` for Jupiter (longest mission) < 500 ms on a laptop.

## Engineering rules
- Pure functions; inputs are `(catalog, design, seed, decisions)`. No module-level mutable state.
- All randomness via `Rng` named streams so counterfactuals are fair: **never draw from a shared stream in a loop whose length depends on the design.**
- Numbers out of the engine are raw (no rounding); the UI formats.
- Every new model gets a test. Every magic number goes into `constants.json` (ask Track B) or a named constant with a comment.
- Hand off to Track C via the contract types + a short note in chat ("`BudgetReport.metrics` now includes X").

## Hand-offs
- **From B:** verified data; new event cards (you must support every `EffectKind` they use).
- **To C:** stable `EngineApi`; message C whenever a TODO stub becomes real (C may have mocked around it).
- **With B:** balance pass at M3–M4; B writes the copy for Hindsight explanation templates if you want it.
