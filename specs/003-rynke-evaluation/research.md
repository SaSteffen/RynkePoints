# Research: Rynke Evaluation — Stories 1 and 2

Decisions behind [plan.md](plan.md). Scope: the rules handout (Story 1) and
Training Rynke from rides (Story 2). Stories 3–6 add their own entries later.

## R1. Rules handout: what is left (Story 1, FR-017–FR-020)

- **Decision**: no new work beyond the review. `docs/rynke-punkte.md` (German,
  opening with the team purpose) and `scripts/docs-pdf.sh` (`pnpm docs:pdf`,
  pandoc plus headless Chrome, output `dist/rynke-punkte.pdf`) already exist on
  this branch and cover every topic FR-017 lists. Acceptance scenario 2 is a
  manual comparison against the spec, repeated whenever the spec or a rule value
  changes (FR-019). The two open questions of this plan (R6, R7) need a sentence
  in the handout once the spec takes them.
- **Rationale**: FR-018 makes the handout and its script a seldom-used manual
  task without automated tests.
- **Alternatives considered**: rendering the PDF in CI — rejected: it adds pandoc
  and Chrome to CI for a document printed a few times a season.

## R2. Where Story 2 ends (scope boundary with Story 4)

- **Decision**: Story 2 delivers a pure evaluation, `evaluateRides(rides, rules,
  window)`, plus a read-only loader `evaluateRider(db, athleteId, …)`. It stores
  nothing, adds no queue message and is not called by the webhook path yet. Its
  output already has the shape Story 4 stores: one ride result per activity with
  the fields FR-014 lists (except the rules version), and the riding part of the
  tally FR-014a lists ([contracts/ride-evaluation.md](contracts/ride-evaluation.md)).
- **Rationale**: Story 2's independent test is "feed synthetic activities into the
  evaluation and compare with a hand calculation", which a pure function meets.
  Acceptance scenario 5 (an edited or deleted ride is re-derived) holds because the
  evaluation is a function of the *current* stored activities: evaluating after
  feature 001 updated or deleted the row gives the new result. Keeping storage out
  avoids a migration that Story 4 would have to reshape (rules version, tally
  columns, team-event fields).
- **Alternatives considered**: storing ride results now — rejected: the table needs
  the rules version (FR-023) and the tally needs team events (Story 3); a migration
  must stay compatible with the deployed version, so a premature one is hard to
  take back. Evaluating on the `/me` page — rejected: FR-014b forbids evaluating on
  read, and showing numbers is the rider-view feature.

## R3. Exact arithmetic at the rule boundaries

Several acceptance scenarios sit exactly on a limit (10 km/h counts, a pause of
exactly half the moving time counts, 1999 m + 1 m = 2000 m earns 10). Floating
point division can land a hair on either side.

- **Decision**:
  - **Distance**: `floor(distance_m / (km_per_step × 1000)) × rynke_per_step`, per
    ride. Dividing an exact multiple of 10,000 by 10,000 is exact in IEEE 754, so
    100 km earns exactly 10.
  - **Elevation**: each ride's gain is converted once to whole decimetres
    (`round(elevation_gain_m × 10)`) and the season total is summed as integers.
    Strava reports elevation gain to 0.1 m, so this loses nothing; a sum of floats
    such as 600.1 + 399.9 could otherwise end at 999.999… and miss a step.
  - **Limits** are compared by cross-multiplication, never by dividing:
    - pause: `(elapsed_s − moving_s) × den ≤ moving_s × num` for the share
      `num/den` (1/2);
    - speed: `min_kmh × 1000 × moving_s ≤ distance_m × 3600 ≤ max_kmh × 1000 ×
      moving_s`;
    - climbing rate: `elevation_dm × 3600 ≤ max_climb_m_per_h × 10 × moving_s`.
  - Shares in rule values are fractions (`{ num, den }`), not decimals.
- **Rationale**: with integer inputs (Strava's times are whole seconds, the
  thresholds are whole numbers) every comparison above is exact, so a ride at a
  limit is decided the way the spec says.
- **Alternatives considered**: an epsilon tolerance — rejected: it moves the limit
  by an arbitrary amount and still needs a decision on which side the boundary
  falls. Integer metres for elevation — rejected: it drops up to 0.5 m per ride,
  which FR-004a forbids in spirit ("no metre may be dropped").

## R4. Counting window and time zones (FR-011, edge case "Activity outside the counting window")

- **Decision**: a ride is placed by the date part of `start_date_local` (the first
  ten characters, `YYYY-MM-DD`). It is inside the window when that date is on or
  after `SEASON_START_DATE` and, if a qualification deadline is set, on or before
  it. Both bounds are plain dates compared as strings. The deadline is a rule
  value (FR-012) and unset by default, so in Stories 1–2 everything from the
  season start counts.
- **Rationale**: the spec places a ride by its start date in the rider's local
  time zone. Strava's `start_date_local` is that local wall-clock time (despite its
  trailing `Z`), so no time-zone arithmetic is needed. Feature 001 imports from
  Berlin midnight of the season start; a ride a rider starts abroad shortly before
  their local midnight may be imported but fall outside the window, which is what
  the spec asks for.
- **Alternatives considered**: comparing `start_date` (UTC) with the Berlin season
  start epoch from `seasonStart()` — rejected: it places rides by Berlin time, not
  the rider's.

## R5. Overlapping recordings (FR-005d)

