---
description: "Tasks for Team Europe's own rules"
---

# Tasks: Team Europe's Own Rules

**Input**: design documents in `specs/039-europe-rules/`.

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/team-data.md,
contracts/ride-evaluation.md, contracts/team-surfaces.md, contracts/messages.md, quickstart.md.

**Tests**: required (constitution Principle V). Write each test first and watch it fail; the Hamburg
pin of Phase 1 is the exception: it passes on today's code by design.

**Rules**:

- **No side effect for Hamburg** (FR-001–FR-004). Hamburg's rule objects, rule version (3), rule
  fingerprint, `BADGE_CATALOG_VERSION` (9), consent versions, samples (`samples.hamburg.ts`) and
  pages stay byte-identical. `test/teams/pages-snapshot.test.ts` and
  `test/teams/season-snapshot.test.ts` never run with `-u` after Phase 1.
- No existing test case is edited or removed. Allowed: new cases in existing files; the reason
  sorting list in `test/unit/fixable-reasons.test.ts` gains `too_short`; a `test/teams/` block that
  assumes events gets a `describe.runIf(hasEvents(team))` wrapper with its body untouched (T057).
- Every difference is team data (`src/teams/<id>.ts`, `wrangler.jsonc`), read through
  `hasTeamRynke(team)` and `hasEvents(team)`; never `team.id` in code (feature 026).
- A value Hamburg doesn't set is **absent** from Hamburg's objects, never written as `0`.
- Every new text in all ten catalogs under `src/i18n/messages/`, German the key source, English the
  reference; Europe's English written fresh for a distributed team (no group rides assumed).
- Targeted tests only; CI runs the full suites. The by-hand checks of quickstart.md happen on the
  live site after the release, not as tasks here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: the user story in spec.md.

---

## Phase 1: Setup — pin Hamburg on today's code (blocks everything)

**Goal**: Hamburg's pages that this feature touches and that `season-snapshot.test.ts` doesn't
already cover are snapshotted **before** any source change (research R11, SC-001).

- [X] T001 Create `test/teams/pages-snapshot.test.ts`, built like `test/teams/season-snapshot.test.ts`
  (same founding-team gate, `NOW`, empty database, `PINNED_VARS`, Hamburg's `SAMPLE_RIDERS`
  connected through `devFetch`, first choice for every random pick). Read season-snapshot first and
  leave out what it already pins (`/me`, `/me/rides`, `/me/badges`, `/team`). Snapshot, each in `de`
  and `en`: the landing page, `/privacy`, the consent form, `/events`, `/organiser` (Orga's events
  page), `/organiser/riders`, one past event's attendance page, `/organiser/requests`, one rider's
  corrections form, the `/me` rules section, every rider and organiser tour step's text (from
  `TOURS` with Hamburg's `tourSwitches`), and the album pages of one sample rider (`album/render.ts`
  through `album/load.ts` as `test/integration/album-render.test.ts` does). One `toMatchSnapshot`
  per page and language, so a later diff names the page
- [X] T002 Run `pnpm test -- test/teams/pages-snapshot.test.ts -u` once, check the snapshot in
  `test/teams/__snapshots__/pages-snapshot.test.ts.snap` holds real Hamburg pages (no error page,
  no empty body), and commit only T001–T002 as `test: pin Hamburg's pages before Team Europe's rules`

**Checkpoint**: from here on, both snapshots pass without `-u` after every task.

---

## Phase 2: Foundational — the two predicates and their invariant

**Goal**: one way to ask whether a team has Team Rynke and events (research R2, R3,
contracts/team-data.md). Today both teams answer true for both, so nothing changes yet.

### Tests first

- [ ] T003 [P] Create `test/unit/team-predicates.test.ts`: with synthetic `TeamData` built from
  `hamburg` by spread, `hasTeamRynke` is true when the current rules' `teamThreshold` is a number and
  false when it is `null` (cast until T020 widens the type); `hasEvents` is true for Hamburg's
  `eventKinds` and false for `[]`; `hasTeamRynke(hamburg)` and `hasEvents(hamburg)` are true
- [ ] T004 [P] In `test/teams/completeness.test.ts`, add new cases next to "names empty rules":
  a team with Team Rynke and `eventKinds: []` is named as `team <id>: eventKinds: …`; a team with
  `teamThreshold: null` and event kinds is named likewise; Hamburg-like data and Europe-like data
  (`teamThreshold: null`, `eventKinds: []`) pass

