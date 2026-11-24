# Research: Strava Call Counts

The spec left no open questions; these are the design decisions behind the plan.

## R1. Where the action comes from

- **Decision**: the action travels on the context. `Ctx` gains an optional
  `stravaAction`, and `StravaCtx` (`Pick<Ctx, "env" | "now">`) picks it too. The
  place where a piece of work starts sets it once:
  - the queue consumer and the drain, per message, before calling the handler
    (`actionOf(message)`, R2);
  - the OAuth callback (`connect`);
  - leaving on `/me` and removing on Admin › Rider (`leave`);
  - the daily `settleWithdrawals` run (`leave`).
  Without one, a call counts as `unassigned` (FR-003).
- **Rationale**: every Strava call already goes through `stravaFetch` (and
  the budget checks in `apiGet`, `postToken` and `revokeToken`), and every one of
  them already gets a `StravaCtx`. Setting the action where work starts reaches
  token refreshes inside any action for free (FR-002), and a new caller that
  forgets it shows up as unassigned (FR-020) instead of failing to compile in
  many places.
- **Alternatives considered**: an `action` parameter on every client function
  (`getActivity`, `isClubMember`, `getAccessToken`, `revokeToken`, …): many
  signatures and every call site change, and `getAccessToken` would need it
  threaded through for the refresh. Inferring the action from the endpoint:
  impossible, since several actions use the same endpoints.

## R2. Message kinds to actions

| Where the work starts | Action |
|---|---|
| `activity-event` | `ride-event` |
| `import-page` | `import` |
| `reread-page` | `reread` |
| `check-membership` | `club-check` |
| `recheck-rider` | `recheck` |
| `delete-rider`, reason `deauthorized` | `disconnect` |
| `delete-rider`, other reasons (`left-club`, `reconnect-expired`, `guest-removed`) | `leave` |
| `evaluate-rider`, `send-notification` | none (they make no Strava calls; a call would count as `unassigned`) |
| OAuth callback | `connect` |
| `/me` leave, Admin remove, daily `settleWithdrawals` | `leave` |

The spec's "Leaving" term was widened to the deletions after the club check, a
guest taken off and a reconnect that never came, and to the daily withdrawal
retry, which all give access back the same way.

## R3. What counts as a call, and where it is counted

- **Decision**: `stravaFetch` counts a call whenever `fetch` returned a response,
  whatever its status (a `429` included), and not on a network error (FR-004).
  It counts in the same best-effort `try` as the rate-limit headers: a counting
  failure is logged without IDs and never fails or delays the call's result
  (FR-006).
- **Rationale**: Strava counts every request it answered. Today's own counts
  (`own_all_daily`) only count answers with usage headers; the fake Strava sends
  none, so counting on headers would leave the table empty in fake mode and the
  sandboxes (FR-019). In production every answer carries the headers, so both
  totals agree there.
- **Alternatives considered**: reusing `own_all_daily`: it has no action or
  endpoint, and resets each day in one row.

## R4. Held back

- **Decision**: a held-back call is counted, by action and endpoint, where the
  budget refuses it before it is made:
  - `apiGet`'s `budgetDecision` refusal (club list, activity, activity list);
  - `postToken`'s and `revokeToken`'s `tokenBudget` refusal (token, revoke);
  - the ride re-check's own stand-back before its one list request
    (`halfDayUsed` or the background budget), under `recheck`.
  A `429` is a call, not held back. A whole re-check run held back (`runs_held`)
  isn't counted again: the re-check's own table shows it, and its riders never
  reach the per-rider check.
- **Rationale**: these are the only places the app decides not to call Strava
  because of the budget (FR-005). The drain stopping after a refusal leaves the
  rest of its items untouched; they aren't calls held back yet and count when
  they are tried and refused.

## R5. Strava's count per day

- **Decision**: each team keeps, per UTC day, the highest daily total
  (`X-RateLimit-Usage`, the "all requests" day value) it saw in Strava's answers.
  The view uses the highest of all teams' for the day (FR-009).
- **Rationale**: Strava's day total only grows during a UTC day, so the highest
  value seen is the latest. Each team only sees answers to its own calls, so a
  team that stopped calling early sees a lower value; the highest across teams is
  as of the day's last call by any team. The hourly `usage_daily.used` is a
  snapshot at the last recording and misses up to an hour.
- **Alternatives considered**: `usage_daily.used`: lags, and would mark days for
  calls made after the last recording.

## R6. Sharing with other teams

- **Decision**: the existing usage export gains three day entries per day,
  `strava_calls`, `strava_held_back` and `strava_seen`, read from the new tables
  (exact, today live), from the later of `since` and the team's first counted day,
  with zero for days without calls. The breakdown by action and endpoint is never
  exported (FR-007). The pull stores them in `usage_team_daily` like the other
  entries. `parseExport` skips entries with an allowance it doesn't know instead of
  rejecting the whole export, so a later addition never breaks an older peer.
- **Rationale**: the exchange already carries per-team day counts, authenticated,
  with catch-up of missed days; three more names fit it without a new endpoint.
  Exact totals from the new table avoid the hourly snapshot's lag that the
  existing `strava_all_daily` entry has (R5).
- **Rollout**: every team deploys from the same `main` commit in one run. A pull
  between two teams' deploys sees an unknown allowance on the old release and
  fails once; the next hourly pull catches the day up. No two-step rollout.
- **Limits**: 30 days × 3 new entries fit the export's 1,500-entry cap next to
  13 months × 3 existing ones (about 1,290 in all).

## R7. Missing and before-joining days

- A peer with no entries for a day after its first entry is **missing** for that
  day: the row says so and isn't compared (FR-012). Days before a peer's first
  entry show nothing for it (a team that joined later, or before this feature).
- A day with Strava's count unknown (zero: fake mode, or nobody saw headers)
  isn't compared.

## R8. The mark

- A finished day (before today, UTC) is marked when, with every team present,
  `seen − (all teams' calls) > max(10, 1% of seen)`, or when this team counted
  any `unassigned` call (FR-011). Counted above Strava's count is not marked:
  that only means Strava's count was seen before the day's last calls.
- Marked days count in the top summary: `summary` takes the number of marked
  days next to the figures. The gateway routing feature adds its own marked days
  to the same count; whichever merges second adds its number to the sum.

## R9. The breakdown in the view

- **Decision**: the day table links each day to `?calls=YYYY-MM-DD#strava-calls`,
  like the history's `?days=`; below the table, a second table shows that day's
  breakdown (today by default): one row per action with calls, columns per
  endpoint, held back and the row total; only actions and endpoints with a count.
- **Rationale**: server-rendered, no script, the same pattern the view already
  uses; layout across the view stays issue #435's.

## R10. Cost and retention

- One call adds one D1 batch of two upserts (the day's call row, and the day's
  seen value). At Strava's daily limit of 6,000 calls that's at most 12,000 rows
  written a day, within D1's free allowance next to today's use (Principle IV).
- The daily `pruneUsage` deletes both tables' rows and the three new entries in
  `usage_team_daily` older than 30 days (FR-017).
