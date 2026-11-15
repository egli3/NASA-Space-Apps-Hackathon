# MARGIN: The Space Mission Design Game

**Design it. Fly it. Find out what mattered.**
NASA Space Apps Challenge 2026 · Challenge: *Space Mission Design Game* · Team **Torpid**

▶ **Play:** https://egli3.github.io/NASA-Space-Apps-Hackathon/ (deploys from `main`)

MARGIN puts you in charge of a robotic science mission from proposal to final data. Pick a science goal, build a spacecraft
part by part, choose a rocket and trajectory, defend the design at a Review Board, fly a time-compressed mission full of real
NASA history, and finish with a debrief that replays your mission with one decision changed at a time to show which choices mattered.

## Why it's different
- **Coupled real physics:** rocket equation (the "mass spiral"), inverse-square solar power, a Deep Space Network link budget, patched-conic orbit insertion, radiation dose.
- **Real NASA data with a source on every number:** JPL planetary elements, NASA LSP launch-vehicle performance, Trajectory Browser, DSN 810-005, Small Spacecraft SoA, DONKI solar storms, Lessons Learned.
- **Hindsight debrief:** counterfactual replays with the same random seed attribute your outcome to specific decisions.
- **You vs History:** your spacecraft next to MRO, Juno or Lunar Prospector.
- **Validated:** tests reproduce Juno's Jupiter Orbit Insertion Δv within 5% and match JPL Horizons planet positions.

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck + tests + production build
```

## Project docs
- [Master plan](docs/MASTER_PLAN.md): scope, timeline, team tracks, git workflow
- [Game design spec](docs/GAME_DESIGN.md): every mechanic and formula
- [Data plan](docs/DATA_PLAN.md): NASA sources → JSON, provenance rules
- Track briefs: [A Engine](docs/tracks/TRACK_A_ENGINE.md) · [B Data & Story](docs/tracks/TRACK_B_DATA.md) · [C Interface](docs/tracks/TRACK_C_UI.md)
- [Submission kit](docs/SUBMISSION.md)

## NASA data & resources
Generated from `src/data/sources.json` (`npm run sources:md`):
JPL SSD Approximate Positions of the Planets · JPL Horizons · JPL Small-Body Database · JPL Planetary Physical Parameters ·
NSSDCA Planetary Fact Sheets · NSSDCA Master Catalog · NASA Ames Trajectory Browser · NASA LSP Launch Vehicle Performance Website ·
NASA Small Spacecraft Technology State-of-the-Art Report · DSN Telecommunications Link Design Handbook (810-005) · NASA CCMC DONKI ·
NASA Lessons Learned Information System · NASA Systems Engineering Handbook · NASA Radioisotope Power Systems · NASA Image and Video Library.

All data is baked into static JSON at build time; the game makes no runtime API calls. Each record carries `sources` and a
`confidence` flag: `verified` (transcribed from source), `approx` (engineering estimate), or `game` (tuned for gameplay, disclosed in the Credits screen).
This project uses no NASA logos, insignia or mission patches, and does not imply NASA endorsement.

## Other resources
React, Vite, Tailwind CSS, Zustand, zod, Motion, Vitest (all MIT) · Space Grotesk & JetBrains Mono fonts (SIL OFL) · GitHub Actions & Pages.

## SI disclosure
Super Intelligence (SI) tools were used in this project, as the Space Apps rules require us to disclose:
- **Code & docs:** portions of the source code, tests and documentation were generated with Claude (Anthropic) via Claude Code, then reviewed and edited by the team.
- **Data:** SI helped draft initial approximate values; these are flagged `confidence: "approx"` until verified against the cited NASA source.
- **Images, video, audio:** none are SI-generated. Any future SI-generated media will carry a visible watermark and metadata.

The same disclosure appears in the in-game Credits screen, the `index.html` metadata and `package.json`.