### Implementation

- [ ] T005 Add `hasTeamRynke(team)` (`currentRules(team.rules).teamThreshold !== null`) and
  `hasEvents(team)` (`team.eventKinds.length > 0`) to `src/teams/index.ts`, with a comment that code
  asks only through these, never through `team.id`
- [ ] T006 Add the invariant `hasTeamRynke(team) === hasEvents(team)` to `scripts/team-check.mjs`,
  reported as `team <id>: eventKinds: …`; a team with Team Rynke needs at least one of
  `TEAM_EVENT_KINDS` (makes T004 pass)
- [ ] T007 [P] In `src/teams/types.ts`, reword the `CoinArt.back` comment from "Team Rynke's side"
  to "The coin's back, art only" (research R14; no code change)

**Checkpoint**: `node scripts/team-check.mjs` prints nothing; both snapshots unchanged.

---

## Phase 3: User Story 2 — Europe's riders join through their own club (P1)

**Goal**: club 2292744 for Europe and its sandbox; Hamburg's `otherClubIds` names it; a check keeps
the lists together (research R10, FR-005, FR-006).

**Independent Test**: in fake mode a sample rider in club 2292744 joins Europe; one in both clubs
sees the one-team-at-a-time notice on both apps; Hamburg refuses a rider in 2292744 only.

### Tests first

- [ ] T008 [P] [US2] In `test/teams/completeness.test.ts`, add: a team whose `otherClubIds` lacks
  another team's `STRAVA_CLUB_ID` is named as `team <id>: otherClubIds: <club> of <other> missing`;
  a club ID of `"0"` is not required; the registered data passes; Europe's `placeholders` don't
  name `STRAVA_CLUB_ID` or `STRAVA_EXTRA_CLUB_IDS`; `env.europe` and `env.sandbox-europe` have
  `STRAVA_CLUB_ID` `"2292744"` and `STRAVA_EXTRA_CLUB_IDS` `""`
- [ ] T009 [P] [US2] In `test/integration/one-team.test.ts`, add cases with both `TeamData` side by
  side: a **new** Hamburg rider whose clubs are 1088689 and 2292744 sees the one-team notice once
  after connecting; a rider in 2292744 only is refused by Hamburg as a non-member, as any outsider
  today; Hamburg's existing cases stay untouched
- [ ] T010 [P] [US2] In `test/integration/fake-strava.test.ts`, add: a sample rider with
  `otherClubMember: true` is listed in its team's club and the first of the team's `otherClubIds`;
  every Hamburg sample's club list is as before

### Implementation

- [ ] T011 [US2] In `wrangler.jsonc`, set `STRAVA_CLUB_ID` to `"2292744"` in `env.europe` and
  `env.sandbox-europe` (leave `STRAVA_EXTRA_CLUB_IDS` `""`); run `pnpm types`
- [ ] T012 [US2] In `src/teams/europe.ts`, drop `STRAVA_CLUB_ID` and `STRAVA_EXTRA_CLUB_IDS` from
  `placeholders`; in `src/teams/hamburg.ts`, set `otherClubIds: [2292744]` (nothing else in the file)
- [ ] T013 [US2] Add the clubs rule to `scripts/team-check.mjs` (each team's `otherClubIds` contains
  every other team's `STRAVA_CLUB_ID` that isn't `"0"`, read from its Wrangler block)
- [ ] T014 [US2] Add `otherClubMember?: true` to `SampleRider` in `dev/fake-strava/samples.ts` and
  list the first of the team's `otherClubIds` for such a rider in the fake clubs response in
  `dev/fake-strava/api.ts`; a rider without the flag gets exactly today's list
- [ ] T015 [US2] In `dev/fake-strava/samples.europe.ts`, add one sample rider with
  `otherClubMember: true` (synthetic name, no events)

**Checkpoint**: T008–T010 pass; `node scripts/team-check.mjs` prints nothing; both snapshots
unchanged; `sampleFingerprint("hamburg")` unchanged.

---

## Phase 4: User Story 3 — Short rides don't count for Europe (P1)

