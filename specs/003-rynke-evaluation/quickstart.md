# Quickstart: Rynke Evaluation — Stories 1, 2 and 4

How to check that the handout, the ride evaluation and the stored results work.
Tests never touch production or Strava.

## Prerequisites

- `pnpm install` done in the worktree (installs the git hooks too).
- For the handout only: `pandoc` and Chrome or Chromium on the PATH (or `CHROME`
  pointing at the browser binary).

## Story 1: rules handout

```bash
pnpm docs:pdf
```

Expected: `wrote dist/rynke-punkte.pdf`. Compare the PDF with [spec.md](spec.md):
every rule value, threshold and example must match (acceptance scenario 2,
FR-019). Recheck whenever the spec or a rule value changes.

## Stories 2 and 4: automated checks

```bash
pnpm exec vitest run test/unit/rides.test.ts test/unit/tally.test.ts \
  test/unit/activity.test.ts test/integration/reread-page.test.ts \
  test/integration/scheduled-reread.test.ts \
  test/integration/schema-minimisation.test.ts \
  test/integration/rynke-store.test.ts test/integration/rynke-sweep.test.ts \
  test/integration/rynke-deletion.test.ts
pnpm lint && pnpm typecheck && pnpm test
```

Expected: all green. What they show:

| Check | Where | Expected |
|---|---|---|
| Story 2 scenarios 1–4, 6–23 | `rides.test.ts`, numbered | Training Rynke as in the spec (79 km + 1999 m → 12; 25 km + 25 km → 4; 600 m + 600 m → 5). |
| Boundaries | `rides.test.ts` | Exactly 10 km/h, exactly half paused, rides touching at 10:00, season start and deadline dates count; one second or metre past a limit doesn't. |
| Unknown figures (FR-005f) | `rides.test.ts`, `rynke-store.test.ts` | A ride with a `NULL` figure still counts unless another rule excludes it, lists the figure, and is re-derived when a later update fills it in. |
| Zero moving time | `rides.test.ts` | `pause`, nothing else from the speed rules. |
| Flagged rides (FR-005g) | `rides.test.ts` | `flagged`, earns nothing, also under rules with every limit relaxed; an unknown flag excludes nothing. |
| Storing the flag | `activity.test.ts`, `reread-page.test.ts`, `scheduled-reread.test.ts`, `schema-minimisation.test.ts` | Strava's `flagged` is stored (missing → `NULL`); riders below figures version 2 are re-read once; rows with `is_flagged` `NULL` are filled. |
| Order independence | `rides.test.ts` | Permutations give identical results and totals. |
| Tally fields, qualification, virtual share (Story 4 scenario 8) | `tally.test.ts` | 260 Training with 100 virtual and 25 Team → 160 without virtual, 7 missing, not qualified. |
| Story 2 scenario 5; Story 4 scenarios 1–7, 10–12 | `rynke-store.test.ts` | After each webhook event the stored ride results and balance match a hand calculation, carry rules version and date, and the balance always equals the sum of the stored results. |
| Diff writes | `rynke-store.test.ts` | A new non-overlapping ride writes its own result and the balance only; `evaluate-rider` on unchanged data writes nothing (SC-002). |
| Sweep | `rynke-sweep.test.ts` | `evaluate-rider` is sent for riders without a balance, with an older rules version or a stale result, and for no one else. |
| Deletion | `rynke-deletion.test.ts` | Deleting an activity, narrowing the scope and deleting a rider leave no orphaned result or balance. |
| No Strava | all integration tests | Fake Strava fails on any unexpected request; `evaluate-rider` makes none. |

## Local run (optional)

```bash
pnpm wrangler d1 migrations apply rynke-points --local
pnpm dev
```

With a local setup from feature 001's quickstart, let activities arrive and
inspect the local tables:

```bash
pnpm wrangler d1 execute rynke-points --local \
  --command "SELECT athlete_id, training_rynke, team_rynke, qualified, rules_version FROM rynke_balances"
```

There is no page for the numbers yet (rider-view feature).

## Rollout (production)

1. Merge into `main`; CI applies `0003_rynke_results.sql` before publishing the
   code (additive only, so the old version keeps working in between).
2. New activity events write results immediately. Riders without activity
   changes get theirs at the next daily cron (03:17 UTC) through the sweep; no
   manual step is needed. The same cron starts the one-time re-read that fills
   `is_flagged` for stored activities (figures version 2); results follow as
   those writes arrive.
3. Optional check, run by the maintainer (a manual production read):

   ```bash
   pnpm wrangler d1 execute rynke-points --remote \
     --command "SELECT COUNT(*) FROM rynke_balances"
   ```

   After the first cron it equals the number of connected riders.
4. Whenever `CURRENT_RULES.version` goes up in a later release, the next cron
   re-evaluates everyone (Story 5 will shorten this to within an hour).
