# Submission kit (owner: Track B; everyone reviews at 19:00 Sunday)

Form fields from the Space Apps project page, with drafts. Update the drafts as features land; **don't claim features that didn't ship.**

## Project Name
**MARGIN: The Space Mission Design Game**

## Summary (≤ 1500 characters; 50–200 words suggested)
> MARGIN is a free browser game that puts you in charge of a space mission from proposal to final data. Pick a science goal
> (Mars's lost water, Jupiter's hidden core, or ice in the Moon's shadows), then build a spacecraft part by part: instruments, solar
> arrays or nuclear power, antennas, engines, computers and shielding. Every choice ripples through real physics. A bigger dish
> adds mass; through the rocket equation, mass adds propellant; and suddenly you need a bigger rocket you can't afford. Choose a launch
> vehicle using NASA Launch Services Program performance data and a trajectory, defend your design before a Review Board, then fly a
> time-compressed mission that throws real anomalies from NASA history at you, along with real solar storms replayed from NASA's DONKI
> archive. The debrief replays your mission with one decision changed at a time to show which choices actually mattered, and
> compares your spacecraft with the real NASA mission that attempted the same science. Every number in the game links to its NASA source.

(~170 words, ~1,150 characters. Re-count before pasting.)

## Project Demonstration (≤ 30 s video **or** ≤ 7 slides; public link, no login)
**Video storyboard (30 s, 1080p, screen capture of the deployed build, burned-in captions, no music with copyright):**
| t | Shot | Caption |
|---|---|---|
| 0–3 s | Title screen, logo animates | "MARGIN: design a real space mission" |
| 3–10 s | Design Studio, Jupiter: drag solar array 20→60 m²; gauges ripple, tanks swell in the schematic | "Every choice ripples through real physics" |
| 10–14 s | Review Board flags RED radiation; add the vault; turns green | "Defend it at the Review Board" |
| 14–22 s | Flight at 100×: Earth flyby; solar-storm card "Based on a real X9.3 flare (NASA DONKI, 2017)"; pick an option; "What really happened" card | "Fly it through real NASA history" |
| 22–28 s | Debrief: ★★☆, Hindsight card "A 2.5 m dish would have returned +18% science", You vs Juno table | "Find out what mattered" |
| 28–30 s | URL on screen | "Real NASA data. Play free: egli3.github.io/NASA-Space-Apps-Hackathon" |

**Backup slides (7 max):** 1 Title + one-line pitch · 2 The problem (trade-offs stay abstract) · 3 The loop (design → launch → review → fly → debrief) ·
4 Real physics + calibration (Juno insertion within 5%, planet positions vs JPL Horizons) · 5 Real NASA data map (sources) · 6 Hindsight + You vs History screenshots · 7 Impact, future work, link.

Demo link: `__________` (YouTube public or unlisted, or Google Drive "anyone with the link". **Test it in a private window.**)

## Project (public link)
- Game: https://egli3.github.io/NASA-Space-Apps-Hackathon/
- Code: https://github.com/egli3/NASA-Space-Apps-Hackathon

## Project Details (long form; edit to match what shipped)
**What it does.** MARGIN simulates the full life of a robotic science mission in about 10 minutes: a science call with weighted
objectives and a cost cap; a Design Studio with 9 subsystem slots plus an instrument shelf, redundancy, testing level and budget
reserves; launch vehicle and trajectory selection; a Review Board gate; a pre-launch "reality check" where parts grow heavier according
to their technology readiness; a time-compressed flight with event cards; and a debrief with outcome, stars, counterfactual "Hindsight"
analysis and a comparison with a historical NASA mission.

**How it works.** A deterministic TypeScript engine computes coupled budgets on every change: Δv (patched-conic orbit insertion),
mass (rocket equation with tank mass, which produces the "mass spiral"), power (inverse-square solar flux with degradation, or RTG decay),
battery through eclipse, a Deep Space Network link budget (antenna gain, pointing loss, free-space loss, DSN 34 m/70 m), science return
(instrument quality × orbit × pointing × resolution × downlinked volume), radiation dose versus avionics tolerance, reliability with
redundancy, and cost. The flight simulator steps daily, uses JPL Keplerian elements for planet positions, and draws hazards and
events from seeded random streams. Because the streams are seeded, the debrief can re-fly your exact mission with one decision changed
and attribute success or failure to specific choices.

**Validity.** Automated tests check the physics against reality: Juno's Jupiter Orbit Insertion Δv (≈542 m/s) is reproduced within 5%, and
Mars's position is checked against JPL Horizons. Every data record carries its source and a confidence flag (verified / approx / game),
and the values tuned for gameplay are disclosed in-game.

**Benefits & impact.** Students see why real missions look the way they do: why Juno needed 60 m² of solar panels and a titanium vault,
why MRO aerobraked, and why reserves and redundancy exist. It's free, needs no install, and every screen teaches with plain-language
"Why?" explanations and real stories from NASA's lessons learned.

**Tools.** TypeScript, React, Vite, Tailwind CSS, Zustand, zod, Vitest, GitHub Actions, GitHub Pages.

**Creativity.** Counterfactual Hindsight replays; NASA anomalies and DONKI solar storms as gameplay; You vs History.

**Factors considered.** Accuracy versus fun (physics is real, balance knobs are labelled); a 10-minute first play; accessibility (colour + icon
status, keyboard); NASA branding rules (no logos or insignia); zero runtime dependencies on external APIs.

**Future work.** Landers and entry/descent/landing, porkchop launch-window plots, asteroid missions with electric propulsion, classroom mode with shared seeds.

## Use of Super Intelligence (SI): select in the form
- [x] Code: SI tools (Claude by Anthropic, via Claude Code) generated portions of the source code, tests and documentation; the team reviewed and edited them.
- [x] Data: SI helped draft approximate seed values; each is flagged `confidence: "approx"` until verified against the cited NASA source.
- [ ] Images / video / audio: none SI-generated. (If that changes: visible "AI-generated" watermark + metadata.)
Disclosure locations: README "SI disclosure", in-game Credits screen, `index.html` meta, `package.json` description.

## NASA Data (form: Link Text + URL), generated by `npm run sources:md`
Paste the output here before submitting. The current list (from `src/data/sources.json`):
- JPL SSD Approximate Positions of the Planets: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- JPL Horizons System: https://ssd.jpl.nasa.gov/horizons/
- JPL Small-Body Database API: https://ssd-api.jpl.nasa.gov/doc/sbdb.html
- JPL Planetary Physical Parameters: https://ssd.jpl.nasa.gov/planets/phys_par.html
- NSSDCA Planetary Fact Sheets: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- NSSDCA Master Catalog: https://nssdc.gsfc.nasa.gov/nmc/
- NASA Ames Trajectory Browser: https://trajbrowser.arc.nasa.gov/
- NASA LSP Launch Vehicle Performance Website: https://elvperf.ksc.nasa.gov/
- NASA Small Spacecraft Technology State-of-the-Art Report: https://www.nasa.gov/smallsat-institute/sst-soa/
- DSN Telecommunications Link Design Handbook (810-005): https://deepspace.jpl.nasa.gov/dsndocs/810-005/
- DONKI (NASA CCMC): https://ccmc.gsfc.nasa.gov/tools/DONKI/
- NASA Lessons Learned Information System: https://llis.nasa.gov/
- NASA Systems Engineering Handbook: https://www.nasa.gov/reference/systems-engineering-handbook/
- NASA Radioisotope Power Systems: https://science.nasa.gov/planetary-science/programs/radioisotope-power-systems/
- NASA Image and Video Library: https://images.nasa.gov/

## Space Agency Partner & Other Data
React (MIT) https://react.dev · Vite (MIT) https://vite.dev · Tailwind CSS (MIT) https://tailwindcss.com · Zustand (MIT) https://github.com/pmndrs/zustand ·
zod (MIT) https://zod.dev · Motion (MIT) https://motion.dev · Vitest (MIT) https://vitest.dev · Space Grotesk (OFL) https://fonts.google.com/specimen/Space+Grotesk ·
JetBrains Mono (OFL) https://www.jetbrains.com/lp/mono/ · GitHub Pages https://pages.github.com · plus any launch-price sources Track B cites.

## Final checklist (Sun 19:00–21:00)
- [ ] Game URL loads in a private window; a full Mars run works; no console errors.
- [ ] Demo link opens in a private window without login; video ≤ 30 s (or deck ≤ 7 slides).
- [ ] Repo is public; README complete (pitch, link, run, data, SI, credits).
- [ ] No NASA logos/insignia/patches anywhere (UI, favicon, video, slides).
- [ ] Summary ≤ 1500 chars; details match what shipped.
- [ ] NASA data + other data links pasted; SI options ticked.
- [ ] **Save Progress** → re-open page → **Submit for Judging** → confirmation bar seen → screenshot it.
