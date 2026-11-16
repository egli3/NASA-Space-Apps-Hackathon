# MARGIN submission kit

**Team Torpid** · NASA Space Apps Challenge 2026 · Space Mission Design Game

**Track B** · `gridiii`

## Project title

MARGIN — The Space Mission Design Game

## Project summary

> Can you send a spacecraft to Jupiter and bring the science home? In MARGIN, you choose the instruments, power system, antenna, shielding, rocket and route. A heavier design needs more propellant, a stronger radio draws more power, and a route that is easier to launch can add months in radiation and deep space. NASA launch-vehicle curves and trajectory data let you test those trade-offs before the Review Board. Fly the mission, make decisions when things go wrong, and replay the same scenario with one choice changed to see what drove the outcome. Compare your spacecraft with Juno, Mars Reconnaissance Orbiter, or Lunar Prospector. MARGIN runs in a browser with no account or runtime data API.

## Project demonstration

**Use the [seven-slide mission walkthrough](submission/MARGIN_Demo.pdf) as the public demo.** Its Jupiter comparison uses the checked-in reference designs and seed 2026 for the balance report. The optional 30-second video can follow the same path if the team records one.

| Time | Show |
|---|---|
| 0–4 s | Open **Giant’s Heart**. Ask whether the spacecraft can reach Jupiter and return science. |
| 4–12 s | On **Launch**, compare direct with the Earth gravity assist. On Vulcan VC4, the Juno-like reference design has −60% mass margin on the direct route and +61% on the assist. |
| 12–20 s | Compare the same assisted design with and without its titanium vault. The simulation estimates 78% versus 6% success across 50 runs. |
| 20–27 s | Fly the mission and show the real debrief. Open **Hindsight** and **You and the real thing** using the result on screen. |
| 27–30 s | Show the play URL and Team Torpid credit. |

**Play:** https://egli3.github.io/NASA-Space-Apps-Hackathon/

**Repository:** https://github.com/egli3/NASA-Space-Apps-Hackathon

## Judge walkthrough

