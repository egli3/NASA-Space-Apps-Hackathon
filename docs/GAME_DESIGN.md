# MARGIN — Game Design Spec (source of truth for mechanics)

Track A implements §4–§6. Track C renders §2, §3, §8. Track B fills the data that §3–§5 consume.
If code and this doc disagree, **fix whichever is wrong and update the other in the same commit.**
Engine v0 (`src/engine/budgets.ts`) already implements §4.1–§4.8 as written here.

---

## 1. Design pillars

1. **Coupled, not scripted.** Trade-offs come out of physics. A bigger dish adds mass, which adds propellant, which may need a bigger rocket, which costs money, which takes away an instrument. We never hard-code "option A is better".
2. **Every number has a source.** Hover any value → formula + NASA source. Values tuned for play are labelled as such.
3. **Real history is the content.** Surprises during flight are real anomalies from NASA missions, each followed by "what actually happened" and the lesson.
4. **Consequences are explained.** The debrief replays your mission with single changes and tells you which decisions mattered.
5. **Ten minutes to a full mission.** A first play-through of Mars takes 6–10 minutes. Depth is there for those who want it, but nothing blocks a newcomer.

## 2. Screen flow & UX

| # | Screen | Purpose | Key interactions |
|---|---|---|---|
| 0 | **Title** | Hook | "New mission", "How it works" (3 panels), Credits |
| 1 | **Science Call** | Pick a scenario | Cards: destination image, class, cost cap, difficulty, tagline. P1 scenarios marked "Tutorial". |
| 2 | **Briefing** | Set the goal | Objectives with weights (pie/bars), cost cap, launch windows, "Your rival: <historical mission>". Mission name input. |
| 3 | **Design Studio** (blueprint look) | Build the spacecraft | Left: tabs per slot + Instruments shelf. Centre: spacecraft schematic (SVG) that scales with choices. Right: **Budget panel** (8 gauges, see below), ripple chips, blockers. Bottom: orbit selector, DSN hours/aperture, assurance, reserve slider, redundancy toggles. |
| 4 | **Launch** | Rocket + trajectory | Trajectory cards (C3, TOF, DSM Δv, arrival v∞, flybys) with a mini orbit diagram. Launch-date offset slider (±window/2): C3 grows off-optimal. Rocket cards show a **capacity bar at your C3** against your wet mass. |
| 5 | **Review Board** | Gate | Findings list (red/yellow/green) with value vs threshold, fix hint and source. "Back to design" or "Proceed" (enabled when no red). P1: predicted success % from Monte Carlo. |
| 6 | **Reality Check** | Margins matter | Animated list: each part's actual mass/cost growth (seeded by TRL). New mass margin & remaining reserve. If `mustDescope`, the player must remove an instrument or switch rocket before continuing. |
| 7 | **Flight** (mission control look) | Simulate & manage | Centre: top-down solar-system SVG (planets from JPL elements, spacecraft, trail). Top: date, mission day, phase. Right: telemetry (power, battery, storage, propellant, dose, reserve, science %). Bottom: time controls (⏸ 1× 10× 100×, i.e. days/sec = 2/20/120). Event modal pauses time: narrative, context lines, 2–3 options; after choosing, a "What really happened" card (mission, year, summary, lesson). Log feed. |
| 8 | **Debrief** (report look) | Evaluate | Headline outcome + ★★★. Objective bars with threshold markers. **Hindsight**: top 3 "If you had…" cards (+Δscience, Δcost) + "Your best call". **You vs History** table. P1: Monte Carlo strip (50 runs histogram). Buttons: "Try again (keep design)", "New scenario". |
| 9 | **Credits** | Integrity | Every source (NASA first), libraries, fonts, image credits, SI disclosure, "values tagged *game* are tuned for play". |

