# MARGIN — Master Plan

**Team Torpid · NASA Space Apps Challenge 2026 · Challenge: _Space Mission Design Game_**
**Submission closes: Sunday 15 Nov 2026, 23:59 local (our clock: EST, UTC−5). We submit by 21:00.**

> Read this file first. Then read `AGENTS.md` (rules), `docs/GAME_DESIGN.md` (what we're building, every formula),
> `docs/DATA_PLAN.md` (where every number comes from), and **your own track brief** in `docs/tracks/`.

---

## 1. The idea in one breath

**MARGIN** is a browser game where you lead a real-style space mission from proposal to final data. You pick a
science goal, build a spacecraft part by part, choose a rocket and trajectory, defend the design at a Review Board,
fly it through a time-compressed mission full of real-world surprises, and finish with a debrief that **replays
your mission with one decision changed at a time** so you can see which choices actually mattered.

Tagline: **"Design it. Fly it. Find out what mattered."**

The name: in spacecraft engineering, *margin* is the difference between surviving a surprise and losing the
mission. Every kilogram, watt, bit and dollar of margin is a decision you make.

## 2. Why this wins (judging criteria → our answer)

| Criterion | How MARGIN scores |
|---|---|
| **Impact** | Students rarely get to feel how mission trade-offs are *coupled*. In MARGIN they emerge from real physics, so the lessons carry over to the real thing. The Hindsight debrief turns every play into a lesson about cause and effect. Free, runs in any browser, no install. |
| **Creativity** | Three ideas we haven't seen elsewhere: (1) **Hindsight**, which replays your mission with each choice changed, using the same random seed; (2) **real NASA history as gameplay**: event cards are real anomalies (Mars Climate Orbiter, Galileo's antenna, Juno's valves) and solar storms are replayed from NASA's DONKI archive; (3) **You vs. History**: your design next to the real NASA mission that attempted the same science. |
| **Validity** | Coupled, real-world models: rocket equation (the "mass spiral"), inverse-square solar power, a real DSN link budget, orbit-insertion Δv from patched conics, and TRL-based mass growth. Calibrated against real missions with automated tests: Juno's insertion Δv is within 5%, and planet positions match JPL Horizons. Every number in the game links to its NASA source. |
| **Relevance** | Hits every noun in the challenge: objectives, spacecraft design, instruments, launch vehicles, budgets, power, mass, comms, orbital constraints, and design → manage → simulate → evaluate. |
| **Presentation** | Three distinct visual moods (blueprint → mission control → report). A 30-second demo storyboard is pre-written (`docs/SUBMISSION.md`). |

## 3. The game loop (what the player does)

```
Title → Choose a Science Call (scenario) → Briefing
  → DESIGN STUDIO  (instruments, 9 subsystem slots, redundancy, assurance, reserves, orbit)   ← live budgets + ripple chips
  → LAUNCH         (rocket, trajectory, launch-date offset)                                    ← capacity vs C3
  → REVIEW BOARD   (green/yellow/red findings, predicted success)  ── fix ↺ or accept risk
  → REALITY CHECK  (seeded mass & cost growth by TRL → descope if needed)
  → FLIGHT         (time-compressed mission control; event cards with decisions)
  → DEBRIEF        (outcome, stars, objectives, Hindsight top-3, You vs History, Monte Carlo) → Try again ↺
```

Scenarios (build order):
1. **P0 – Red Planet Detective** (Mars, Medium class, $800M cap). The flagship and the demo scenario.
2. **P0 – Giant's Heart** (Jupiter, Large class, $1.3B cap). Solar vs RTG, radiation vault, gravity assist, comms at 5 AU.
3. **P1 – Lunar Ice Prospector** (Moon, Small class, $175M cap). The tutorial: rideshare mass limits, cheap parts.
4. **P2 – Asteroid rendezvous** (JPL SBDB target, ion propulsion). Only if everything else is done.

## 4. Scope tiers (decided now, so nobody argues at 3 a.m.)

**P0 = must ship (demo depends on it)**
- Mars + Jupiter scenarios fully playable end to end.
- Design Studio: all 9 slots, instrument shelf, solar area slider, band, redundancy, assurance, reserves, orbit, DSN hours/aperture.
- Live budgets: mass, power, Δv, comms/data, cost, radiation, science coverage, reliability. Blockers + margins.
- Launch: vehicle capacity at C3, 2 trajectories per scenario, launch-date offset.
- Review Board with data-driven rules.
- Reality check (growth reveal) + descope prompt.
- Flight sim: phases, positions (JPL elements), downlink/storage, events with decisions, mission loss.
- Debrief: outcome + 3 stars, objective bars, **Hindsight top 3**, **You vs History**.
- Source tooltips ("ⓘ NASA source") on every budget number; Credits screen with all sources + SI disclosure.
- Deployed on GitHub Pages; works in Chrome/Edge/Firefox desktop.

**P1 = should ship**
- Moon tutorial scenario with coach marks.
- Monte Carlo: "your design succeeds in 41 of 50 alternate universes" (Review Board + Debrief).
- Ripple chips (animated cause → effect deltas) and spacecraft schematic that grows with choices.
- Real DONKI solar-storm replay (date-shifted) with flare class shown on the card.
- Sound (UI blips, launch rumble). Mobile-friendly layout.

**P2 = only if ahead**
- Porkchop plot (Lambert solver over JPL elements) for Mars launch dates.
- Asteroid scenario (SBDB) with ion propulsion.
- Shareable mission patch (procedural SVG, no NASA insignia) + share URL of the design.

**Cut order if behind:** P2 all → sound → Monte Carlo → Moon scenario → ripple chips → Jupiter extras (14-day orbit, vault).
**Never cut:** Mars end-to-end, Hindsight, You vs History, source tooltips, deploy.

## 5. Team & tracks (one human + one AI per track)

| Track | Codename | Owns (folders) | Mission |
|---|---|---|---|
| **A: Engine** | *Flight Dynamics* | `src/engine/**`, `src/engine/*.test.ts`, `scripts/balance/**` | All physics, budgets, review, flight sim, events interpreter, Hindsight, Monte Carlo, calibration tests. Pure TypeScript, no React. |
| **B: Data & Story** | *Science Office* | `src/data/**`, `scripts/data/**`, `data/raw/**`, `public/img/**`, `docs/SUBMISSION.md`, `README.md` (NASA data + SI sections) | Turn NASA sources into validated JSON. Write event cards from real history. Verify every `approx` value. Own the submission package (text, demo video, slides, links). Lead playtesting/balance with A. |
| **C: Interface** | *Mission Control* | `src/ui/**`, `src/store/**`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `index.html`, `public/**` (except img), `vite.config.ts`, `.github/**` | Every screen, interaction, animation, visual design, accessibility, deploy pipeline. |
| **Shared** | (none) | `src/types/**`, `AGENTS.md`, `docs/MASTER_PLAN.md`, `docs/GAME_DESIGN.md`, `package.json` | Contracts and plan. Additive changes only without a ping (see AGENTS.md §Contracts). |

Assign people to tracks at kickoff: put the strongest TypeScript/maths person on A, the most careful researcher
and writer on B, and the person with the best eye for UI on C. Write the names here:

- Track A: `__________`
- Track B: `__________`
- Track C: `__________`

## 6. Timeline (EST, UTC−5). Milestones are integration points: everyone merges, plays the deployed build, re-plans.

| When | Milestone | Definition of done (all must be true) |
|---|---|---|
| **Sat 20:30–21:00** | **M0 Kickoff** | Everyone has cloned, `npm install`, `npm run dev` shows the title screen, `npm run check` passes. Repo owner has enabled Pages (Settings → Pages → Source: **GitHub Actions**). Names written in §5. |
| **Sat 23:30** | **M1 Walking skeleton** | Every screen exists and is reachable with real data. Design Studio shows live budgets from the engine. Mars data has been checked against sources (no `approx` left in LV curves / trajectories for Mars). The deployed URL works. |
| **Sun 03:00** | **M2 Core loop** | Mars is playable end to end: design → launch → review → flight with ≥5 events and decisions → debrief with outcome and stars. CI green. **Then sleep.** |
| **Sun 03:00–08:30** | Sleep | At least 5 h each. No solo heroics on shared contracts while others sleep. |
| **Sun 13:00** | **M3 Feature complete** | Jupiter playable. Hindsight + You vs History + growth reveal + source tooltips + Credits working. ≥12 event cards. |
| **Sun 17:00** | **M4 Feature freeze** | P1 items that made it are in; balance pass done (reference designs hit targets in GAME_DESIGN §7). **After 17:00, only bug fixes and copy.** |
| **Sun 19:00** | Demo assets | 30 s video recorded and uploaded (public, no login); slides (≤7) as a backup. |
| **Sun 21:00** | **M5 Submit** | Form filled in, every link tested in a private window, **Submit for Judging** clicked. |
| Sun 23:59 | Hard deadline | (2 h 59 min of buffer we hope not to use) |

Standups: 10 minutes at each milestone. Each track answers: what's merged, what's blocked, what's next.
Use the deployed build, not localhost.

## 7. How we integrate (git & GitHub)

- Repo: `https://github.com/egli3/NASA-Space-Apps-Hackathon` (public, which judges need).
- Live game (after Pages is enabled): `https://egli3.github.io/NASA-Space-Apps-Hackathon/`
- **Trunk-based on `main`.** Folders are owned per track, so conflicts are rare. Workflow:
  1. `git pull --rebase` before starting any task and at least every 45 minutes.
  2. Small commits, prefixed by track: `A: link budget pointing loss`, `B: verify LSP Falcon 9 curve`, `C: review board screen`.
  3. `npm run check` (typecheck + tests + build) **before every push**. CI runs the same on GitHub and deploys `main`.
  4. Push rejected? `git pull --rebase`, re-run check, push. **Never force-push `main`.**
- If you must touch a file another track owns: message them first, keep the change tiny, mention it in the commit.
- Contract changes (`src/types/**`): announce `[CONTRACT] …` in team chat. Additive changes only, unless all three agree.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Running out of time | Scope tiers + cut order fixed above; feature freeze 17:00; submit at 21:00. |
| Engine and UI drift apart | Frozen contracts in `src/types`; engine v0 already returns real numbers; UI imports only `engine` from `src/engine/index.ts`. |
| A NASA site is slow or down during the event | All data is baked into JSON in the repo, so there are zero runtime API calls. The fetch scripts are only for refreshing. |
| Numbers look wrong to a judge | Calibration tests against Juno/MRO/Lunar Prospector, `confidence` flag on every record, values tuned for play are disclosed in-game. |
| Breaking NASA branding rules | No NASA logos, insignia, mission patches or flags anywhere, including AI-generated art. Only public-domain NASA imagery, credited. |
| SI disclosure | README + in-game Credits + `index.html` meta + package.json description say what was SI-assisted. We avoid SI images; if any are used they carry a visible "AI-generated" watermark. |
| Pages not enabled / deploy fails | Track C verifies deploy at M1. Fallback: Netlify Drop / Vercel from `dist/` (public link, no login). |

## 9. Definition of "done" for the whole project

- [ ] A judge can open one public link and finish a Mars mission in < 10 minutes without instructions.
- [ ] Every number on the Design screen has a "Why?" with formula and source.
- [ ] Debrief shows the 3 decisions that mattered most, with plain-English explanations.
- [ ] README has: pitch, play link, how to run, NASA data list, other resources, SI disclosure, credits.
- [ ] Submission form complete: name, ≤1500-char summary, details, demo link (≤30 s or ≤7 slides), project link, NASA data links, other data links, SI options ticked.