**Goal**: an optional rule value `minRideKm` ("absent = no minimum; present = positive whole km"),
the reason `too_short`, the rider page line and the rules line; Europe's version 4 with
`minRideKm: 25` (research R1, R4, R5, R12; contracts/ride-evaluation.md).

**Independent Test**: Europe's fake-mode sample rider with rides of 24.9, 25.0 and 60 km: the
24.9 km ride is listed as "Too short: 24.9 km, at least 25 km needed." and adds nothing; the other
two count; the rules section says "Rides of 25 km or more count."

### Tests first

- [ ] T016 [P] [US3] Create `test/unit/rules-min-ride.test.ts`: `assertValidRules` accepts a rule
  set without `minRideKm` and with `minRideKm: 25`, refuses `0`, `-1` and `2.5`; a Hamburg rule
  object's `rulesFingerprint` is the same with the key absent as today (no `minRideKm` key on any
  Hamburg object: `"minRideKm" in r` is false)
- [ ] T017 [P] [US3] In `test/unit/rides.test.ts`, add cases with `minRideKm: 25`: 24,999.9 m →
  `["too_short"]`; 25,000.0 m → counts; a 20 km ride that is also too slow → `["too_short",
  "too_slow"]` in `REASON_CODES` order; a short ride with no moving time → `["too_short",
  "pause"]`; a short ride never makes another ride `overlap`; and without `minRideKm` a 5 km ride
  that passes every other rule counts
- [ ] T018 [P] [US3] In `test/unit/fixable-reasons.test.ts`, add `too_short` to the not-fixable
  side of the list that sorts every reason code (the one allowed list change)
- [ ] T019 [P] [US3] In `test/teams/rules.test.ts`, add side-by-side cases importing both teams:
  Hamburg's current version is 3 and its rules have no `minRideKm` key; Europe's history is
  versions 1–4, its first three entries are Hamburg's objects (`toBe`), its current rules have
  `minRideKm: 25`; Europe's version 4 fingerprint is pinned (a value change without a version bump
  fails; the pin is updated once in T040 when version 4 gains `teamThreshold: null`)
- [ ] T020 [P] [US3] In `test/unit/rider-view.test.ts`, add: a stored `too_short` reason gives
  `{ code: "too_short", distanceKmTenths, limitKm }` with the distance rounded **down** (24,960 m →
  249, never 250) and `limitKm` from the result's rules version; an unknown version gives
  `limitKm: null`; `too_short` gets no fix hint
- [ ] T021 [P] [US3] In `test/unit/rider-sections.test.ts`, add: the `too_short` line renders
  `rynke.reason.too_short` with "24.9 km" and "25 km", the `null` limit renders `.noLimit`; the rules
  section shows `rynke.rules.minRide` only for rules with `minRideKm` (rules without it render as
  today)

### Implementation

- [ ] T022 [US3] In `src/rynke/rules.ts`, add `minRideKm?: number` to `RynkeRules` with its comment,
  and to `assertValidRules`: when present, a positive integer; `rulesFingerprint` unchanged
- [ ] T023 [US3] In `src/rynke/rides.ts`, insert `too_short` into `REASON_CODES` after `manual`,
  before `pause`, and in `reasonsFor` push it when `rules.minRideKm !== undefined && distanceM <
  rules.minRideKm * 1000`, after the flagged and manual checks and before the moving-time early
  return; leave `FIXABLE_REASONS` as it is
- [ ] T024 [US3] In `src/http/rider-view.ts`, add the `too_short` `ReasonLine` variant
  (`distanceKmTenths = Math.floor(distanceM / 100)`, `limitKm` from `minRideKm` of the result's
  version or `null`); keep it out of `FIXABLE`
- [ ] T025 [US3] In `src/http/rider-sections.ts`, render the `too_short` line with the page's
  kilometre format (one decimal for the distance, none for the limit), and add the
  `rynke.rules.minRide` line to `renderRules` only when the rules in effect have `minRideKm`
- [ ] T026 [US3] Add `rynke.reason.too_short`, `rynke.reason.too_short.noLimit` and
  `rynke.rules.minRide` to all ten catalogs in `src/i18n/messages/` (wording in
  contracts/messages.md; German first)