**Budget panel gauges (Design Studio):** Mass (wet vs rocket capacity), Power (EOL generated vs peak load), Battery
(eclipse), Δv (breakdown), Data (downlink vs generated per day), Cost (total vs cap, stacked: dev/launch/ops/reserve),
Radiation (dose vs tolerance), Reliability (P(survive)). Each gauge: value, margin %, colour by review-rule thresholds,
and a "Why?" popover (engine `explain[]` + formula + sources).

**Ripple chips (P1):** when the player changes one thing, show up to 4 transient chips for metrics that changed by
more than 2%, e.g. `Dish 1.5→3 m: +26 kg → +31 kg propellant → mass margin −4%`. Diff two `BudgetReport`s in the UI.

**Visual moods:** Blueprint (navy `#0b2a4a`, grid lines, white strokes) for Design/Launch. Mission control
(near-black, green/amber telemetry, mono font) for Flight. Report (off-white paper, ink) for the Debrief. Fonts:
Space Grotesk (display) and JetBrains Mono (numbers), both OFL, self-hosted via `@fontsource`.

**Tone of copy:** second person, concrete, short. 15-year-old reading level. No jargon without a hover definition.

## 3. Player decisions (the full design space)

| Decision | Field in `MissionDesign` | Options (data) | Main coupling |
|---|---|---|---|
| Instruments | `instrumentIds` | scenario shelf (`instruments.json`) | mass, power, cost, data rate → science |
| Power source | `parts.power` | Si solar, triple-junction solar, MMRTG (Large only) | power vs distance², mass, cost |
| Solar array area | `solarArrayAreaM2` | 0–80 m² slider | power ∝ area, mass/cost ∝ area |
| Battery | `parts.battery` | 200 / 500 / 1500 / 4000 Wh | eclipse survival |
| Propulsion | `parts.propulsion` | monoprop, biprop, ion | Isp → propellant mass (rocket equation) |
| Antenna | `parts.antenna` | LGA, 0.5/1.5/2.5/3 m, 5 m deployable | gain ∝ D², mass, deploy risk |
| Transmitter | `parts.transmitter` | 5/20 W SSPA, 35/100 W TWTA | data rate ∝ P, DC power |
| Band | `commsBand` | X, Ka | Ka ≈ 10× gain but needs fine pointing, more weather loss, no 70 m |
| Pointing | `parts.adcs` | coarse / standard / precision | pointing loss, instrument quality |
| Avionics | `parts.avionics` | commercial / rad-tolerant / rad-hard | radiation tolerance, storage |
| Thermal | `parts.thermal` | passive / active / RHU | heater power at distance, blocker beyond limit |
| Shielding | `parts.shielding` | none / spot / vault | dose × factor, +mass |
| Redundancy | `redundant[]` | avionics, adcs, transmitter, battery | +80% mass, +60% cost, P(fail) → ≈ P² |
| Assurance | `assurance` | lean / standard / rigorous | hazard ×1.8/1.0/0.6, cost +0/8/16% |
| Reserves | `reservePct` | 0–60% | pays growth & event costs |
| Science orbit | `orbitId` | 2–3 per destination | insertion Δv, eclipse, science modifiers, radiation |
| Trajectory | `trajectoryId` | 2 per scenario | C3, TOF, DSM Δv, arrival v∞ |
| Launch date | `launchOffsetDays` | ±window/2 | C3 penalty |
| Rocket | `launchVehicleId` | 2–3 per scenario | capacity at C3, cost, reliability |
| DSN | `dsnAperture`, `dsnHoursPerDay` | 34/70 m, 1–24 h | data volume, ops cost |

## 4. Models (design-time budgets) — implemented in `computeBudgets`

Notation: g0 = 9.80665 m/s², S0 = 1361 W/m², AU = 149 597 870.7 km. All constants live in `src/data/constants.json`.

### 4.1 Δv budget (m/s)
- DSM and TCM from the trajectory record.
- **Orbit insertion** (patched conic): `Δv = √(v∞² + 2μ/rp) − √(μ(2/rp − 1/a))`, rp = R + periapsis alt, a = (rp + ra)/2.
  With aerobraking, ra = R + `captureApoapsisAltKm` (capture into a loose orbit), plus 30 m/s for walk-in/out.
  *Validated:* Juno JOI (v∞ 5.8 km/s → 53.5-day orbit) = 542 m/s ±5% (test).