Select **Try the Jupiter demo** on the [title screen](https://egli3.github.io/NASA-Space-Apps-Hackathon/). The demo loads the Juno-inspired spacecraft and fixes the flight seed so judges can reproduce the sample. Start by comparing routes for Vulcan VC4. Choose the Earth gravity assist to continue, then review, build, fly and open **Compare with your flight** in Hindsight. **New mission** offers the full design workflow.

To reproduce the same hardware in **Giant’s Heart** from scratch, follow these settings and leave the other fields at their defaults.

| Screen | Selection |
|---|---|
| Design studio | Add **Magnetometer on a boom**, **Plasma & energetic particle suite**, **Ultraviolet imaging spectrograph** and **Ka-band radio science package** to the default camera and microwave radiometer. |
| Design studio | Set solar array area to **60 m²**, select the **Titanium radiation vault** and set **Ka-band** on the **Antenna** tab. Keep **Polar orbit, 53-day period**. |
| Launch | Choose **Vulcan VC4**. Compare **Direct to Jupiter** with **Earth gravity assist (ΔV-EGA)** and fly the assist. The capacity display changes from about **978 kg** to **5,158 kg**. |
| Review and flight | Build the craft, roll out to the launch pad, then select **Launch** and **100×**. Respond to each incident and resume flight. |
| Debrief | Scroll to **Hindsight** to compare single changes and **You and the real thing** to compare with Juno. |

In a repeatable engine run (seed **2030**), following the default event choices returned **85.8%** of baseline science and **three stars**. Six incidents required decisions, including the valve fault. Hindsight found that the 14-day orbit would have returned **7.1 percentage points** more science in that replay. The guided demo uses seed 2030. New missions start with a fresh seed, and changing an in-flight choice can change either outcome.

The [showcase tests](../src/data/judge-flight.test.ts) step through review, build, flight decisions and debrief for the Jupiter, Mars and Moon reference designs. From a local checkout, run `npm test -- src/data/judge-flight.test.ts` to verify them.

## Project details

Students learn how to design a robotic mission by having to make decisions an engineering team makes. They work within a cost cap, select payloads that can answer a science question, defend the design against a review, and fly through a simulated cruise, arrival and science campaign. A flight can still return partial science. The debrief compares a design with a real mission and runs counterfactuals under the same random seed to show the effect of changing an individual decision.

The TypeScript simulator models launch capacity against characteristic energy (C3), propellant mass through the rocket equation, inverse-square solar power, battery capacity through eclipse, a Deep Space Network radio link, orbital insertion, and radiation against electronics tolerance. Source records distinguish transcribed or derived NASA values, engineering estimates, and assumptions tuned for gameplay. Part masses, power draws and science data rates can describe game archetypes even when their instrument heritage is verified.

A concrete Jupiter trade-off appears immediately. NASA Ames trajectory rows give C3 of **77.5 km²/s²** for the direct route and **26.5 km²/s²** for the Earth-assist route. The latter adds **576 days** of cruise. NASA Launch Services Program curves put the same Vulcan VC4 near **978 kg** and **5,158 kg** of capacity at those energies after interpolation. The engine then accounts for the differing burns and spacecraft mass. The scores in the demo are simulation results from the reference harness. The engine tests also check a modeled Juno insertion against the historical burn and compare approximate planetary positions with JPL Horizons.

Fourteen decision cards link to mission histories or reports, including Juno’s valve issue and Lunar Trailblazer’s loss of contact. Space-weather events draw from the bundled NASA Community Coordinated Modeling Center DONKI archive. The online game has no external data fetch at runtime. NASA imagery has individual credits, and the project uses no NASA insignia or mission patches.

## Validation and classroom pilot

| Quantity | Origin and how to check it |
|---|---|
| Launch energy and cruise time | Archived NASA Ames trajectory rows. The Earth assist adds 576 modeled cruise days and reduces launch C3 from 77.5 to 26.5 km²/s². |
| Payload capacity | Interpolation of NASA Launch Services Program rows for Vulcan VC4. The same rocket offers approximately 978 kg direct or 5,158 kg with the assist. |
| Success and science percentages | Game simulation results, including modeled risks, mission thresholds, and event effects. The vault comparison counts 39 of 50 and 3 of 50 successful runs in the reference review. |
| Mars escape science | MAVEN demonstrated ultraviolet observations of escaping hydrogen. The game now supports remote UV or direct atmospheric sampling. Its data-volume thresholds and science yields are game parameters. |
| Mars balanced reference | A five-instrument payload covers all five objectives and projects 88% science at $749M against the $800M cap. It earned three stars at seed 2026. |

After players choose a route and before they see Hindsight, ask **Why would a team accept a longer trip?** Have them point to the capacity and cruise time on each route. After the debrief, ask **Which design change helped, and what did it cost?** A pilot would record elapsed time, completions without help, and how many participants explain each trade-off correctly. We have not run one yet, so this submission reports no participant results.

## Super Intelligence disclosure

- Code, tests, documentation, and presentation layout were assisted by Claude Code and OpenAI Codex.
- SI helped draft approximate seed data. The catalog retains confidence flags and notes identifying verified figures and modeling assumptions.
- Planet imagery is credited NASA mission imagery. The presentation uses that photography, charts drawn from repository data, and screenshots of the running game (captured by `docs/submission/deck/capture.mjs`). No generative imagery, video, or audio was used for this package.

## NASA data and references

- JPL SSD — Approximate Positions of the Planets (Keplerian elements, Table 1) — https://ssd.jpl.nasa.gov/planets/approx_pos.html
- JPL Horizons System (ephemeris API) — https://ssd.jpl.nasa.gov/horizons/
- JPL SSD — Planetary Physical Parameters — https://ssd.jpl.nasa.gov/planets/phys_par.html
- NSSDCA Planetary Fact Sheets — https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- NSSDCA Master Catalog (spacecraft & experiments) — https://nssdc.gsfc.nasa.gov/nmc/
- NASA Ames Trajectory Browser — https://trajbrowser.arc.nasa.gov/
- NASA Launch Services Program — Launch Vehicle Performance Website — https://elvperf.ksc.nasa.gov/
- NASA Small Spacecraft Technology State-of-the-Art Report — https://www.nasa.gov/smallsat-institute/sst-soa/
- DSN Telecommunications Link Design Handbook (810-005) — https://deepspace.jpl.nasa.gov/dsndocs/810-005/
- DONKI — Space Weather Database Of Notifications, Knowledge, Information — https://ccmc.gsfc.nasa.gov/tools/DONKI/
- NASA Lessons Learned Information System (LLIS) — https://llis.nasa.gov/
- NASA Systems Engineering Handbook (SP-2016-6105 Rev 2) — https://www.nasa.gov/reference/systems-engineering-handbook/
- NASA Radioisotope Power Systems Program — https://science.nasa.gov/planetary-science/programs/radioisotope-power-systems/
- NASA JPL news releases and mission status reports — https://www.jpl.nasa.gov/news/
- Juno: Jupiter Orbit Insertion Press Kit — https://www.jpl.nasa.gov/news/press_kits/juno/facts/
- NASA Office of Inspector General: Audit of NASA's Deep Space Network (IG-23-016) — https://oig.nasa.gov/audits/ig-23-016/
- Mars Climate Orbiter Mishap Investigation Board Phase I Report — https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf
- NASA Science mission pages and blogs — https://science.nasa.gov/missions/
- Mars Reconnaissance Orbiter spacecraft and instruments — https://www.jpl.nasa.gov/missions/mars-reconnaissance-orbiter-mro/
- Juno orbit insertion press kit — spacecraft — https://www.jpl.nasa.gov/news/press_kits/juno/spacecraft/
- Juno orbit insertion press kit — science instruments — https://www.jpl.nasa.gov/news/press_kits/juno/science/
- Lunar Prospector mission and chronology — https://science.nasa.gov/mission/lunar-prospector/
- Lunar Reconnaissance Orbiter spacecraft and instruments — https://science.nasa.gov/mission/lro/spacecraft-and-instruments/
- MAVEN launch press kit — science payload — https://mars.nasa.gov/files/resources/MAVEN_PressKit_Final.pdf
- MAVEN ultraviolet observations of hydrogen escaping Mars — https://science.nasa.gov/resource/mavens-ultraviolet-views-of-hydrogens-escape-from-mars/
- GRAIL mission chronology and lunar transfer — https://www.jpl.nasa.gov/missions/gravity-recovery-and-interior-laboratory-grail/
- Moon Mineralogy Mapper instrument — https://www.jpl.nasa.gov/missions/moon-mineralogy-mapper-m3/
- Dawn Gamma Ray and Neutron Detector instrument — https://science.nasa.gov/mission/dawn/technology/grand-instrument/
- Dawn ion propulsion — https://science.nasa.gov/mission/dawn/technology/ion-propulsion/
- Multi-Mission Radioisotope Thermoelectric Generator fact sheet — https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf
- Small Spacecraft Technology State of the Art — Avionics — https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics/
- Nearside Spectacular (PIA14011) — Lunar Reconnaissance Orbiter imagery — https://science.nasa.gov/photojournal/nearside-spectacular/
- Valles Marineris Hemisphere (PIA00003) — https://science.nasa.gov/photojournal/valles-marineris-hemisphere/
- Cassini Jupiter Portrait (PIA04866) — https://science.nasa.gov/photojournal/cassini-jupiter-portrait/
- Juno telecommunications design and antenna specifications — https://descanso.jpl.nasa.gov/DPSummary/Descanso16_Juno_RevA.pdf

### In-flight mission reports

- [Kepler’s K2 pointing strategy](https://science.nasa.gov/resource/keplers-second-light-how-k2-will-work/)
- [September 2017 solar storm at Mars](https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/)
- [Juno’s orbit decision](https://www.jpl.nasa.gov/news/nasas-juno-to-remain-in-current-orbit-at-jupiter/)
- [Mars Global Surveyor’s solar-panel investigation](https://www.jpl.nasa.gov/news/global-surveyors-orbit-raised-while-solar-panel-is-analyzed/)
- [Mars Reconnaissance Orbiter photographs avalanches](https://www.jpl.nasa.gov/news/nasa-spacecraft-photographs-avalanches-on-mars/)
- [Galileo antenna failure, Lessons Learned 492](https://llis.nasa.gov/lesson/492)
- [Mars Observer loss investigation](https://www.jpl.nasa.gov/news/potential-causes-of-the-loss-of-mars-observer-identified/)
- [Spirit rover recovery](https://www.jpl.nasa.gov/news/mars-rover-spirit-restored-to-health/)
- [Voyager 2 communications recovery](https://www.nasa.gov/missions/voyager-program/voyager-2/nasa-mission-update-voyager-2-communications-pause/)
- [Mars Reconnaissance Orbiter resumes observations](https://www.jpl.nasa.gov/news/nasas-mars-reconnaissance-orbiter-resumes-observations/)
- [Lunar Trailblazer end of mission](https://www.nasa.gov/missions/small-satellite-missions/lunar-trailblazer/nasas-lunar-trailblazer-moon-mission-ends/)
- [CRISM instrument retirement](https://www.jpl.nasa.gov/news/nasa-retires-mineral-mapping-instrument-on-mars-orbiter/)

## Other resources

TypeScript, React, Vite, Tailwind CSS, Zustand, Zod, Motion, and Vitest. Space Grotesk and JetBrains Mono are distributed under the SIL Open Font License. GitHub Actions and Pages build and host the game. The [game design](GAME_DESIGN.md) records our modeling and gameplay assumptions.

## Final checks

- Open the live game and the public demo link in a signed-out window after merge.
- Paste the summary and links into the team’s submission, select the applicable SI disclosure, and verify the on-screen confirmation after submitting.
