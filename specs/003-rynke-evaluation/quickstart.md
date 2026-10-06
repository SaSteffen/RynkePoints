# Quickstart: Rynke Evaluation — Stories 1 and 2

How to check that the rules handout and the ride evaluation work. Nothing here
touches production or Strava.

## Prerequisites

- `pnpm install` done in the worktree (installs the git hooks too).
- For the handout only: `pandoc` and Chrome or Chromium on the PATH (or `CHROME`
  pointing at the browser binary).

## Story 1: rules handout

```bash
pnpm docs:pdf
```

Expected: `wrote dist/rynke-punkte.pdf`. Open the PDF and compare it with
[spec.md](spec.md): every rule value, threshold and example must match
(acceptance scenario 2, FR-019). `dist/` is not committed.

Recheck whenever the spec or a rule value changes, and once the open questions of
[plan.md](plan.md) (unknown figures, zero moving time) are in the spec.

## Story 2: Training Rynke from rides

```bash
pnpm exec vitest run test/unit/rides.test.ts test/integration/evaluate-rider.test.ts
pnpm lint && pnpm typecheck && pnpm test
```

Expected: all green. What the tests prove:

| Check | Where | Expected |
|---|---|---|
| Acceptance scenarios 1–4 and 6–22 of Story 2 | `test/unit/rides.test.ts`, one test each, numbered | Training Rynke as in the spec (e.g. 79 km + 1999 m → 7 + 5 = 12; 25 km + 25 km → 4; 600 m + 600 m → 5). |
| Scenario 5: edit and delete follow | `test/integration/evaluate-rider.test.ts` | After a webhook `update` with a shorter distance and a `delete`, the next evaluation reflects only the current rides. |
| Boundaries | unit | Exactly 10 km/h, exactly half paused, rides touching at 10:00, season start date and deadline date all count; one second or metre past a limit doesn't. |
| Reason codes | unit | Each code of [contracts/ride-evaluation.md](contracts/ride-evaluation.md) appears in the stated cases and order; `overlap` names the larger ride. |
| Unknown figures | unit + integration | A ride with `NULL` elapsed time, manual flag or (non-virtual sport type) trainer flag gets `figures_unknown`, earns nothing and blocks no other ride. |
| Virtual rides | unit | `VirtualRide` and trainer rides are `virtual`; `withoutVirtual` leaves them out after the overlap decision and floors the elevation again. |
| Order independence | unit | Every permutation of a small overlapping set, and reversed/rotated larger sets, give identical results and totals. |
| Isolation | integration | Another rider's activities never appear; no Strava request is made by the evaluation (fake Strava fails on unexpected calls). |

## Trying it by hand (optional, local only)

There is no page or route for the numbers yet (rider view is a separate feature,
storage is Story 4). To look at a result during development, call
`evaluateRider` from a scratch test against the local D1 that `pnpm test` sets
up, with synthetic activities from `test/support/rides.ts`. Never point it at
real rider data.
