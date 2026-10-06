# Research: Rynke Evaluation — Stories 1, 2 and 4

Decisions behind [plan.md](plan.md). Stories 3, 5 and 6 add their own entries
later.

## R1. Rules handout: what is left (Story 1, FR-017–FR-020)

- **Decision**: no new work beyond the review. `docs/rynke-punkte.md` (German,
  opening with the team purpose) and `scripts/docs-pdf.sh` (`pnpm docs:pdf`,
  pandoc plus headless Chrome, output `dist/rynke-punkte.pdf`, gitignored)
  already exist and cover every topic FR-017 lists. Acceptance scenario 2 is a
  manual comparison against the spec, repeated whenever the spec or a rule value
  changes (FR-019). The handout states that rides Strava has flagged never count
  (FR-005g). FR-005f (unknown figures) and the zero-moving-time sentence in
  FR-005a are internal and change nothing a rider sees, so the handout doesn't
  mention them.
- **Rationale**: FR-018 makes the handout and its script a seldom-used manual
  task without automated tests.
- **Alternatives considered**: rendering the PDF in CI — rejected: it adds pandoc
  and Chrome to CI for a document printed a few times a season.

## R2. Story boundaries: 2 and 4 without 3

- **Decision**: Story 2 is the pure evaluation `evaluateRides()`. Story 4 adds
  the tally, storage and the triggers. The tally takes, next to the riding
  totals, an `extras` input (Team and Training Rynke per team-event kind, and
  corrections) that is empty until Stories 3 and 6 supply it; the stored balance
  already has the totals, missing amounts and qualification, and Story 3 adds its
  breakdown columns or table in a later, additive migration.
- **Rationale**: Story 4's scenarios 1–8 and 10–12 only need rides. Scenario 9
  (events and corrections in the tally) is tested with Story 3 and Story 6.
  Qualification is computed now; with no team events every rider has 0 Team
  Rynke and doesn't qualify, as the spec's Assumptions already say. The tally's
  qualification logic is still unit-tested with non-zero `extras`.
- **Alternatives considered**: adding team-event columns now — rejected: Story 3
  hasn't been planned, and Story 5 mentions new event kinds, so a fixed set of
  columns may be the wrong shape; additive migrations make adding them later
  cheap.

## R3. Exact arithmetic at the rule boundaries

Several acceptance scenarios sit exactly on a limit (10 km/h counts, a pause of
exactly half the moving time counts, 1999 m + 1 m = 2000 m earns 10). Floating
point division can land a hair on either side.

- **Decision**:
  - **Distance**: `floor(distance_m / (distanceStepKm × 1000)) ×
    distanceStepRynke`, per ride. Dividing an exact multiple of 10,000 by 10,000
    is exact in IEEE 754, so 100 km earns exactly 10.
  - **Elevation**: each ride's gain is converted once to whole decimetres
    (`round(elevation_gain_m × 10)`) and the season total is summed as integers.
    Strava reports elevation gain to 0.1 m, so this loses nothing, while a sum of
    floats such as 600.1 + 399.9 could end at 999.999… and miss a step.
  - **Limits** are compared by cross-multiplication, never by dividing:
    - pause: `(elapsed_s − moving_s) × den ≤ moving_s × num` for the share
      `num/den` (1/2);
    - speed: `minSpeedKmh × 1000 × moving_s ≤ distance_m × 3600 ≤ maxSpeedKmh ×
      1000 × moving_s`;
    - climbing rate: `elevation_dm × 3600 ≤ maxClimbMPerH × 10 × moving_s`.
  - Shares are fractions (`{ num, den }`), not decimals. The virtual-share
    requirement is `ceil(trainingThreshold × (den − num) / den)` in integers for
    the largest virtual share `num/den` (1/3 gives 167 of 250).
- **Rationale**: with integer inputs (Strava's times are whole seconds, the rule
  values whole numbers) every comparison above is exact.
- **Alternatives considered**: an epsilon tolerance — rejected: it moves the
  limit by an arbitrary amount. Integer metres — rejected: up to 0.5 m dropped
  per ride, against FR-004a's "no metre dropped".

