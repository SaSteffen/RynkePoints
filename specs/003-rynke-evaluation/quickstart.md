# Quickstart: Rynke Evaluation — Stories 1, 2, 3 and 4

How to check that the handout, the ride evaluation, team events and the stored
results work. Tests never touch production or Strava.

## Prerequisites

- `pnpm install` done in the worktree (installs the git hooks too).
- For the handout only: `pandoc` and Chrome or Chromium on the PATH (or `CHROME`
  pointing at the browser binary).

## Story 1: rules handout

```bash
pnpm docs:pdf
```

Expected: `wrote public/rynke-punkte.pdf`; commit it, the rider page links to
it. Compare the PDF with [spec.md](spec.md):
every rule value, threshold and example must match (acceptance scenario 2,
FR-019). Recheck whenever the spec or a rule value changes.

## Stories 2 and 4: automated checks

```bash
pnpm exec vitest run test/unit/rules.test.ts test/unit/rides.test.ts \
  test/unit/tally.test.ts test/unit/reference-riders.test.ts \
  test/unit/activity.test.ts test/integration/reread-page.test.ts \
  test/integration/scheduled-reread.test.ts \
  test/integration/schema-minimisation.test.ts \
  test/integration/rynke-apply.test.ts test/integration/rynke-store.test.ts \
  test/integration/rynke-sweep.test.ts test/integration/rynke-deletion.test.ts \
  test/integration/evaluate-rider.test.ts
pnpm lint && pnpm typecheck && pnpm test
```

Expected: all green. What they show:

| Check | Where | Expected |
|---|---|---|
| Rules | `rules.test.ts` | Invalid rules are refused; changing a rule value without raising the version fails. |
| Story 2 scenarios 1–4, 6–23 | `rides.test.ts`, numbered | Training Rynke as in the spec (79 km + 1999 m → 12; 25 km + 25 km → 4; 600 m + 600 m → 5). |
| Boundaries | `rides.test.ts` | Exactly 10 km/h, exactly half paused, rides touching at 10:00, season start and deadline dates count; one second or metre past a limit doesn't. |
| Unknown figures (FR-005f) | `rides.test.ts`, `rynke-store.test.ts` | A ride with a `NULL` figure still counts unless another rule excludes it, lists the figure, and is re-derived when a later update fills it in. |
| Zero moving time | `rides.test.ts` | `pause`, nothing else from the speed rules. |
| Flagged rides (FR-005g) | `rides.test.ts` | `flagged`, earns nothing, also under rules with every limit relaxed; an unknown flag excludes nothing. |
| Storing the flag (feature 001) | `activity.test.ts`, `reread-page.test.ts`, `scheduled-reread.test.ts`, `schema-minimisation.test.ts` | Strava's `flagged` is stored (missing → `NULL`); riders below figures version 2 are re-read once; rows with `is_flagged` `NULL` are filled. |
| Order independence | `rides.test.ts` | Permutations give identical results and totals. |
| Reference riders (SC-001) | `reference-riders.test.ts` | 30 synthetic riders, each with a one-line hand calculation: training Rynke, team Rynke and qualification match it. |
| Tally fields, qualification, virtual share (Story 4 scenario 8) | `tally.test.ts` | 260 Training with 100 virtual and 25 Team → 160 without virtual, 7 missing, not qualified. |
| Story 2 scenario 5; Story 4 scenarios 1–7, 10–12 | `rynke-store.test.ts` | After each webhook event the stored ride results and balance match a hand calculation, carry rules version and date, and data-model.md's invariants hold after every step: one result per activity, no overlapping counting rides, the balance equals `tally` of the stored results. |
| Diff writes | `rynke-store.test.ts` | A new non-overlapping ride writes its own result and the balance only; `evaluate-rider` on unchanged data writes nothing (SC-002). |
| Storing | `rynke-apply.test.ts` | `applyAndEvaluate` stores a full evaluation in one batch, rewrites every row when the rules version changes, and leaves other riders' activities alone. |
| `evaluate-rider` | `evaluate-rider.test.ts` | Stores results and balance without a Strava call; a second run writes nothing; unknown and `needs_reconnect` riders are dropped. |
| Sweep | `rynke-sweep.test.ts` | `evaluate-rider` is sent for riders without a balance, with an older rules version or a stale result, and for no one else. |
| Deletion | `rynke-deletion.test.ts` | Deleting an activity, narrowing the scope and deleting a rider leave no orphaned result or balance. |
| No Strava | all integration tests | Fake Strava fails on any unexpected request; `evaluate-rider` makes none. |

## Story 3: automated checks

```bash
pnpm exec vitest run test/unit/team-events.test.ts test/unit/tally.test.ts \
  test/unit/rules.test.ts test/unit/reference-riders.test.ts \
  test/integration/team-events-apply.test.ts \
  test/integration/rynke-apply.test.ts test/integration/rynke-store.test.ts \
  test/integration/evaluate-rider.test.ts test/integration/rynke-sweep.test.ts \
  test/integration/rynke-deletion.test.ts \
  test/integration/schema-minimisation.test.ts test/integration/db.test.ts
pnpm lint && pnpm typecheck && pnpm test
```

Expected: all green. What they show (research R23):

