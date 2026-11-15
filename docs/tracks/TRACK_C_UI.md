# Track C: Interface ("Mission Control")

> **For the AI agent on this track:** you are the front-end engineer and visual designer for MARGIN. Read `AGENTS.md`,
> `docs/MASTER_PLAN.md`, and GAME_DESIGN §2, §3, §8 carefully (they are your spec), then skim §4–§6 so you know what
> the numbers mean. The UI **never computes physics**: it calls `engine.*` and renders the results.

## Status (updated Sun 15 Nov)
- **Done:** tasks 1–17 except the social preview image. All ten screens are real and wired to the engine: live budgets with
  "Why?" popovers, ripple chips, spacecraft schematic, launch, review board (with the 50-run prediction via `runReviewAsync`),
  reality check with descope picker, flight (map, telemetry, real event cards, "what really happened"), debrief (Hindsight
  cards, "everything we tried" table, Monte Carlo histogram, You vs History), credits, first-visit coach marks, favicon.
  Deployed and loading at the Pages URL.
- **Not done:** sound (18, optional), social preview image (17), mobile layout below 1024 px.
- **For other tracks:** `?mockEvents` in the URL deals placeholder cards for UI testing only; it is never on by default.
  Destination `imageUrl` is not used: planets are drawn as vector globes, so Track B does not need to ship planet photos.
  The debrief shows `Debrief.explored` and `monteCarlo.sciencePcts` when present.
- **Design system:** tokens and the three moods live in `src/index.css`; shared pieces in `src/ui/common/`. The hatched
  `MarginBar` is the signature mark: use it wherever something is "need versus have".

## You own
`src/ui/**`, `src/store/**`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `index.html`, `public/**` (except `public/img`),
`vite.config.ts`, `.github/**`, `package.json` dependencies (tell others when you add one).
**Don't edit:** `src/engine/**`, `src/data/**`. Need something from the engine? Ask Track A or mock it locally in `src/ui/mocks/`.

## Stack (decided)
React 19 + TypeScript + Vite 8 · Tailwind CSS v4 (`@theme` tokens in `src/index.css`) · Zustand (`src/store/game.ts`) ·
`motion` for animation · plain SVG for the schematic, gauges, solar-system view and charts (no chart library needed;
add `recharts` only if the debrief histogram is painful). Fonts: `@fontsource/space-grotesk`, `@fontsource/jetbrains-mono`.
No router: `screen` in the store is the router (GitHub Pages friendly).

## What already exists
`App.tsx` with a screen switch, a Title screen, Scenario cards, a **Design stub** wired to `engine.computeBudgets`, and placeholders.
Store with `startScenario`, `updateDesign`, `finishFlight`, `retry`. CI + Pages workflow in `.github/workflows/deploy.yml`.

## Folder layout to create
```
src/ui/
  screens/   Title.tsx ScenarioSelect.tsx Briefing.tsx DesignStudio.tsx Launch.tsx ReviewBoard.tsx RealityCheck.tsx Flight.tsx Debrief.tsx Credits.tsx
  design/    SlotTabs.tsx PartCard.tsx InstrumentShelf.tsx BudgetPanel.tsx Gauge.tsx WhyPopover.tsx RippleChips.tsx SpacecraftSchematic.tsx
  flight/    SolarSystemView.tsx Telemetry.tsx TimeControls.tsx EventModal.tsx RealStoryCard.tsx LogFeed.tsx
  debrief/   OutcomeHeader.tsx ObjectiveBars.tsx HindsightCards.tsx HistoryTable.tsx MonteCarloStrip.tsx
  common/    Button.tsx Card.tsx Stat.tsx SourceLink.tsx format.ts
```

## Tasks

### By M1 (Sat 23:30): walking skeleton, deployed
1. **Deploy first**: push, confirm the GitHub Action deploys and the Pages URL loads (assets resolve under `/NASA-Space-Apps-Hackathon/`).
   If Pages isn't enabled, ask the repo owner (Settings → Pages → Source: GitHub Actions).
