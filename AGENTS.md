# AGENTS.md: rules for every AI coding agent on this repo

You are working on **MARGIN**, a space mission design game for the NASA Space Apps Challenge 2026 (team Torpid).
Three humans each drive one AI agent on one **track**. The deadline is **Sunday 15 Nov 2026, 23:59 EST**, and we submit at 21:00.

## Read first (in this order)
1. `docs/MASTER_PLAN.md`: idea, scope tiers, timeline, team, git workflow.
2. Your track brief: `docs/tracks/TRACK_A_ENGINE.md` | `TRACK_B_DATA.md` | `TRACK_C_UI.md`. **Ask your human which track you are on** if unclear.
3. `docs/GAME_DESIGN.md`: mechanics and formulas (source of truth).
4. `docs/DATA_PLAN.md`: data sources, provenance, verification rules.

## Commands
```
npm install          # once
npm run dev          # local game at http://localhost:5173
npm test             # vitest: data validation + engine tests
npm run check        # typecheck + tests + build. MUST pass before every push
npm run sources:md   # print the NASA-data list for the submission form
```

## Ownership (stay in your lane)
| Path | Owner |
|---|---|
| `src/engine/**`, `scripts/balance/**` | Track A |
| `src/data/**`, `scripts/data/**`, `data/raw/**`, `public/img/**`, `docs/SUBMISSION.md` | Track B |
| `src/ui/**`, `src/store/**`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `index.html`, `public/**` (except img), `vite.config.ts`, `.github/**` | Track C |
| `src/types/**`, `AGENTS.md`, `docs/MASTER_PLAN.md`, `docs/GAME_DESIGN.md`, `package.json` | Shared |

Editing another track's files: only with that human's OK, keep it minimal, and say so in the commit message.

## Contracts (`src/types/**`)
- `catalog.ts` (zod schemas for all JSON), `design.ts` (player choices), `engine.ts` (`EngineApi` + result types).
- **Additive changes only** (new optional fields, new enum members) without a ping. Announce in team chat as `[CONTRACT] <what>`.
- Renames, removals or type changes need agreement from all three tracks first.
- The UI imports the engine **only** via `import { engine } from '../engine'` and data **only** via `import { catalog } from '../data'`.

## Engine rules
- Deterministic: never `Math.random()` in `src/engine`. Use `Rng` named streams (`src/engine/rng.ts`).
- Pure: no DOM, no network, no global mutable state. Units in names (`massKg`, `dvMs`, `costM`).

## Data rules
- Every record has `sources` (ids in `src/data/sources.json`) and `confidence` (`verified` | `approx` | `game`).
- Never invent historical facts. Never use NASA logos, insignia, mission patches or flags. No runtime API calls: data is baked JSON.

## Git
- Trunk-based on `main`. `git pull --rebase` often. Small commits prefixed with the track letter: `A: …`, `B: …`, `C: …`.
- `npm run check` before pushing. Never force-push `main`. CI deploys `main` to GitHub Pages.
- Mark AI-assisted work honestly (Space Apps requires SI disclosure). Keep the README's SI section current.

## When you finish a task
Update the checkbox/status in your track brief if you keep one, run `npm run check`, commit, push, and tell your human
what changed in one or two sentences, including anything another track needs to know.