## R4. Counting window and time zones (FR-011)

- **Decision**: a ride is placed by the date part of `start_date_local` (its
  first ten characters). It is inside the window when that date is on or after
  `SEASON_START_DATE` and, if the rules set a qualification deadline, on or
  before it. Both bounds are `YYYY-MM-DD` strings compared as strings. The
  deadline is unset in `CURRENT_RULES`.
- **Rationale**: the spec places a ride by its start date in the rider's local
  time zone. Strava's `start_date_local` is that wall-clock time (despite its
  trailing `Z`), so no time-zone arithmetic is needed. Feature 001 imports from
  Berlin midnight; a ride started abroad shortly before local midnight may be
  imported but fall outside the window, as the spec asks.
- **Alternatives considered**: comparing `start_date` (UTC) with
  `seasonStart()`'s Berlin epoch — rejected: it places rides by Berlin time.

## R5. Overlapping recordings (FR-005d)

- **Decision**: a ride covers `[start, start + duration)`, with `start` from
  `start_date` (UTC) and `duration` = elapsed time, or moving time when the
  elapsed time is unknown (FR-005f). Two rides overlap when each starts before
  the other ends, so a ride ending at 10:00 and one starting at 10:00 don't.
  Candidates are the rides that pass every other rule, sorted by distance
  descending, elevation gain descending, then activity ID ascending; each counts
  unless it overlaps a ride already counting, in which case its result is
  `overlap` and names the first counting ride in that order it overlaps.
- **Rationale**: FR-005d literally; activity IDs are unique, so the order is
  total and the result doesn't depend on input order. A plain loop is O(n²),
  at most about 10⁶ cheap comparisons for 1,000 rides.
- **Alternatives considered**: local start times — rejected: two recordings of
  one ride may carry different time zones. Merging recordings — rejected: the
  spec counts the largest.

## R6. Unknown figures (FR-005f)

Feature 001 stores `elapsed_time_s`, `is_manual`, `is_trainer` and `is_flagged`
as `NULL` when Strava didn't send them, and rows stored before the migration that
added a column stay `NULL` until feature 001's one-time re-read fills them (its
research R20; R15 below for `is_flagged`).

- **Decision** (spec clarification of 2026-10-06): an unknown figure never
  excludes a ride.
  - Elapsed time unknown: the pause rule is not applied; the overlap interval
    uses the moving time (R5).
  - Manual flag unknown: FR-005b is not applied.
  - Strava's flag unknown: FR-005g is not applied.
  - Trainer flag unknown: the ride is virtual only if its sport type is
    `VirtualRide`; otherwise it counts as not virtual, including for the
    Training Rynke without virtual rides.
  - The ride result lists the unknown figures as codes (`elapsed_time`,
    `manual`, `trainer`, `flagged`), so a later rider view can mark the result as
    provisional. A trainer flag on a `VirtualRide` is not needed and not listed.
  - When feature 001 fills a figure in, it writes the activity through the same
    path as any update, which re-evaluates the rider (R11).
- **Rationale**: the project owner's answer: the ride is re-evaluated once the
  data is there, so excluding it in the meantime would only take Rynke away
  temporarily.
