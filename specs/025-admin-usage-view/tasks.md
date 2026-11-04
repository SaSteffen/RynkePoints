# Tasks: Admin View with Usage Statistics

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: test-first (constitution Principle V): each test task comes before
the code that makes it pass and fails until then. Tests stub `fetch` and call neither
Strava nor Cloudflare (FR-028). Fixtures are synthetic.

**Scope**: one team. Per-team shares across teams are feature 026 (its FR-039).

Format: `[ID] [P?] [Story] Description`.

## Phase 1: Constitution

Comes first, so the exception exists before any code keeps an ID (research R9).

- [ ] T001 Amend `.specify/memory/constitution.md` to version 2.3.0 (MINOR): add the exception
  from research R9 word for word to Principle I's deletion rule, update the Sync Impact
  Report, the version and Last Amended.

## Phase 2: Foundation

Blocks every story.

- [ ] T002 Migration `migrations/0021_admin_usage.sql`, adding only (data-model.md):
  `riders.administrator` "INTEGER, 0 or 1, default 0" and `riders.cloudflare_alerts`
  "INTEGER, 0 or 1, default 1"; the six own and peak columns on `strava_rate_limit`, each
  "INTEGER, default 0"; `usage_daily` with `PRIMARY KEY (day, allowance)` and `WITHOUT ROWID`
  (R4), `used` and `limit_value` required, `team_used` and `peak_15m` nullable;
  `usage_source_state`; `usage_alerts` keyed by `(allowance, period, level)`;
  `blocked_athletes` with only `athlete_id`, `WITHOUT ROWID`, no foreign key; `removal_log`
  with `administrator_id` "`REFERENCES riders ON DELETE SET NULL`".
- [ ] T003 Clear the new tables and reset the new `strava_rate_limit` columns in `resetDb`, and
  add an `administrator` option like `organiser` to the rider helper, in
  `test/support/ctx.ts`.
- [ ] T004 [P] Add `TEAM_ID` to `vars` and the cron `58 * * * *` beside the daily one in
  `wrangler.jsonc`, then run `pnpm types`. Declare `CLOUDFLARE_ANALYTICS_TOKEN` and
  `CLOUDFLARE_ANALYTICS_ACCOUNT_ID` as optional secrets, not in `secrets.required`, so a
  deploy works without them (contracts/cloudflare-analytics.md), and read them through
  `src/config.ts`.
- [ ] T005 Tests in `test/integration/admin-access.test.ts`, following
  `organiser-access.test.ts`, with a stub route set: a visitor goes to `/`, a rider without
  current consent meets the gate, a rider without the flag gets the generic 403 on every route
  in contracts/http-routes.md, a POST from another origin is refused and changes nothing, a
  cleared flag loses access on the next request, an organiser without the flag is refused
  (FR-001 to FR-004, SC-004).
- [ ] T006 Map `administrator` and `cloudflare_alerts` onto `Rider` in `src/db/riders.ts`; add
  `adminPage` and `requireAdminPost` in `src/http/admin/access.ts`, following
  `src/http/organiser/access.ts`; register `/admin` routes in `src/http/router.ts` (T005 green).
- [ ] T007 Admin tab in `src/http/shell.ts`: `adminOnly` in `SECTIONS`, passed through the
  navigation filter, with `nav.admin` in `src/i18n/messages/{de,en}.ts` and an icon in
  `src/http/icons.ts`. A rider holding both roles has seven tabs, so give it a `short` label
  if needed and check the bar still fits at 320 px, in `src/http/style.ts`. Test in
  `test/integration/admin-access.test.ts`: only administrators see it.
- [ ] T008 [P] Fake mode: `administrator?: true` on one rider in `dev/fake-strava/samples.ts`,
  who holds no other role, and the flag in `dev/fake-strava/seed.ts`, like organisers
  (R12). The usage seed follows in T016.

**Checkpoint**: an administrator sees an empty Admin tab, and everyone else is refused.

## Phase 3: User Story 1 — how close are we to our limits? (P1) 🎯 MVP

**Independent test**: with synthetic usage, compare every figure on `/admin` with the input,
then check that a non-administrator is refused.

- [ ] T009 [P] [US1] Unit tests in `test/unit/usage-figures.test.ts`: percentage, team count
  and not attributed as `max(0, total - own)` (SC-002), warning at 80 % and critical at 95 %
  exactly, above 100 % not capped, an old figure counting as zero for the new period like
  `effectiveUsage`, with its observation time kept.
