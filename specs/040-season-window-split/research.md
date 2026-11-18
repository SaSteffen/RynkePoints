# Research: Season and Qualification Window

## R1. Where the window start lives

**Decision**: A new Wrangler var `QUALIFICATION_START_DATE` in every team block (`hamburg`,
`sandbox-hamburg`: `2026-09-01`; `europe`, `sandbox-europe`: `2027-01-01`), next to
`QUALIFICATION_DEADLINE`. `SEASON_START_DATE` keeps its name and now means only the season start;
Europe's two blocks change from `2027-01-01` to `2026-09-01`.

**Rationale**: The deadline is already a Wrangler var, and both window bounds belong together. The
season start must stay a var because it moves every year and `config.seasonStart`, the fake clock
and the album script already read it.

**Alternatives**: the window start in `src/teams/<id>.ts` (splits the window over two places);
deriving the season start from the window (hides the 1 September rule instead of checking it).

## R2. One rename makes every consumer choose

**Decision**: `CountingWindow.seasonStart` becomes `windowStart` (the window's first day), and the
season start is passed separately where it is needed: `countingWindow(env)` returns
`{ seasonStart, windowStart, deadline }`, with `seasonStart` kept only for the season-based callers
listed below. `inCountingWindow` and `eventInWindow`'s non-tour branch use `windowStart`; `seasonEnd`
and tour days use `seasonStart`.

Because the old field disappears from every window-only use, `tsc` lists each of the ~25 files
that read it, and each is decided once:

| Follows the **season** (`seasonStart`) | Follows the **window** (`windowStart`) |
|---|---|
| fetch epoch (`config.seasonStart`: activity-page, catch-up, auth, scheduled) | `reasonsFor` / `inCountingWindow` |
| `seasonEnd`, rollover, `participation.ts` season bounds | pace, plan, `weeks.ts`, ride figures |
| `badgesFor`, `badges/evaluate`, hints, view, `db/badges.ts`, team badge news | progress views and organiser progress graphs |
| tour days (`eventInWindow` tour branch), `team-events.ts` listing | events other than tour days, corrections |
| album load (season end, badges) | rider view's status box and pre-window reason |
| "before the season" waiting state (`overview.ts`) | organiser overview figures, team section |

For Hamburg both dates are equal, so every choice gives today's output (SC-001); the pinned
Hamburg pages snapshot (feature 039) proves it.

**Alternatives**: keeping `seasonStart` and adding `windowStart` beside it (compiles unchanged,
so a missed consumer silently keeps the season start: exactly the bug class to avoid).

## R3. A pre-window ride is a reason, not a column

**Decision**: A new reason code `before_window` for a ride dated on or after the season start and
before the window start. `outside_window` keeps covering before the season and after the deadline.
A ride whose only reason is `before_window` is a **pre-window ride**:

- In `evaluateRides`, overlap resolution runs over rides with no reason **or** only
  `before_window`, so two recordings of one pre-window ride don't both feed badges.
- Its result keeps `counts = 0`, `distance_rynke = 0`, but stores its real `elevation_dm`
  (badges need it; balances and every Rynke sum read `counts = 1` only, so nothing else moves).
- A pre-window ride that fails another rule lists both reasons and is a plain not-counting ride
  (FR-013).

**Rationale**: `ride_results.reasons` is JSON without a constraint, so no migration (feature 039
research R1). Hamburg never produces `before_window`: its window starts on its season start and
nothing before the season is fetched. No rule version or fingerprint changes.

**Alternatives**: a `for_badges` column (migration plus backfill, and a gap where the previous
version writes rows without it); evaluating twice, once without the window (doubles overlap logic).

## R4. Badges read "counts or pre-window"

**Decision**: One SQL fragment in `src/db/`, `BADGE_RIDE = "(r.counts = 1 OR r.reasons =
'[\"before_window\"]')"`, replaces `r.counts = 1` in the badge queries only (`db/badges.ts` and
the team badge totals). Training Rynke badges keep reading balances (FR-015). Every graph,
ranking, figure and total keeps `counts = 1` (FR-010).

**Rationale**: The reasons array is written by one function in a fixed order, so the exact JSON
match is stable; a test pins it.

## R5. Badge list by season

**Decision**: `badgesFor(team, window)` takes the season start (1 September) to the deadline.
Europe's list then equals Hamburg's minus the event-only categories (FR-016), with no catalog
version change: Europe has no stored badges in production.

## R6. Ride status on the page

**Decision**: The rider view gains a fourth ride status, `not-yet`, set when a result's only
reason is `before_window`. `rideCard` maps it to the orange chip (`.ride-not-yet`, in the
orange `--rp-push-container` / `--rp-on-push-container` pair of the status chips; the drafted
`--rp-bar-warning` text on a 26 % mix reaches only about 3.4:1 in the light theme), "–" for Training
Rynke and counted elevation, and the open "Warum?" box with `rynke.reason.before_window`.
Organisers see no rider's ride cards (their rider page holds corrections), so there is no second
place to mark.

## R7. Status box

**Decision**: Feature "deadline countdown" (#359, merged) shows `rynke.deadline.notStarted` before
the window. Its date becomes the window start and its text the settled one (FR-017) in all ten
catalogs. From the window start the countdown and plan show as today.

## R8. Fake mode and e2e days

**Decision**: `RYNKE_FAKE_SEASON_DAY` keeps counting from `SEASON_START_DATE`. Europe's season start
moving four months earlier shifts Europe's e2e day: `pnpm test:e2e:server:europe` gets a day that
lands on the same calendar date as today (+122 days), so `europe-smoke` keeps testing inside the
window. Europe's samples (`samples.europe.ts`) get rides from September to December, November and
December included (FR-020), dated relative to the season start; the 039 "no November/December"
test is inverted. A second Europe fake day before 1 January is used for the pre-window e2e check
(FR-021).

## R9. Team settings check

**Decision**: `scripts/team-check.mjs` refuses a block whose `SEASON_START_DATE` isn't a 1
September, whose `QUALIFICATION_START_DATE` is before it, after the deadline, or whose deadline is
after the season end (FR-001, FR-003). `config.ts` lists the new var; `pnpm types` regenerates
`worker-configuration.d.ts`. The album script passes the new var through.

## R10. Strava budget

**Decision**: No change. A Europe rider's first fetch reads up to four more months, a few more
pages; Europe has few riders (spec Assumptions).