- **Alternatives considered**: excluding such rides with a reason
  `figures_unknown` (this plan's first draft) — rejected by the project owner.

## R7. Zero moving time (FR-005a)

- **Decision**: a ride with `moving_s = 0` gets the reason `pause`, whatever its
  elapsed time (also 0 or unknown). The speed and climbing-rate limits are not
  checked for it, since an average over no moving time doesn't exist.
- **Rationale**: spec clarification of 2026-10-06: zero moving time is a ride
  paused for its whole duration. Cross-multiplication alone would let a ride
  with 0 moving and 0 elapsed time pass the pause rule and then report
  `too_fast` and `climbing_rate`, which misleads.

## R8. Rules as a versioned code constant (FR-012, FR-023)

- **Decision**: `src/rynke/rules.ts` defines `RynkeRules` and `CURRENT_RULES`:
  `version` (integer, starts at 1), `effectiveDate` (`YYYY-MM-DD`), and the rule
  values Stories 2 and 4 use — distance and elevation steps, paused share, speed
  and climbing limits, excluded sport types (`EBikeRide`, `EMountainBikeRide`),
  qualification deadline (none), thresholds (250 Training, 25 Team) and the
  largest virtual share (1/3). Team-event amounts come with Story 3. The evaluation takes
  the rules as a parameter and never reads the constant itself. A developer
  raises `version` and sets `effectiveDate` in the same change as any change of a
  value or of rule logic; a unit test pins a fingerprint of the values to the
  version, so a value changed without a version bump fails.
- **Rationale**: FR-023 needs a version on every stored row now (Story 4
  scenarios 11, 12). Storing rules as organiser configuration, changeable without
  code changes (FR-012), needs organiser pages and recalculation — Story 5 and
  the organiser-admin feature. A parameter means Story 5 only changes where the
  rules come from.
- **Alternatives considered**: a `rules` table now — rejected: nothing could
  change it except a manual SQL step, and Story 5 will define the shape.
  `vars` in `wrangler.jsonc` — rejected: still a deploy per change and no place
  for the version.

## R9. Testing approach (Principle V)

- **Decision**:
  - **Unit** `test/unit/rides.test.ts`: Story 2 scenarios 1–4 and 6–23 (numbered
    in the test names), both sides of every limit, flagged rides (R15) also
    under rules with every other limit relaxed, unknown figures (R6), zero
    moving time (R7), virtual rides and the without-virtual totals, and order
    independence (every permutation of a small overlapping set; reversed and
    rotated larger sets).
  - **Unit** `test/unit/tally.test.ts`: every FR-014a field from riding totals and
    `extras`; Story 4 scenario 8 (virtual share) with 25 Team Rynke passed as an
    extra; floors at 0; the rules fingerprint test (R8).
  - **Integration** `test/integration/rynke-store.test.ts`: Story 2 scenario 5 and
    Story 4 scenarios 1–7 and 10–12 through the webhook path with fake Strava;
    only changed rows are written (count rows before/after); the read snapshot.
  - **Integration** `rynke-sweep.test.ts` and `rynke-deletion.test.ts`: the cron
    sends `evaluate-rider` exactly for riders that need it (R14); deleting an
    activity, narrowing the scope and deleting a rider leave no result behind.
  - **Feature 001's flag** (R15): `test/unit/activity.test.ts` maps `flagged`
    (true, false, missing → `NULL`); `reread-page.test.ts` re-reads rows whose
    `is_flagged` is `NULL`; `scheduled-reread.test.ts` re-reads riders below
    figures version 2; `schema-minimisation.test.ts` lists the new column and
    the two new tables.
  - SC-002: after any sequence of events, `evaluate-rider` from scratch writes
    nothing (the stored state already equals a full evaluation).
- **Rationale**: the rules are pure, so unit tests cover them exhaustively; the
  integration tests prove the batch, the triggers and the deletion paths.
- **Alternatives considered**: a property-testing library — rejected: a new dev
  dependency for what fixed permutations show.

## R10. Storage shape (FR-014, FR-014a)

- **Decision**: two tables (details in [data-model.md](data-model.md)):
  - `ride_results`, keyed by `strava_activity_id` (FK to `activities`, cascade),
    with `athlete_id` (FK to `riders`, cascade) for per-rider reads. Reasons and
    unknown figures are JSON arrays of codes (`CHECK (json_valid(…))`); the
    activity's `refreshed_at` is copied in as `activity_refreshed_at` to detect a
    stale result (R14).
  - `rynke_balances`, keyed by `athlete_id` (FK to `riders`, cascade), one column
    per FR-014a field Stories 2 and 4 produce, plus `rules_version`,
    `rules_effective_date` and `computed_at`.
  - Elevation in decimetres (R3); no elevation Rynke per ride.
- **Rationale**: rows mirror the evaluation output one to one, so the diff (R13)
  is a field-by-field comparison. JSON arrays keep the code lists open for new
  codes without a migration and stay language-independent (FR-016).
- **Alternatives considered**: a bitmask for reasons — rejected: unreadable in
  SQL and fragile when codes are added. A separate reasons table — rejected: more
  rows written for no reader that needs it.

## R11. One batch per input change (FR-003, FR-014b, FR-015)

- **Decision**: `applyAndEvaluate(db, athleteId, change, rules, window)`:
  1. reads, in one batch, the rider's activities and stored ride results and
     balance;
  2. applies `change` in memory — upsert records, delete activity IDs, or delete
     private activities;
  3. evaluates and tallies;
  4. writes, in one `db.batch`, the activity statements for `change`, the ride
     result diff and the balance.

  `activity-event`, the import and re-read page (`storeActivityPage`) and the OAuth
  callback's private-activity removal go through it instead of calling the
  activity writes directly. `evaluate-rider` calls it with an empty change. The
  callback also sends `evaluate-rider` afterwards (see Rationale).
- **Rationale**: a D1 batch is a transaction, so the activity, its result and the
  balance change together; a reader sees either the old or the new state, never a
  mix. The consumer runs with `max_concurrency: 1`, so consumer paths never race
  each other. The only concurrent writer is the OAuth callback (a fetch handler)
  when a reconnecting rider narrows their scope: if a consumer message for the
  same rider is in flight, one side may write from a snapshot that misses the
  other's change. The `evaluate-rider` the callback sends runs after any
  in-flight consumer message (serial consumer) and re-derives from the final
  state, so such a mismatch lasts seconds. It needs a reconnect with a narrowed
  scope and a webhook for the same rider at the same moment; that is accepted
  rather than guarded.
- **Alternatives considered**:
  - Enqueue `evaluate-rider` after each activity write — rejected: between the
    write and the evaluation, a deleted activity's result is gone (cascade) while
    the balance still counts it, which FR-014b forbids.
  - Evaluate inside the same handler but in a second batch — same gap, smaller.
  - Recomputing in SQL — rejected: the rules are TypeScript (Principle IV keeps
    them pure functions) and the overlap rule is awkward in SQL.

## R12. Qualification and missing amounts (FR-013, FR-013a, FR-014a)

- **Decision**: `tally(riding, extras, rules)`:
  - Training total = riding Training Rynke + extras' Training Rynke, Team total =
    extras' Team Rynke; both floored at 0 (spec: never below 0).
  - Missing = `max(0, threshold − total)` for each threshold.
  - Without virtual = riding totals without virtual rides + extras' Training
    Rynke (team events and corrections are not virtual rides); missing for the
    share = `max(0, ceil(threshold × (den − num) / den) − without virtual)`, 167
    by default (R3).
  - Qualified when all three missing amounts are 0.
  - Elevation to the next step: `step − (total mod step)`, so 2000 m shows a full
    1000 m to go.
- **Rationale**: FR-013a says the Training Rynke "the rider would have without
  their virtual rides"; event and correction Rynke are not ride Rynke, so they
  stay in.
- **Open for Story 6**: whether a negative correction can push the
  without-virtual value below 0 — floored at 0 like the totals.

## R13. Writing only what changed (D1 free tier)

- **Decision**: `apply.ts` compares the new ride results with the stored ones
  and writes only rows that are new, changed or gone: one `INSERT … SELECT …
  FROM json_each(?) ON CONFLICT DO UPDATE` with all changed rows as one JSON
  parameter, and one `DELETE … WHERE strava_activity_id IN (SELECT value FROM
  json_each(?))` (skipped when empty). The balance row is written only if a field
  changed. `computed_at` changes only with the row.
- **Rationale**: D1's free plan allows 100,000 rows written per day, counting
  deletes and each index entry. Rewriting a 300-ride season on every activity
  event would cost about 1,200 rows per event; with diffs a typical new ride
  writes about 5 (activity, its result, maybe one overlapped ride, the balance,
  index entries). The initial fill writes each result once (≈ 600 rows per rider
  with its index), and a rules-version bump rewrites every result once — both
  far below the limit for ≤ 10 riders. A JSON parameter also stays clear of the
  100-bound-parameter limit, whatever the number of rides.
- **Alternatives considered**: one statement per ride result in the batch —
  rejected: hundreds of statements, and D1's docs don't say whether batch
  statements count separately towards the 50-queries-per-invocation limit. Delete
  all and reinsert — rejected: the write volume above.

## R14. Catch-up sweep in the daily cron (rollout, version bumps, races)

- **Decision**: a new cron step lists connected riders for whom any of these
  holds, and sends each one `evaluate-rider`:
  - no `rynke_balances` row;
  - a balance or ride result with `rules_version` ≠ `CURRENT_RULES.version`;
  - an activity without a ride result, or with `refreshed_at` ≠ the result's
    `activity_refreshed_at`.

  It runs after the existing steps and sends in batches of 100, like the re-read
  fan-out.
- **Rationale**:
  - **Rollout**: after `0003` is applied, no rider has results; the first cron
    fills them without a manual step.
  - **Rules version bump**: a deploy with a new version is followed within a day.
    SC-006's 1 hour and an organiser-started recalculation are Story 5.
  - **Safety net**: if a message is lost (e.g. the callback's `evaluate-rider`
    send fails after its batch, R11) or anything else leaves an activity without
    a current result, the sweep finds it.
- **Alternatives considered**: a version counter per rider checked inside the
  batch (R11's race) — rejected: D1 batches can't abort on a failed condition
  without a constraint trick, for a race that needs a reconnect and a webhook in
  the same second. Hourly cron — deferred to Story 5, which needs it for SC-006.

## R15. Rides Strava has flagged (FR-005g, feature 001 FR-013)

- **Decision**:
  - **Storing the flag** is a feature 001 change made here, since nothing else
    needs it yet. Strava's activity responses (summary in the list, detailed per
    activity) carry a boolean `flagged`, so no request is added.
    - Migration `0003_rynke_results.sql` also adds `activities.is_flagged`
      (nullable, `CHECK (is_flagged IN (0, 1))`, no default), like `0002` did
      for the other flags.
    - `toActivityRecord` maps it with the existing `flag()` helper: missing
      stays `NULL`, never "not flagged".
    - `ACTIVITY_FIGURES_VERSION` goes from 1 to 2, so the daily cron re-reads
      every connected rider once (feature 001 research R20). The re-read's
      check for rows still lacking a figure includes `is_flagged IS NULL`.
    - The explanation before connecting (feature 001 FR-002) names the flag in
      both catalogs.
  - **Evaluating**: reason `flagged` when `is_flagged = 1`, checked
    independently like the other rules, so a flagged ride can carry further
    codes. It is not a field of `RynkeRules`: no rules version can switch it
    off, as FR-005g requires.
  - **Flagged later**: Strava's webhook docs list update events for title,
    sport type and privacy only, and nothing for flagging. A stored ride that
    Strava flags later is re-read at the next update event for it, at an import
    after reconnecting, or at a figures re-read, and then stops counting
    through the usual write path (R11). The plan adds no polling (feature 001
    FR-010); the project owner accepts the delay, as both specs record.
- **Rationale**: the rule must hold whatever the configuration, so it lives in
  the evaluation code rather than the rule values. `0003` runs before the code
  that writes the column is published; the old code doesn't know the column,
  so rows it writes in between stay `NULL` until the re-read fills them.
- **Alternatives considered**:
  - A separate migration for the column — rejected: one additive migration per
    release is enough, and both changes ship together.
  - A periodic re-read of recent activities to catch late flags — rejected: it
    costs Strava requests for every rider every day and contradicts feature 001
    FR-010, and the project owner accepts the delay.
  - Treating an unknown flag as flagged — rejected: FR-005f; every rider's rows
    would stop counting until the re-read.