- [ ] T027 [US3] In `src/teams/europe.ts`, add `EUROPE_RULES_V4` = Hamburg's version 3 values written
  out as its own object with `version: 4`, `minRideKm: 25` and `effectiveDate` set to the planned
  release day, and set `rules: [...hamburg.rules.slice(0, 3), EUROPE_RULES_V4]`, with the "raise
  `version`, keep the previous object" note beside it; `src/teams/hamburg.ts` untouched
- [ ] T028 [P] [US3] In `dev/fake-strava/samples.europe.ts`, add one sample rider with otherwise
  counting rides of 24.9, 25.0 and 60 km
- [ ] T029 [P] [US3] In `test/unit/rules-handout.test.ts`, add: Europe's
  `docs/teams/europe/rynke-points.md` states the 25 km minimum; Hamburg's `docs/rynke-punkte.md`
  names no minimum ride length. Then add the minimum to `docs/teams/europe/rynke-points.md` with the
  examples "24.9 km doesn't count, 25 km does", and fix any example that relied on a shorter ride
- [ ] T030 [US3] In `e2e/europe-smoke.e2e.ts`, add: on `/me/rides` the 24.9 km sample ride shows
  "Too short: 24.9 km, at least 25 km needed."

**Checkpoint**: T016–T021 and T029 pass; `test/unit/rules.test.ts` passes unchanged; both snapshots
unchanged.

---

## Phase 5: User Story 4 — Europe has no Team Rynke and no events (P1)

**Goal**: `teamThreshold: null` and `eventKinds: []` for Europe; every page, guard, tour, text,
album and sample follows the two predicates (research R2, R3, R6, R7, R8;
contracts/team-surfaces.md, contracts/messages.md).

**Independent Test**: `test/teams/no-events.test.ts` walks every Europe page in English and German
and finds no Team Rynke, event, attendance or tour-day text; a Europe rider with the Training
threshold and the virtual share met is qualified.

### Tests first

- [ ] T031 [P] [US4] In `test/unit/rules-min-ride.test.ts`, add: `teamThreshold: null` is accepted;
  `0` stays refused; `teamThreshold: null` with any `teamEvents[kind].team` other than 0 is refused
- [ ] T032 [P] [US4] In `test/unit/tally.test.ts`, add: with `teamThreshold: null`, `teamMissing` is
  0 and `qualified` is `trainingMissing === 0 && virtualShareMissing === 0` (qualified when both
  met, not qualified with Training missing, not qualified with the virtual share missing)
- [ ] T033 [P] [US4] In `test/teams/switches.test.ts`, add side-by-side cases: `hiddenSections(env,
  hamburg)` equals today's `hiddenSections(env)` result; Europe's adds `"events"`;
  `tourSwitches` gives `teamRynke`/`events` true for Hamburg, false for Europe; Europe's rider tour
  has no `tour.rider.teamRynke` or events step, its organiser tour no `tour.organiser.requests`,
  `newEvent`, `upcoming` or `past` step
- [ ] T034 [P] [US4] In `test/unit/rider-view.test.ts`, `test/unit/rider-summary.test.ts`,
  `test/unit/progress-view.test.ts`, `test/unit/overview.test.ts` and
  `test/unit/tour-example.test.ts`, add cases with rules of `teamThreshold: null`: `Summary.team`,
  `Gauges.team`, the events breakdown, the progress `team` series and weekly Team column, the hero's
  Team figure and the tour example's Team Rynke and events are `null`/absent; with Hamburg's rules
  they are as today
- [ ] T035 [US4] Create `test/teams/no-events.test.ts` with `describe.runIf(!hasEvents(team))`,
  connecting Europe's sample riders like season-snapshot does:
  - every rider page (`/me`, `/me/rides`, `/me/badges`, `/team`, `/team?kind=team`, settings,
    help), every organiser page (`/organiser/riders`, a corrections form), the tour step texts,
    the landing, consent and privacy pages and one rider's album, in `en` and `de`, contain none
    of `Team Rynke`, `team event`, `Team event`, `attend`, `Tour de Paris`, `tour day` (en) or
    `Teamrynke`, `Teamtermin`, `Termine`, `Tour de Paris` (de), and no `href` to `/events` or
    `/organiser/events`
  - `/events`, `/events/{id}/report`, `/organiser/events…` and `/organiser/requests…` answer 404
    for GET and POST; `/organiser` redirects to `/organiser/riders`; `/team?kind=team` shows the
    Training view (200)
  - `teamEventChange` with any kind throws `TeamEventRefused`; `correctionChange` with a non-zero
    Team amount throws `CorrectionRefused`, and the corrections POST answers 400 with an
    `organiser.error.*` text
  - a sample rider with the Training threshold reached and the virtual share met shows as qualified
    (SC-005)