- [ ] T010 [P] [US1] Unit tests in `test/unit/usage-cloudflare.test.ts`, with a stubbed `fetch`:
  the query asked for yesterday and today by `accountTag`, results summed per day over each
  group, and network failure, non-2xx, `errors` in the body and an unexpected shape all
  returning a failure and overwriting nothing. Add the token to
  `test/unit/no-secret-logging.test.ts`.
- [ ] T011 [P] [US1] Integration tests in `test/integration/usage-counting.test.ts`: a response
  with usage headers adds to the own counts for all requests and, for a `GET`, for reads; one
  without headers adds nothing; a new window or day restarts the counts; peaks hold the day's
  highest; one response still causes one `UPDATE`; a failed write doesn't lose the response
  (R1, FR-010).
- [ ] T012 [P] [US1] Integration tests in `test/integration/usage-record.test.ts`: the hourly
  cron writes all 8 allowances (data-model.md) with the limit in effect, `TEAM_ID` and own
  counts; a repeat doesn't double-count; a Cloudflare failure keeps stored rows, sets
  `last_failure_at` and still records Strava; no token means unavailable with no `fetch`; the
  daily cron doesn't record and the hourly one does no daily work; a day's writes stay under
  1 % of the allowance, using `test/support/d1-trips.ts` (FR-016, SC-006).
- [ ] T013 [P] [US1] Integration tests in `test/integration/admin-usage.test.ts`: the five
  acceptance scenarios of US1; marks hold text, not only colour (FR-009); Cloudflare's figures
  say they cover the whole account and are approximate (FR-008, FR-012); a failed source shows
  its last known values with their time, never zero, with the rest of the page intact (FR-011,
  SC-007); viewing calls no `fetch` (FR-027).
- [ ] T014 [US1] Pure logic: `src/usage/allowances.ts` (the allowance list, Cloudflare's limits as
  in spec Assumptions, athlete capacity 999, levels) and `src/usage/figures.ts` (T009 green).
- [ ] T015 [US1] Counting: `stravaFetch` in `src/strava/result.ts` passes whether the request is a
  read to `recordRateLimitHeaders` in `src/db/rate-limit.ts`, which writes own counts and peaks
  in its one `UPDATE`, restarting them in SQL from `observed_at` (T011 green).
- [ ] T016 [US1] Recording: `src/usage/cloudflare.ts` as in contracts/cloudflare-analytics.md,
  `src/db/usage.ts` and `src/usage/record.ts`. In `handleScheduled` in `src/work/scheduled.ts`,
  the hourly cron string runs recording and anything else keeps running the daily steps, so
  `src/http/run-daily.ts` and existing tests stay as they are (T010, T012 green). Seed synthetic
  usage in `dev/fake-strava/seed.ts`, including one figure at each level.
- [ ] T017 [US1] `GET /admin` in `src/http/admin/usage.ts`, its text in
  `src/i18n/messages/{de,en}.ts` and styles in `src/http/style.ts`, phone first, following the
  organiser pages (FR-025, FR-026) (T013 green).

**Checkpoint**: US1 works alone and can ship. Cloudflare's figures need the manual steps below.

## Phase 4: User Story 2 — how has usage developed? (P2)

**Independent test**: with 60 synthetic days, compare the daily values, then remove a rider's row
and check that the history doesn't change.

- [ ] T018 [P] [US2] Integration tests in `test/integration/admin-history.test.ts`: one value per
  day in numbers and percent with the limit in effect and, for Strava, the team's count and
  15-minute peak; a missing day is a gap, not zero; a new history says when recording began; an
  unknown `allowance` shows the first one; deleting a rider changes nothing (FR-013 to FR-015,
  FR-017, SC-003).
- [ ] T019 [P] [US2] Test in `test/integration/usage-record.test.ts`: the daily cron removes
  `usage_daily` rows older than 13 months and no newer ones.
- [ ] T020 [US2] `GET /admin/history` in `src/http/admin/history.ts` with `src/http/charts.ts` and
  its table alternative; read functions in `src/db/usage.ts`; retention as a daily step in
  `src/work/scheduled.ts`; text in `src/i18n/messages/{de,en}.ts`; one empty day in the seed in
  `dev/fake-strava/seed.ts` (T018, T019 green).

**Checkpoint**: US1 and US2 work independently.

## Phase 5: User Story 3 — who is connected? (P2)

**Independent test**: with synthetic riders in every state, compare the list with the data, and
check that no ride or Rynke figure appears.

- [ ] T021 [P] [US3] Update tests for consent version 2 in `test/unit/consent-versions.test.ts`,
  `test/integration/landing.test.ts`, `test/integration/privacy.test.ts` and
  `test/integration/consent-gate.test.ts`: a version 1 rider meets the gate on their next visit
  and sees the new text; the text says that administrators exist, what they see, and that a
  removed rider's ID is kept (FR-032). Fix tests elsewhere that assume version 1 is current.