| Check | Where | Expected |
|---|---|---|
| Story 3 scenarios 1–4 | `team-events.test.ts`, numbered | 3 team trainings → 3 Team, 15 Training; both days of a weekend → 10 Team, 20 Training; 1 technique training → 5 Team, 5 Training; the same event recorded twice counts once. |
| Story 3 scenarios 5, 6 | `tally.test.ts`, `team-events-apply.test.ts` | Team training plus a 60 km, 1000 m ride → 1 Team, 16 Training; the ride without recorded attendance → 0 Team, 11 Training. |
| Story 4 scenario 9 (team-event part) | `tally.test.ts`, `team-events-apply.test.ts` | 2 team trainings → 2 Team, 10 Training; 1 technique training → 5 Team, 5 Training; every kind listed, the weekend day with 0. |
| Counting window | `team-events.test.ts`, `team-events-apply.test.ts` | Events on the season start and the deadline count; a day outside doesn't; moving an event outside takes its Rynke away. |
| Rules | `rules.test.ts` | Version 2 with the event amounts; version 1 still in the history; missing or negative amounts refused. |
| Changes in one batch | `team-events-apply.test.ts` | Every change kind leaves stored balances equal to a hand calculation; renaming writes no balance; a non-connected rider is refused with `rider_not_connected`; the same final attendance reached in another order gives the same balances (SC-003); removing an attendance can end qualification; `teamEventChange` sends `evaluate-rider` for affected riders only. |
| Activity paths | `rynke-apply.test.ts`, `rynke-store.test.ts`, `evaluate-rider.test.ts` | A new ride for a rider with attendance keeps the event Rynke in the balance; no evaluation changes an attendance (FR-026). |
| Sweep | `rynke-sweep.test.ts` | Attendance inserted with plain SQL puts the rider on the list; a renamed event doesn't; after `evaluate-rider` the rider is off it. |
| Deletion | `rynke-deletion.test.ts` | Deleting a rider removes their attendances and keeps the events; deleting an event removes its attendances. |
| Schema | `schema-minimisation.test.ts`, `db.test.ts` | Exactly the documented columns; the seeded kinds equal `TEAM_EVENT_KINDS`; an unknown kind or a second attendance is refused. |

## Story 3: entering team events by hand (until the organiser pages exist)

The spec's Assumptions make this a manual maintainer step (research R22). Local
first, against `pnpm dev:strava`'s database (`--local`); in production the same
statements with `--remote` are a deliberate manual change of production data.

```bash
pnpm wrangler d1 execute rynke-points --local --command \
  "INSERT INTO team_events (kind, event_date, name)
   VALUES ('team_training', '2026-10-10', 'Saturday ride') RETURNING event_id"
pnpm wrangler d1 execute rynke-points --local --command \
  "INSERT INTO attendances (event_id, athlete_id)
   SELECT 1, athlete_id FROM riders
   WHERE athlete_id IN (111, 222) AND status = 'connected'
   ON CONFLICT DO NOTHING"    # the event_id returned above, the riders' athlete IDs
RYNKE_URL=http://localhost:8789 pnpm daily:run   # needs ADMIN_TOKEN, feature 007
```

Expected: an unknown kind is refused by the foreign key; recording a rider twice
changes nothing; after the run the rider's `rynke_balances.team_event_breakdown` shows the
attendance and `team_rynke` includes it:

```bash
pnpm wrangler d1 execute rynke-points --local \
  --command "SELECT athlete_id, team_rynke, training_rynke, team_event_breakdown FROM rynke_balances"
```

Until the run, the balance doesn't reflect the new rows yet; run it right after
entering them. `pnpm daily:run` runs the whole daily job, not only the sweep: it also
checks every connected rider's Strava membership (one request each, inside
the budget) and deletes riders whose reconnect grace has run out, as the
nightly cron does anyway.

## Local run (optional)

```bash
pnpm wrangler d1 migrations apply rynke-points --local
pnpm dev:strava    # http://localhost:8789, real Strava
```

Without Strava, `pnpm dev` seeds synthetic riders whose rides the app evaluates
the same way ([feature 006 quickstart](../006-local-frontend-dev/quickstart.md)).

With a local setup from feature 001's quickstart, let activities arrive and
inspect the local tables:

```bash
pnpm wrangler d1 execute rynke-points --local \
  --command "SELECT athlete_id, training_rynke, team_rynke, qualified, rules_version FROM rynke_balances"
```

There is no page for the numbers yet (rider-view feature).

## Rollout (production)

1. Merge into `main`; CI applies `0005_rynke_results.sql` before publishing the
   code (additive only, so the old version keeps working in between).
2. New activity events write results immediately. Riders without activity
   changes get theirs at the next daily cron (03:17 UTC) through the sweep; no
   manual step is needed. Where feature 001's one-time re-read (figures version
   2) is still filling `is_flagged`, results follow as those writes arrive.
3. Optional check, run by the maintainer (a manual production read):

   ```bash
   pnpm wrangler d1 execute rynke-points --remote \
     --command "SELECT COUNT(*) FROM rynke_balances"
   ```

   After the first cron it equals the number of connected riders.
4. Whenever `CURRENT_RULES.version` goes up in a later release, the next cron
   re-evaluates everyone (Story 5 will shorten this to within an hour).

### Story 3 release

1. Merge into `main`; CI applies `0006_team_events.sql` before publishing the
   code (new tables, one balance column with a default; the old version keeps
   working in between).
2. The release raises the rules to version 2 (research R18). The maintainer runs
   `pnpm daily:run` right after the deploy, so every rider is re-evaluated within
   minutes instead of at the next night's cron; until then feature 005's page
   says their numbers are being updated.
3. Optional check (a manual production read): no balance with version 1 or an
   empty breakdown remains.

   ```bash
   pnpm wrangler d1 execute rynke-points --remote \
     --command "SELECT COUNT(*) FROM rynke_balances WHERE rules_version < 2 OR team_event_breakdown = '[]'"
   ```

   Expected: 0.