- [ ] T036 [P] [US4] In `test/teams/completeness.test.ts`, add: Europe's data has `eventKinds: []` and
  current `teamThreshold: null`, and passes; Europe's samples hold no events and `teamEvents: []`
- [ ] T037 [P] [US4] Add a test next to the existing i18n tests (`test/unit/i18n.test.ts`):
  `eventsText(hamburg, id)` returns `id`, `eventsText(europe, id)` returns `` `${id}.noEvents` ``,
  and every `.noEvents` key of contracts/messages.md exists in all ten catalogs
- [ ] T038 [P] [US4] In `e2e/europe-smoke.e2e.ts`, add: no Events menu entry, no Team gauge on `/me`,
  no kind switch on `/team`

### Implementation — rules and data

- [ ] T039 [US4] In `src/rynke/rules.ts`, widen `teamThreshold` to `number | null` (comment: `null`
  = the team has no Team Rynke) and extend `assertValidRules`: a positive integer or `null`; with
  `null`, every `teamEvents[kind].team` must be 0. Fix each place `tsc` then names, by making the
  Team Rynke part of that view optional (tasks below), never by a team check
- [ ] T040 [US4] In `src/rynke/tally.ts`, set `teamMissing = 0` when `teamThreshold === null`; in
  `src/teams/europe.ts`, give `EUROPE_RULES_V4` `teamThreshold: null` and every `teamEvents` kind
  `{ team: 0, training: 0 }`, and set `eventKinds: []`; update the Europe version 4 fingerprint pin
  added in T019 (a new pin of this branch, not an existing test)
- [ ] T041 [US4] In `src/rynke/apply.ts`, make `teamEventChange` throw `TeamEventRefused` for a kind
  not in `ctx.team.eventKinds`, and `correctionChange` throw `CorrectionRefused` for a non-zero Team
  amount when `!hasTeamRynke(ctx.team)`; Hamburg's path unchanged
- [ ] T042 [US4] In `dev/fake-strava/samples.europe.ts`, remove every event, attendance and Team
  Rynke correction, set `teamEvents: []`, and reword sample states without events (a rider who
  qualifies on Training Rynke and the outdoor share stays)

### Implementation — routes, menu and tours

- [ ] T043 [US4] In `src/http/router.ts`, when `!hasEvents(team)`: 404 for `/events…`,
  `/organiser/events…` and `/organiser/requests…` (GET and POST); `/organiser` redirects to
  `/organiser/riders`
- [ ] T044 [US4] In `src/http/shell.ts`, change `hiddenSections(env)` to `hiddenSections(env, team)`,
  adding `"events"` when `!hasEvents(team)` (update both callers), give `tourSwitches` `teamRynke`
  and `events` from the predicates, and skip `countOpenRequests` without events
- [ ] T045 [US4] In `src/http/tour.ts`, add `teamRynke: boolean` and `events: boolean` to
  `TourSwitches`; give `tour.rider.teamRynke` `only: "teamRynke"` and `tour.organiser.requests`,
  `tour.organiser.newEvent`, `tour.organiser.upcoming`, `tour.organiser.past` `only: "events"`; the
  outdoor and organiser Riders steps use `eventsText`
- [ ] T046 [US4] In `src/http/organiser/access.ts`, leave out the Riders · Events switch and its
  open-request count when `!hasEvents(team)`

### Implementation — view models and pages

- [ ] T047 [P] [US4] In `src/http/rider-view.ts` and `src/http/rider-sections.ts`, make
  `Summary.team`, `Gauges.team` and the events breakdown `null` without Team Rynke, and leave out the
  "Your team events" part without events (render paths already skip `null`)
- [ ] T048 [P] [US4] In `src/http/progress-view.ts` and `src/http/progress-section.ts`, leave out the
  `team` series and the weekly Team column without Team Rynke; the day label uses
  `eventsText(team, "progress.day")`