- [ ] T022 [P] [US3] Tests in `test/integration/admin-riders.test.ts`: the row's fields (FR-018);
  no row for a version 1 rider, and the count of unlisted riders (FR-038); no rides, Rynke, tokens
  or displayed athlete IDs (FR-019); leaderboards and organiser pages unchanged for a version 1
  rider; blocked count only (FR-031); only this database's riders (FR-004).
- [ ] T023 [P] [US3] Tests in `test/integration/admin-usage.test.ts` and
  `test/unit/usage-figures.test.ts`: the number waiting and an estimate that says "about", limited
  by what's left today, with no rider named, and nothing when none wait (FR-020, R11).
- [ ] T024 [US3] Consent version 2 in `src/consent.ts`, with the release date as `published` and
  `changes` naming the new text; `SHARING_SINCE_VERSION` stays 1. Change `landing.leave`, add
  `consent.admins`, and extend `consent.short.shown` and the privacy text in
  `src/i18n/messages/{de,en}.ts`, shown by `src/http/consent-form.ts`, `src/http/landing.ts` and
  `src/http/privacy.ts` (R8) (T021 green).
- [ ] T025 [US3] `GET /admin/riders` in `src/http/admin/riders.ts`, filtered with
  `sharedRiderIdsSince(2)`, queries in `src/db/riders.ts` and `src/db/blocked.ts`, text in
  `src/i18n/messages/{de,en}.ts` (T022 green).
- [ ] T026 [US3] Waiting work on `/admin`: estimate in `src/usage/figures.ts`, count from
  `waitingCount` in `src/db/strava-work.ts`, shown in `src/http/admin/usage.ts` (T023 green).

**Checkpoint**: US1, US2 and US3 work independently.

## Phase 6: User Story 5 — be told when a limit is near (P2)

**Independent test**: with synthetic usage and a stubbed push service, take a daily allowance across
80 % and then 95 %. Each administrator's devices get one notification per level with no rider data,
and a second check sends nothing.

Depends on US1's recording.

- [ ] T027 [P] [US5] Unit tests in `test/unit/usage-alerts.test.ts`: which levels are reached, the
  period (UTC day, or `open` for storage and connected riders), Strava's 15-minute figures never
  alerting, one notification for 95 % when both levels are newly reached.
- [ ] T028 [P] [US5] Integration tests in `test/integration/usage-alerts.test.ts`, with
  `test/support/push.ts`: scenarios 1 to 4 and 6 to 9 of US5; a repeated run sends nothing (FR-035);
  an `open` level notifies again only after falling below it; riders without the flag never receive
  one (FR-037); an empty recipient list still inserts the row; an alert failure doesn't fail
  recording; a failed recording sends nothing; rows past their retention are removed by the daily
  cron (data-model.md).
- [ ] T029 [P] [US5] Tests in `test/integration/notifications-route.test.ts`:
  `/me/notification-text` gives an administrator the alert's text and `/admin` for 15 minutes,
  with its own wording when critical; the Rynke text for an administrator with the switch off after
  a Cloudflare alert, and for every other rider; no rider data (FR-036, contracts/alerts.md).
- [ ] T030 [P] [US5] Tests in `test/integration/admin-usage.test.ts`: `POST /admin/alerts` sets only
  the viewer's own `cloudflare_alerts`, default on, and stays set after a reload (FR-039); the hint
  appears when the viewer has no device with notifications, and says where to turn them on
  (scenario 5).
- [ ] T031 [US5] `src/usage/alerts.ts`, with the recipients query in `src/db/riders.ts`, run after
  recording in `src/usage/record.ts` through `notifyRiders`; retention as a daily step in
  `src/work/scheduled.ts` (T027, T028 green).
- [ ] T032 [US5] Alert text in `handleRiderNotificationText` in `src/http/pwa.ts` and in
  `src/i18n/messages/{de,en}.ts` (T029 green).
- [ ] T033 [US5] Switch and hint on `/admin`, and `POST /admin/alerts`, in `src/http/admin/usage.ts`;
  the hint uses `subscriptionIdsOfRiders` in `src/db/push-subscriptions.ts` (T030 green).

**Checkpoint**: alerts work with US1 alone.

## Phase 7: User Story 4 — remove and block a rider (P3)

**Independent test**: with synthetic riders, remove one. Only the athlete ID on the block list
remains, Strava access is revoked, the record doesn't identify the rider, and others are unchanged.
Connecting as that rider is then refused.

Depends on US3 for the rows that link here and for the consent text.