2. Screens 0–5 real (Title → Science Call → Briefing → **Design Studio** → **Launch** → **Review Board**), the rest placeholders.
3. **Design Studio v1**: slot tabs with part cards (name, blurb, mass/power/cost/TRL chips, class-restricted parts hidden), instrument shelf
   (toggle on/off), solar-area slider (only for solar parts), band toggle, redundancy toggles, assurance segmented control, reserve slider,
   orbit cards, DSN aperture + hours. **BudgetPanel** with 8 gauges coloured by the review-rule thresholds (read `catalog.reviewRules`).
   Blockers listed in red. `computeBudgets` is fast; call it in `useMemo` on every change.
4. **Launch**: trajectory cards + launch-offset slider + rocket cards with a capacity bar at the design's C3 vs wet mass.
5. **Review Board**: list `runReview()` findings (sorted red → yellow → green), "Back to design" / "Proceed" (disabled while any red).

### By M2 (Sun 03:00): fly it
6. **Flight screen**: `engine.createSimulation(catalog, design, seed)`. A `requestAnimationFrame` loop calls `sim.advance(k)` with
   k = days per frame from the speed setting; pause when `pending`. **SolarSystemView**: SVG, Sun at centre, log-ish radial scale so
   Earth, Mars and Jupiter all fit (r_px = 40·log2(1 + r_AU/0.3) works), planets from `state.earth`/`state.target`, spacecraft + fading trail.
   Telemetry, time controls, LogFeed, and **EventModal** (narrative, context lines, options → `sim.decide(id)`) followed by **RealStoryCard**.
7. **Reality Check** screen from `engine.revealGrowth()` (animated lines; if `mustDescope`, inline instrument/rocket picker).
8. **Debrief v1**: outcome header + stars + objective bars + history table. Call `useGame.finishFlight(result, decisions)` at mission end
   (`engine.runHeadless` isn't needed: build the `MissionResult` from the live sim via the store helper; ask A to export `summarize`).

### By M3 (Sun 13:00): make it shine
9. **HindsightCards** (top 3 "If you had…" + "Your best call"): the signature moment, so give it motion and clear numbers.
10. **WhyPopover** on every gauge: `explain[]` text + formula + **SourceLink** (`catalog.sources` → "ⓘ NASA JPL …", opens in a new tab).
11. **SpacecraftSchematic** (SVG): bus box sized by dry mass; solar wings with area ∝ m²; dish diameter ∝ antenna; tanks ∝ propellant;
    small icons for instruments; vault box if shielded; doubled boxes for redundancy. Animate size changes. Blueprint style.
12. **Credits** screen: sources grouped NASA / other; image credits; fonts/libraries; SI disclosure text from README; "values marked *game* are tuned for play".
13. Visual moods per GAME_DESIGN §2 (blueprint / mission control / report). Self-host fonts.

### By M4 (Sun 17:00): P1 and polish
14. **RippleChips** (diff two `BudgetReport`s, GAME_DESIGN §2). Monte Carlo strip on Review Board and Debrief if A ships it.
15. Moon tutorial coach marks (3–5 tooltips on first visit; remember dismissal in `localStorage` with try/catch).
16. Responsive down to 1024 px wide (desktop is the priority); keyboard focus states; colour + icon (not colour alone) for red/yellow/green.
17. Favicon (generic rocket/orbit glyph, **not NASA insignia**), `<title>`, social preview image.
18. Optional sound: tiny UI clicks + launch rumble, muted by default with a toggle.

## UX rules
- First-time player finishes Mars in < 10 minutes. Every screen has exactly one primary button.
- Numbers: `format.ts` (kg with thousands separators, W, kbps/Mbps auto-scaling, $M, %) and consistent units everywhere.
- Never block on the engine: if a TODO stub returns empty arrays (e.g. hindsight), render a graceful "coming soon" state.
- Don't put physics in components. If you need a derived number the engine doesn't provide, ask Track A to add it to `BudgetReport`.
- Demo-friendliness: big type, high contrast, hover popovers that also work on click.