- [ ] T049 [P] [US4] In `src/http/sections/overview.ts`, leave out the hero's Team figure; in
  `src/http/sections/team.ts`, show only the Training view without Team Rynke (`kind=team` falls back
  to Training as with `rynkeViews` off, no kind switch)
- [ ] T050 [P] [US4] In `src/http/organiser/overview.ts`, leave out each rider's Team amount, missing,
  pace and event breakdown without Team Rynke, and use `eventsText` for
  `organiser.overview.qualifiedHint`, `.amounts` and `.corrections`; in
  `src/http/organiser/corrections.ts`, show the Training field only
- [ ] T051 [P] [US4] In `src/http/tour-example.ts`, give the example rider and team no Team Rynke and
  no events without them
- [ ] T052 [P] [US4] In `album/load.ts` and `album/render.ts`, leave out `teamRynke`,
  `eventsAttended` and the events page without them
- [ ] T053 [US4] Fix the remaining places `tsc` names (celebration and push texts, team badge news
  figures): a team without Team Rynke never reaches a Team part

### Implementation — texts

- [ ] T054 [US4] Add `eventsText(team, id)` to `src/i18n/` (typed so it only accepts ids whose
  `.noEvents` sibling exists) and the `.noEvents` variants of contracts/messages.md to all ten
  catalogs: `landing.purpose`, `consent.organisers`, `privacy.team.body`,
  `privacy.visibility.organisers`, `privacy.legal.body`, `tour.rider.outdoor`,
  `tour.organiser.riders`, `progress.day`, `organiser.overview.qualifiedHint`,
  `organiser.overview.amounts`, `organiser.overview.corrections`,
  `badges.surprise.sunday-outing.for`; no base key's text changes
- [ ] T055 [US4] Use `eventsText` in `src/http/landing.ts`, `src/http/consent-form.ts`,
  `src/http/privacy.ts` and for `badges.surprise.sunday-outing.for` in the badges view; leave
  `CONSENT_VERSIONS` in `src/consent.ts` as it is (research R8)
- [ ] T056 [US4] Run T035; for any text it still finds on a Europe page, add a `.noEvents` variant
  (all ten catalogs) or leave the part out, in this task

### Existing team tests

- [ ] T057 [US4] Run `pnpm test -- test/teams` for `team:europe`; wrap each existing block that
  assumes events and now fails for Europe in `describe.runIf(hasEvents(team))`, body untouched, and
  make sure T035 covers its Europe counterpart

### Handout

- [ ] T058 [US4] In `docs/teams/europe/rynke-points.md`, remove Team Rynke, team events, the Tour de
  Paris days and their badges; qualification is Training Rynke plus the outdoor share

**Checkpoint**: T031–T038 pass; both Hamburg snapshots and `test/unit/rules.test.ts` unchanged;
`node scripts/team-check.mjs` prints nothing.

---

## Phase 6: User Story 5 — Europe's badges without event-only badges (P2)

**Goal**: event-only categories are flagged and left out of Europe's lists; `BADGE_CATALOG_VERSION`
stays 9 (research R9).

**Independent Test**: Europe's `/me/badges` has no team events, technique, Tour de Paris, big
training or attendances badge, earned or locked, nor a hint for one; Hamburg's lists every badge.

### Tests first

- [ ] T059 [P] [US5] Create `test/unit/badges-for.test.ts`: `badgesFor(hamburg)` is `BADGES` itself
  (`toBe`); `badgesFor(europe)` is `BADGES` without exactly the `team_events`, `technique`,
  `big_training`, `attendances` and `tour_de_paris` categories and keeps team distance, elevation,
  running, Training Rynke and the surprises; exactly those five categories have `events: true`;
  `BADGE_CATALOG_VERSION` is 9
- [ ] T060 [P] [US5] In `test/unit/badge-hints.test.ts`, add: no hint names an event-only badge for
  Europe's list; Hamburg's hints as today
- [ ] T061 [P] [US5] In `test/teams/no-events.test.ts`, add: `/me/badges` and the album list no badge
  of the five categories, in `en` and `de`

### Implementation