- [ ] T034 [P] [US4] Tests in `test/integration/admin-remove.test.ts`: the confirmation's text;
  revoke with one retry on a transient failure, then delete regardless; `removed` and
  `removed-revoke-failed`; every table holding rider data is empty for that rider, and
  `blocked_athletes` holds only the ID (SC-005); the removal record holds the time and administrator
  only, and can't be linked to the entry (FR-023); an administrator who later leaves is cleared from
  it; usage history and other riders unchanged; the removed rider's session gets the visitor's page;
  `error=self` pointing to `/me/disconnect`; `error=unknown` for an unknown or unlisted ID, with
  nothing changed (FR-004, FR-021, FR-022); a rider who leaves or whose membership ends isn't blocked
  and can return (FR-024).
- [ ] T035 [P] [US4] Tests in `test/integration/callback.test.ts`: a blocked rider's callback revokes
  the new token and redirects to `/notice/blocked`, with no club request and nothing stored (SC-008);
  still blocked after rejoining the club; an unblocked rider's flow unchanged (FR-030, R7).
- [ ] T036 [US4] `src/db/blocked.ts`: one atomic D1 batch of `INSERT OR IGNORE` the block entry,
  insert the removal record, delete the rider; the block lookup and count.
- [ ] T037 [US4] Routes in `src/http/admin/remove.ts`: `GET` and `POST
  /admin/riders/{id}/remove`, reusing the revoke of `handleDisconnect` in `src/http/me.ts`, with
  the remove link and result messages in `src/http/admin/riders.ts` and text in
  `src/i18n/messages/{de,en}.ts` (T034 green).
- [ ] T038 [US4] Block check right after the code exchange in `handleCallback` in `src/http/auth.ts`,
  and the `blocked` notice in `src/http/notice.ts` and `src/i18n/messages/{de,en}.ts` (T035 green).

**Checkpoint**: all stories work independently.

## Phase 8: Polish

- [ ] T039 [P] Screenshots of `/admin`, `/admin/history`, `/admin/riders`, the confirmation and
  `/notice/blocked`, with synthetic riders, in `e2e/strava-review.review.ts`. Describe administrators
  and the block list in the reviewer text in `scripts/strava-review.mjs`, and regenerate
  `docs/strava-developer-program.md` if it comes from that script.
- [ ] T040 [P] Smoke test in `e2e/smoke.e2e.ts`: the sample administrator opens all three pages, turns
  Cloudflare alerts off and removes a sample rider, at phone width too; a sample rider has no Admin tab.
- [ ] T041 [P] `README.md`: the feature, what's stored (block list, usage records), and how to mark an
  administrator and lift a block by hand, as for organisers (FR-002, FR-031).
- [ ] T042 Run `pnpm test`, `pnpm lint` and `pnpm typecheck`, and the targeted e2e test (T040). CI runs
  the rest.

## Manual steps, by the maintainer

Not tasks: they touch production (quickstart.md). Until they're done, the view shows Cloudflare as
unavailable and everything else works.

1. Create the read-only token, and set `CLOUDFLARE_ANALYTICS_TOKEN` and
   `CLOUDFLARE_ANALYTICS_ACCOUNT_ID` with `wrangler secret put`.
2. Confirm the analytics fields by introspection (R3). A differing field changes only the query in
   `src/usage/cloudflare.ts` and its test.
3. Mark the first administrators.
4. Have the data controller confirm the legal basis for the block list (spec Assumptions).

## Dependencies

- **T001** before everything. **Phase 2** blocks all stories; T002 and T003 come first in it.
- **US1** comes after Phase 2. **US2** and **US5** need US1's recording (T016). **US3** only needs
  Phase 2, except T026, which extends T017's page. **US4** needs US3.
- Consent version 2 (T024) ships with or before the overview (T025) and removal (T037), since its
  text covers both.
- Within a story, tests come first and must fail. Tasks that edit the same catalog, `src/http/style.ts`
  or `test/integration/admin-usage.test.ts` aren't parallel with each other across stories.

## Parallel example: User Story 1

```text
T009 test/unit/usage-figures.test.ts
T010 test/unit/usage-cloudflare.test.ts
T011 test/integration/usage-counting.test.ts
T012 test/integration/usage-record.test.ts
T013 test/integration/admin-usage.test.ts
```

## Implementation strategy

**MVP**: Phases 1 to 3. That alone answers "how close are we?", and it starts collecting history from
the day it ships, so it's worth releasing early.

**Then**: US5, so nobody has to keep looking; US2 once some days are recorded; US3 and US4 together,
because the new consent version asks every rider again, and once is enough.