- Maintenance = `maintenanceDvMsPerYear × primaryYears`; disposal = 20 m/s; margin = 5% of the sum.
- Ion propulsion cannot perform insertion at a planet when v∞ > 1 km/s → blocker.

### 4.2 Mass (kg) and the mass spiral
- Hardware = Σ part masses (×1.8 if redundant) + solar area × kg/m² + Σ instrument masses.
- Growth allowance = Σ mass × `massGrowthByTrl[TRL]` (TRL 9: 3% … TRL ≤ 4: 25–30%).
- Bus core = `busBaseMassKg[class]`; structure = 25% × (hw + growth + bus); harness = 8% × (hw + growth).
- **Rocket equation with tanks**: MR = e^(Δv/(Isp·g0)); solve `prop = (dryBase + tankFraction·prop)·(MR − 1)`,
  i.e. `prop = dryBase·(MR − 1) / (1 − tankFraction·(MR − 1))` (the closed form of the iteration).
  If it diverges (`tankFraction·(MR − 1) ≥ 1`, or prop > 10⁶ kg) → blocker *"The rocket equation wins"*.
- Wet = dry + prop. **Capacity** = LV curve interpolated at C3 (`traj.c3 + 0.08 × |launchOffsetDays|`). 0 beyond the curve
  (blocker: the rocket can't reach that C3 at all).
- Mass margin % = (capacity − wet)/capacity × 100.

### 4.3 Power (W)
- Solar BOL at destination: `S0/d² × A × η × 0.85 × LILT`, LILT = 0.8 if d > 3 AU (low-intensity low-temperature loss).
- EOL: × (1 − (cellDegradation + destination extra))^(cruiseYears + primaryYears).
- RTG: P0 × (1 − decay)^years.
- Loads: bus = ADCS + avionics + thermal + propulsion heaters + heater power (`heaterWPerAU × max(0, d − 1)`).
  Science mode = bus + all instruments. Downlink mode = bus + transmitter DC. (Ops alternate modes, as Juno does.)
  Peak = max(science, downlink). Margin % = (EOL − peak)/peak × 100.
- Eclipse (worst case, cylindrical shadow): fraction = asin(R/a)/π of the period (or orbit override).
  Battery required = science load × eclipse hours / maxDoD. Redundant battery doubles capacity.
  (An RTG keeps generating in shadow, so its battery only covers `max(0, science load − EOL power)`.)
- Ion engine: needs `powerW` + bus from the arrays near Earth, otherwise blocker.
- Thermal blocker: if solar flux fraction 1/d² < `minSolarFluxFraction` of the thermal part.

### 4.4 Communications (DSN link budget)
- λ = c/f. Dish gain `Gt = 10·log10(η·(πD/λ)²)` dBi; LGA uses `fixedGainDbi`.
- Pointing loss = min(30, 12·(θerr/θ3dB)²) dB with θ3dB = 70λ/D degrees, θerr = ADCS `pointingDeg`.
- EIRP = 10·log10(P_rf) + Gt − pointing loss.
- Gr = DSN 34 m or 70 m gain for the band (Ka on 70 m → treated as 34 m: the 70 m dishes have no Ka downlink).
- `R[dB-Hz] = EIRP + Gr − FSL − miscLoss − bandExtraLoss − (k + 10·log10 Tsys) − Eb/N0req − linkMargin`,
  FSL = 20·log10(4πd/λ). Rate capped at 300 Mbps.
- Daily downlink = rate(mean distance) × DSN hours × 3600. Generated/day = Σ rate × duty × orbit duty multiplier × 86 400.
- Data margin % = (downlink − generated)/generated × 100.
- *Calibration targets (tests in `engine.test.ts`):* MRO-like (100 W, 3 m, X, 34 m) → 1–6 Mbps at Mars's mean distance
  (1.52 AU) and 0.3–1.5 Mbps at its farthest (2.68 AU); the real MRO returns roughly 0.5–6 Mbps (Track B: verify and cite).
  Juno-like (35 W, 2.5 m, X, 34 m) at 5.2 AU → 20–120 kbps.
  (The earlier "70 m at 0.7 AU → 1–6 Mbps" target was wrong: this link budget gives ~40 Mbps there, and so does the physics.
  MRO's real ceiling of 6 Mbps is a hardware limit, not a link limit.)

### 4.5 Science (expected, nominal)
- Instrument quality for a measurement type = base quality × orbit `scienceModifiers[type]` (default 1)
  × 0.5 if ADCS pointing > instrument `pointingReqDeg`, × 0 for gravity science without Ka,
  × (maxGsd/GSD) if GSD = periapsisAlt(km) × IFOV(µrad)/1000 exceeds the objective's `maxGsdM`.
- For each objective measurement: q = best instrument quality; volume = Σ instrument Gb over science days ×
  downlink share (min(1, downlink/generated)); credit = q ≥ minQuality ? q × min(1, volume/requiredGb) : 0.
- Objective credit = max (any) or min (all) over its measurements. Expected science % = Σ weight × credit.
- Science days = primaryYears × 365 − aerobrakingDays.

### 4.6 Radiation
- Primary-mission dose (krad) = destination rate × orbit `radiationMultiplier` × shield `doseFactor` × primaryYears + 1 krad/yr × cruiseYears × doseFactor.
- Margin % = (avionics tolerance / dose − 1) × 100. NASA practice targets a radiation design margin of 2× (100%).
- If dose > tolerance, avionics failure probability ≥ 0.5 + 0.5 × overdose fraction.

### 4.7 Reliability & the Reality Check
- P(survive primary) = LV reliability × Π over critical slots (avionics, power, transmitter, propulsion, battery) of (1 − pf),
  pf = 1 − e^(−λ·hazardMult·T), T = cruise + primary years. Redundant: pf' = (1 − β)·pf² + β·pf, β = 0.1.
- **Reality Check (`revealGrowth`, `src/engine/growth.ts`):** for each part/instrument draw growth g = U(0.3, 1.5) × `massGrowthByTrl[TRL]`
  from stream `growth:<id>`. Same for cost with `growth-cost:<id>` at 1.2× the mass factor. Total growth is paid first
  from the TRL allowance already in the budget (the actual growth *replaces* the allowance, then structure, harness,
  tanks and propellant are recomputed, so growing by less than the allowance gives margin back), and the cost from
  reserves. `mustDescope` = wet > capacity OR cost growth > reserve. The player then removes an instrument or changes
  the rocket; recompute (per-id streams mean the remaining parts keep the same growth).
  The flight sim starts from the as-built spacecraft: its propellant load and remaining reserve come from this reveal.

### 4.8 Cost ($M, FY2026)
- Hardware = Σ part cost (×1.6 if redundant) + solar area × $/m² + Σ instruments + bus core.
- Wrap (systems engineering, PM, I&T) = hardware × `costWrapFraction[class]`; assurance = (hw + wrap) × assurance fraction.
- Development = hw + wrap + assurance. Ops = cruise years × 0.5 × ops/yr + primary years × (ops/yr + DSN hours × 365 × $/h).
- Reserve = development × reservePct. **Total = development + launch + ops + reserve**. Over cap → blocker.

## 5. Flight simulation (`createSimulation`, Track A)

Daily step. Deterministic given (design, seed, decisions). All randomness through `Rng` named streams (`src/engine/rng.ts`).

### 5.1 Phases
`launch` (day 0, roll LV reliability on stream `launch`) → `cruise` (until TOF) → `arrival` (insertion burn: roll
propulsion reliability for the burn on stream `insertion`, p_fail = 1 − e^(−λ·hazardMult·4): the burn stresses the engine
like 4 years of cruise; a propulsion hazard during cruise is *latent* and also surfaces here. Failure → a `hazard`/`propulsion`
card for the `arrival` phase if the deck has one, else mission lost) → `aerobraking` (if orbit has it) → `science` →
`extended` (only if not lost, propellant ≥ maintenance for extended years, propulsion working, and reserve ≥ 0) → `ended`.
- The primary mission clock starts at arrival and runs `primaryYears`: aerobraking (and any delay to it) **eats science
  days**, it does not push the end date out (matches §4.5).
- Burns use propellant by the rocket equation on the current mass: DSM mid-cruise, TCM 10 days before arrival,
  insertion (+ aerobraking walk) at arrival, maintenance daily. What is left afterwards (the 5% margin + disposal) is
  what event cards and the extended mission draw on.
- A loss before the end of the primary mission is outcome `lost`; a fatal failure after it just ends the mission.

### 5.2 Daily bookkeeping (science/extended)
- Distance to Earth from JPL-element positions; rate scales with (meanDist/d)².
- Generated = Σ instruments (healthy, not disabled) × science rate factor × (0 in safe mode / science pause).
- Storage += generated; downlink = min(storage, rate × DSN hours × 3600 × dataRateFactor(today)); overflow beyond recorder → `dataLostGb`.
- Downlinked volume is attributed to measurement types in proportion to generation → objective credit (as §4.5).
- Solar conjunction (P1): when the Sun–Earth–spacecraft angle < 3°, downlink = 0 (real phenomenon; Mars every ~26 months).
- Propellant: maintenance Δv/365 per day via the rocket equation; at 0 propellant the extended mission ends.
- Dose accumulates daily; past tolerance the avionics hazard is ×10·(dose/tolerance)² (so no vault at Jupiter is near-certain loss).
- Power is recomputed daily from the real Sun distance and array ageing. If it cannot cover bus + instruments, science
  scales down; if it cannot cover bus + transmitter, downlink scales down. A battery too small for the eclipse scales
  science by capacity/required. (This is where thin margins bite: Mars at aphelion gets 16% less sunlight than on average.)
- Credit uses the quality at the time of downlink: `credit = min(Σ(q·Gb)/requiredGb, best q seen)`, which equals §4.5 when nothing degrades.

### 5.3 Hazards (random failures)
Each day, for each slot/instrument with λ > 0: p_day = 1 − e^(−λ·hazardMult/365) on stream `hazard:<slot|insId>`
(implemented as the equivalent time-to-failure draw: one Exp(1) draw per failure, so replays stay aligned). Instruments
can only fail after arrival. On failure:
- If redundant and the spare is unused → log "Backup <x> engaged: redundancy paid off" (no card). Mark spare used.
- Else, if an event card has `trigger.kind = hazard` and `subsystem` = slot (or 'instrument') and its conditions hold → pending event.
- Else apply the default consequence: instrument → disabled; adcs → degrade 0.5; transmitter/avionics/power/battery → mission lost
  (cause text "Single-string <part> failure"); antenna → downlink ×0.05 (low-gain fallback); thermal → science ×0.7;
  propulsion → latent until arrival (see §5.1), after arrival no orbit maintenance and no extended mission.
- `subsystem_degrade` meaning per slot: adcs → pointing error ÷ value (hits the link and instrument quality); power → generated W;
  transmitter/antenna → data rate; battery → capacity; avionics → recorder size; propulsion → Isp; thermal → science rate.

### 5.4 Events (data-driven)
- `scheduled`: fires on `phase start + dayOffset` if conditions hold.
- `random`: p_day = probabilityPerYear/365 during its phase (stream `event:<id>`).
- `space_weather`: map the mission timeline onto the DONKI snapshot (§5.6). When a mapped event's severity ≥ `minSeverity`, fire.
- Each card fires **at most once per mission** (keeps games readable). At most 1 pending event at a time (others queue).
  Only cards in the scenario's `eventIds` deck can fire. Card phase `arrival` covers aerobraking; `cruise` covers launch day.
- Timed `data_rate_factor` effects (`days:N`) run **one after another**, not on top of each other ("4 days dark, then 10 days at 1.5×").
- `science_pause_days` during arrival/aerobraking delays the start of science instead. `science_bonus_pct` only adds to
  objectives that already have some credit. `instrument_*` with target `random` picks a working instrument on stream `pick:<cardId>:<n>`.
- **Facts** for conditions (engine must provide all of these): `design.assurance`, `design.commsBand`, `design.dsnAperture`,
  `redundant.<slot>` (bool), `parts.<slot>` (part id), `power.kind` ('solar'|'rtg'), `orbit.id`, `orbit.aerobraking` (bool),
  `destination.id`, `mission.class`, `phase`, `state.batterySoc`, `state.storageFrac`, `state.propellantKg`, `instrument.<id>` (bool on board).
- **Effects** semantics (`EffectKind`): see comments in `src/types/catalog.ts`. `successProbability` → roll on stream
  `gamble:<cardId>`: success applies `effects`, failure applies `failureEffects`. `cost_m` comes out of reserves first, then
  overruns the budget (affects the ★ under-budget star). `mission_loss` ends the mission with the target text as cause.
- After a decision, the UI shows the card's `realStory`.

### 5.5 Auto-policy
Used by `runHeadless` without a recorded decision, by Monte Carlo and by Hindsight: choose `decisions[cardId]` if
present, else `defaultOptionId`.

### 5.6 Space-weather replay (DONKI)
Snapshot covers 2014-01-01 → 2019-12-31 (the declining phase of Solar Cycle 24, similar to the late-2020s decline of Cycle 25).
Map mission day d → `2014-01-01 + ((d + seedOffset) mod snapshotDays)`, seedOffset = (seed mod 365) days.
Severity: FLR M1 = 0.30, linear to M9.9 = 0.55; X1 = 0.60, linear to X10+ = 1.0. SEP = 0.8. Card context line:
`"Based on a real X9.3 flare, 6 Sep 2017 (NASA DONKI)"`.

## 6. Debrief (`buildDebrief`, Track A)

### 6.1 Outcome & stars
- Science % = Σ weight × credit (as §4.5, with actual downlinked volumes).
- Outcome: `lost` if mission lost before the end of the primary mission (keep the science returned so far!);
  `exceeded` ≥ 90%; `full` ≥ 75%; `threshold` if every objective ≥ its `thresholdPct`; else `partial`.
- ★ baseline science (≥ 75%) · ★ under the cost cap (after event costs) · ★ survived the primary mission.

### 6.2 Hindsight (the signature feature, P0)
For each **dimension**, generate alternatives:
- Each slot: every other allowed part for that slot.
- Solar area: ×0.66 and ×1.5. Reserves: ±15 pts. DSN hours: ×0.5 and ×2 (clamp 1–24). Band: the other one.
- Orbit, trajectory, launch vehicle, assurance: every other option.
- Instruments: remove each instrument; add each shelf instrument not on board.
- Redundancy: toggle each of the 4 slots.

For each alternative: build the design; if infeasible (`computeBudgets().feasible === false`) record `feasible: false`
and skip simulation; else `runHeadless(catalog, alt, sameSeed, sameDecisions)`. Δscience = alt − actual.
Rank feasible alternatives by Δscience (tie-break by −Δcost). Return the top 3 positive ones as `hindsight`.
`bestDecision` = the dimension where **every** feasible alternative scores worse, with the largest minimum loss.
`explanation` = template per dimension, e.g. *"A 2.5 m dish instead of 1.5 m would have downlinked 2.8× more data at
Jupiter (+18 pts)."* Budget: ≤ 60 headless runs; each ≤ 5 ms → ≤ 300 ms. If slower, run in a Web Worker.

As built (`src/engine/hindsight.ts`): `hindsight` holds at most 3 items, **one per decision** (the best alternative of
each), and only gains of ≥ 0.5 points. Instruments and redundancy count as one decision each ("carry the radar",
"back up the computer"); *not* adding something is never praised as a best call. Also varied: the DSN dish size.
`Debrief.explored` lists every alternative looked at (infeasible ones last, with the blocker as the reason) and
`Debrief.replays` says how many missions were re-flown. Measured in Chrome: a Jupiter debrief with 42 replays plus a
50-run Monte Carlo takes about 250 ms; `engine.buildDebriefAsync` / `engine.runReviewAsync` run the same code in a
Web Worker (`worker.ts`), so the page never freezes on a slower laptop.

### 6.3 Monte Carlo (P1)
N = 50 seeds with the auto-policy. Report success rate (outcome ≠ lost and ≥ threshold), science P10/P50/P90.
Same function powers Review Board `predictedSuccessPct`.
As built (`src/engine/montecarlo.ts`): the debrief derives its 50 seeds from the flight seed and replays the player's own
decisions; the Review Board has no flight seed yet, so it always uses the same fixed set of universes (stable number while
the player tweaks). Both are opt-in via `opts.monteCarloRuns` and skipped for infeasible designs.

### 6.4 You vs History
Rows: launch mass, dry mass, power at target, cost (theirs in then-year $), instruments, launch vehicle, plus one
"Fun fact" line and the outcome of the real mission. Never claim our cost model reproduces theirs exactly. Label it
"for scale".

## 7. Balance targets (Track A + B tune data until these hold; add as tests)

| Reference design (scripted in `scripts/balance/`) | Target |
|---|---|
| **Default design**, any scenario | Opens with ≥ 1 yellow or red finding (it's a first draft) but no crash. |
| **MRO-like** Mars (HiRISE, CTX, CRISM-class, radar, WAC; 3 m dish, 100 W, precision ADCS, aerobraking, Vulcan) | Cost within 0–10% under the cap; science 55–75% (escape objective is uncovered). |
| **MAVEN-like** Mars (NGIMS, particles, mag, UVS, WAC; elliptical dip orbit) | Escape objective ≥ 80%; specialist total science 25–35%, because atmospheric escape accounts for 30% of this science call. |
| **Balanced** Mars design (remote UV escape + radar, context, high-resolution and mineral mapping, 2.5 m Ka-band dish, 12 h DSN) | Science ≥ 80%, cost under cap. That is, a thoughtful player can get ★★★. |
| **Juno-like** Jupiter (60 m² TJ solar, vault, 2.5 m Ka, ΔV-EGA, Vulcan) | Feasible; power margin 10–40%; science ≥ 75%; reliability ≥ 70%. |
| **Direct-to-Jupiter** with Juno-like spacecraft | Infeasible on Vulcan (teaches gravity assists); feasible on Falcon Heavy, but it costs more than ΔV-EGA on Vulcan (a bigger rocket buys back the 19 months). The verified Falcon Heavy curve lifts the ~1.6 t Juno-like to C3 77.5 with margin, so "only with cuts" was dropped. |
| **No vault at Jupiter** | Radiation margin red; Monte Carlo success < 40%. |
| **Lunar Prospector-like** Moon (GRNS + thermal IR, 3 m² Si, rideshare) | Feasible, cost under cap, science 45–65%. |
| Single-string inner-planet design, standard assurance | Reliability 80–90%. Adding full redundancy → ≥ 93%. |

## 8. Education layer
- "Why?" popovers on every gauge: one sentence, the formula, the NASA source link.
- Event cards end with **What really happened**: mission, year, two sentences, one lesson.
- Glossary (`src/data/glossary.json`, Track B, P1): C3, Δv, Isp, TRL, margin, eclipse, DSN, Ka-band, RTG, aerobraking, gravity assist, perijove, krad.
- Debrief Hindsight sentences in plain English, with numbers.

## 9. Explicitly out of scope
Real-time multiplayer, accounts or leaderboards on a server, 3D rendering, landers/rovers/EDL, launch-site geometry,
N-body propagation, attitude dynamics, thermal networks. Mention these as "future work" in the submission.