- [ ] T062 [US5] In `src/badges/catalog.ts`, add `events?: true` ("earned only through recorded
  events") to `BadgeCategory`, set it on the five categories, and add `badgesFor(team)`: `BADGES`
  when `hasEvents(team)`, else `BADGES` without the flagged categories (computed once per team)
- [ ] T063 [US5] List badges through `badgesFor(team)` in `src/badges/hints.ts`,
  `src/badges/view.ts`, `src/http/sections/badges.ts`, `src/work/team-badge-news.ts` and the album
  (`album/load.ts`, `album/render.ts`); badge evaluation unchanged

**Checkpoint**: T059–T061 pass; `test/unit/badge-catalog.test.ts` passes unchanged; both snapshots
unchanged.

---

## Phase 7: User Story 1 — Hamburg stays exactly as it is (P1)

**Goal**: prove no side effect for Hamburg after all changes (FR-001–FR-004, SC-001). Its pin was
laid in Phase 1; this phase closes it.

**Independent Test**: both Hamburg snapshots, the rules pin and every existing Hamburg test pass
unchanged.

- [ ] T064 [US1] Run `pnpm test -- test/teams/pages-snapshot.test.ts test/teams/season-snapshot.test.ts
  test/unit/rules.test.ts test/unit/badge-catalog.test.ts test/unit/consent-versions.test.ts`
  **without** `-u`: all pass, no snapshot written
- [ ] T065 [US1] Run `git diff develop -- test/ e2e/` and check: no existing case edited or removed,
  only new cases, new files, the `too_short` entry in `fixable-reasons.test.ts` and the
  `describe.runIf(hasEvents(team))` wrappers of T057
- [ ] T066 [US1] Run `git diff develop -- src/teams/hamburg.ts dev/fake-strava/samples.hamburg.ts
  docs/rynke-punkte.md public/rynke-punkte.pdf` and check: only `otherClubIds: [2292744]`

---

## Phase 8: Polish & Cross-Cutting

- [ ] T067 Run `pnpm docs:pdf` and check that only `public/teams/europe/rynke-points.pdf` changed
- [ ] T068 Run `node scripts/team-check.mjs` and the new and touched test files
  (`test/teams`, `test/unit/rules-min-ride.test.ts`, `test/unit/rides.test.ts`,
  `test/unit/tally.test.ts`, `test/unit/fixable-reasons.test.ts`, `test/unit/team-predicates.test.ts`,
  `test/unit/badges-for.test.ts`, `test/integration/one-team.test.ts`,
  `test/integration/fake-strava.test.ts`); the full suites run in CI
- [ ] T069 Open one pull request into `develop` (title a Conventional Commit within 100 characters,
  `Refs` the Team Europe issue, never `Closes`) only when the user asks; after the release the user
  runs **Sandbox reseed** for Europe (research R13)

---

## Dependencies & Execution Order

- **Phase 1** (pin Hamburg) comes first, on today's code, and blocks everything.
- **Phase 2** (predicates, invariant) blocks US4 and US5.
- **US2** (club) depends only on Phase 1; it touches `team-check`, Wrangler, team data and fake
  Strava, independent of the rules.
- **US3** (minimum) depends on Phase 1; T027 creates Europe's version 4.
- **US4** depends on Phase 2 and on T027 (it completes version 4 in T040).
- **US5** depends on Phase 2 (`hasEvents`); it can run alongside US4, but the album and
  `no-events.test.ts` are shared, so do it after US4 in one checkout.
- **US1** (Phase 7) closes after every other story; its snapshots are checked at every checkpoint
  on the way.
- Within a story: tests first and failing, then rules and data, then guards, then views and texts.

## Parallel Opportunities

- Phase 2: T003, T004 together; T007 any time.
- US2: T008, T009, T010 together.
- US3: T016–T021 together; T028 and T029 alongside the implementation.
- US4: T031–T034 and T036–T038 together; after T039–T046, the view tasks T047–T052 touch separate
  files and run together.
- US5: T059–T061 together.

## Implementation Strategy

1. Phase 1 commit: Hamburg pinned.
2. Phases 2–3: club; Europe can take members (smallest useful increment).
3. Phase 4: minimum; Europe's main rule.
4. Phase 5: no Team Rynke, no events; Europe's riders can qualify.
5. Phase 6: badges.
6. Phase 7–8: Hamburg proof, handout PDF, one pull request when asked.

Commits are ordered by story as above (research R13), each with the Hamburg snapshots green.