- **Decision**: a ride covers the half-open interval `[start, start + elapsed)`,
  with `start` parsed from `start_date` (UTC) and `elapsed` = `elapsed_time_s`.
  Two rides overlap when each starts before the other ends, so a ride ending at
  10:00 and one starting at 10:00 do not. Only rides that pass every other rule
  are candidates. They are sorted by distance descending, then elevation gain
  descending, then Strava activity ID ascending; each candidate counts unless it
  overlaps a ride already counting, in which case its result is `overlap` and
  names the first counting ride (in that same order) it overlaps.
- **Rationale**: this is FR-005d literally, and the total order (activity IDs are
  unique) makes the result independent of input order. A simple loop over the
  counting rides is O(n²); with ≤ 1,000 rides per season that is at most about 10⁶
  cheap comparisons, so an interval tree isn't worth its code.
- **Alternatives considered**: comparing local start times — rejected: two
  recordings of one ride may carry different time zones (phone vs. bike computer),
  while UTC is unambiguous. Merging overlapping recordings into one — rejected:
  the spec counts the largest, it doesn't combine them.

## R6. Activities with an unknown figure

Feature 001 stores `elapsed_time_s`, `is_manual` and `is_trainer` as `NULL` when
Strava didn't send them, and rows stored before migration `0002` start as `NULL`
until the one-time re-read fills them (feature 001, research R20). The spec of this
feature doesn't say what such a ride earns.

- **Decision**: a ride whose evaluation needs a figure that is unknown doesn't
  count, with the reason `figures_unknown`:
  - elapsed time unknown: the pause rule (FR-005a) and the overlap (FR-005d) can't
    be decided;
  - manual flag unknown: FR-005b can't be decided;
  - trainer flag unknown and the sport type isn't `VirtualRide`: whether the ride
    is virtual (FR-013a) can't be decided. A `VirtualRide` is virtual whatever its
    trainer flag, so there the unknown flag doesn't matter.

  Other reasons are still recorded next to it (e.g. `too_slow`), and such a ride
  never blocks an overlapping ride, like any ride that earns nothing for another
  reason. Once the figure is filled in, the next evaluation counts it normally.
- **Rationale**: feature 001 forbids guessing an unknown figure as 0, "not
  manual" or "not on a trainer"; counting the ride would be exactly that guess.
  Strava's activity summaries normally include all three fields and the re-read
  runs once per rider, so the case is rare and temporary.
- **Alternatives considered**: counting the ride and treating unknown as "not
  manual"/"not virtual" — rejected: it is the guess feature 001 rules out, and a
  later fill-in could take Rynke away. Treating an unknown trainer flag as
  virtual — rejected: also a guess, only in the other direction.
- **Spec follow-up**: FR-014's list of reasons is closed and lacks this one; add
  "figures unknown" there (plan, Open questions).

## R7. Zero moving time (FR-005c)

- **Decision**: a ride with `moving_time_s = 0` gets the reason `too_slow` (it
  didn't move), and no other speed or climbing-rate reason. The pause rule still
  applies on its own (with a positive elapsed time it also gets `pause`).
- **Rationale**: FR-005c says such a ride earns nothing but names no reason, and
  cross-multiplication with 0 would report `too_fast` and `climbing_rate` for any
  distance or elevation, which misleads.
- **Alternatives considered**: a separate reason `no_moving_time` — rejected: one
  more code for a case riders practically never meet.

## R8. Rule values in Stories 1–2 (FR-012)

- **Decision**: `src/rynke/rules.ts` defines a `RideRules` type and a constant
  `DEFAULT_RIDE_RULES` holding the riding rule values: km per distance step (10)
  and Rynke per step (1), metres per elevation step (1000) and Rynke per step (5),
  largest paused share (1/2), lowest and highest average speed (10 and 45 km/h),
  highest climbing rate (1500 m/h), excluded sport types (`EBikeRide`,
  `EMountainBikeRide`) and the qualification deadline (none). The evaluation takes
  the rules as a parameter, never reads the constant itself. Team-event amounts,
  thresholds and the virtual share are added with the stories that use them.
- **Rationale**: FR-012 requires organiser configuration without code changes,
  which needs stored rules and versioning (FR-021, FR-023) — that is Story 5. A
  parameter keeps the evaluation ready for it: Story 5 only changes where the
  values come from.
- **Alternatives considered**: `vars` in `wrangler.jsonc` now — rejected: still a
  deploy per change, and Story 5 replaces it with stored, versioned rules anyway.

## R9. Testing approach (Principle V)

- **Decision**:
  - **Unit** (`test/unit/rides.test.ts`): one test per acceptance scenario 1–4 and
    6–22 of Story 2, with the scenario number in the test name; boundary tests for
    every limit on both sides; the R6 and R7 cases; virtual rides (by sport type
    and by trainer flag) and the without-virtual totals; and order independence
    (every permutation of a small set with overlaps, plus reversed and rotated
    larger sets give identical output). Rides are built with a helper that takes
    readable units (km, hours, metres) and produces synthetic `RideInput`s.
  - **Integration** (`test/integration/evaluate-rider.test.ts`): activities reach
    D1 through the existing `activity-event` handler with fake Strava; the loader
    evaluates them; an update and a delete event follow and the next evaluation
    reflects them (scenario 5). Another rider's activities never appear.
  - Assertions are on codes and numbers; there is no rider-facing text to assert.
- **Rationale**: the rules are pure, so unit tests cover them exhaustively and
  quickly; the integration test proves the loader reads exactly what feature 001
  stores, including `NULL` figures.
- **Alternatives considered**: random property tests with a generator library —
  rejected: a new dev dependency for what fixed permutations already show.
