# Research: Roles and Rider Consent (User Stories 1–4)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

Each section records the decision, why it was taken, and what else was considered.
"001" is feature 001-strava-connect-webhook, whose code this plan reads and extends.
R1–R10 were decided for User Stories 1–3 (2026-10-07), R11–R17 for User Story 4
(2026-10-08). User Story 5 is deferred and needs no code.

## R1. User Story 1 is mostly built already; only the rider without a record is left

**Decision**:
- 001 built the consent step together with this spec (commit `9dbf67d`, 001
  research R21): the landing page explains the consent and asks for it with a
  required checkbox; `POST /connect` refuses without it; the signed OAuth state
  carries the agreed version through Strava; the callback stores a new rider and
  their consent record in one batch and turns a new athlete without agreement
  away; `activity:write` is requested and optional, and `riders.scope_write`
  records it; `/me` shows the write status, the stored consent and a "change
  permissions on Strava" link. Migration `0004` holds the column and
  `consent_records`, which cascade from `riders`.
- Every acceptance scenario of US1 is covered by an existing test
  ([quickstart.md](quickstart.md) §1). This plan re-checks them and adds nothing
  to the connect flow.
- The one gap is the edge case "rider connected before this feature": `/me` tells
  them to sign out and connect again on the start page. Instead, `/me` shows such
  a rider the consent texts and the same consent form as the landing page. It
  posts to the existing `POST /connect`, so Strava asks again (and offers write
  access), and the callback records the consent for the existing rider (001 R21,
  "An existing rider who came through the form gets the record too").
- The form moves from `landing.ts` into a shared helper, so both pages render
  exactly the same consent and checkbox.

**Rationale**:
- Re-using `POST /connect` needs no new route, no new state and no new test of the
  callback: the path is already tested ("records consent for an existing rider
  without one").
- Going through Strava again is what the edge case asks for: the rider is offered
  write access at the same time.
- The form doesn't block the rest of `/me`. Blocking until the rider agrees is the
  re-consent gate of US4 (FR-013); until then, such a rider is left out of every
  shared view (R6), which is what FR-021 needs.

**Alternatives considered**:
- A `POST /me/consent` that records the consent without Strava: one more route,
  and the rider isn't offered write access; rejected.
- Blocking `/me` until the rider agrees: that is US4's gate, which also has to
  show what changed between versions; left to US4.
- Leaving the "sign out and connect again" text: works, but sends the rider
  through the landing page for no reason.

## R2. Organisers are a flag on the rider row

**Decision**:
- A migration `0009_organiser_flag.sql` adds
  `riders.organiser INTEGER NOT NULL DEFAULT 0 CHECK (organiser IN (0, 1))`
  ([contracts/organiser-flag.md](contracts/organiser-flag.md)). `Rider` gains
  `organiser: boolean`, read by `getRider` with the rest of the row.
- The app never writes the column (FR-004). `insertRider` names its columns, so a
  new rider gets the default 0; `updateRiderOnReconnect` sets only the name, scope
  and status columns, so reconnecting keeps the flag (`src/db/riders.ts`). Leaving
  deletes the row and the flag with it (FR-003, US2 scenario 3).
- No configuration, secret or binding changes.

**Rationale**:
- Who is an organiser isn't secret (spec Clarifications, 2026-10-07). What must not
  be public is a real person's athlete ID, and D1 is not in the repository.
- The flag needs a rider row, so "an organiser must be a connected rider" (FR-003)
  holds by construction, with no check of its own.
- The maintainer can see who is an organiser (`SELECT … WHERE organiser = 1`) and
  change one person at a time. A secret can't be read back and is replaced whole.
- The rider row is already read on every signed-in request; the flag costs nothing.
- Adding a column with a default keeps the deployed code working while CI applies
  the migration before publishing (CLAUDE.md, migrations add only). The old code's
  `INSERT INTO riders` names its columns, so new riders get 0.

**Alternatives considered**:
- A Worker secret `ORGANISER_ATHLETE_IDS` (this plan's first draft): it needed
  `secrets.required` so that `wrangler dev` loads it, which made every deploy fail
  until the maintainer set it, plus wiring in six config files; and it hides
  something that needn't be hidden. Replaced by the flag on the owner's request.
- A table `organisers(athlete_id)`: same effect as a column with a foreign key to
  `riders`, one more table and join; rejected.
- Keeping the flag across leaving: the rider's data is deleted on leaving (FR-015),
  and the flag is part of their record; rejected.
- Strava club admins as organisers: the app would need club admin data from Strava
  on every request, and club admins aren't necessarily the team's organisers;
  rejected.

## R3. Migration number

**Decision**: the migration is `0009_organiser_flag.sql`. `0008` is
`0008_push_subscriptions.sql` from feature 010, already in `develop`.

**Rationale**: D1 records applied migrations by file name and applies the rest in
order, so the new file takes the next free number. If another branch claims `0009`
first, whichever reaches `develop` second renames its file before merging; neither
has reached production then, and the two touch different tables.

## R4. Who is asking: one viewer per request

**Decision**:
- A new `src/http/viewer.ts` with `readViewer(request, ctx): Promise<Viewer>`:
  - no valid session, or a session whose rider row no longer exists →
    `{ kind: "visitor" }` (as `/me` already treats it, 001 R9);
  - otherwise `{ kind: "rider", rider }`; the role is `rider.organiser` (R2).
- The row is read afresh on every request, so a cleared flag stops counting on
  the next request (FR-003, US2 scenario 4).
- A rider in `needs_reconnect` is still a rider (001: their row and data stay, and
  they see `/me`), so they can be an organiser too.
- Role doesn't depend on consent: an organiser is a rider with the flag (FR-001).
  Whether they are *shown* to others depends on their consent like everyone's
  (FR-007, R6).
- `/me` and `/me/disconnect` switch from their local `signedInRider` to
  `readViewer`; their behaviour doesn't change. Future organiser pages check
  `viewer.kind === "rider" && viewer.rider.organiser`.
- No page shows the role in this feature: no page needs it yet. It isn't secret
  either (spec Clarifications, 2026-10-07), so organiser-admin may show it.

**Rationale**:
- One function decides "who is asking" for every page, so no view can forget the
  rider-row check or cache the role in a cookie (FR-003, edge case "organiser flag
  cleared mid-session").
- The session cookie stays an athlete ID only; putting the role in it would keep a
  former organiser's rights until the cookie expires.

**Alternatives considered**:
- The role in the session cookie: stale after the flag changes; rejected.
- A separate `organiser` field next to `rider` in `Viewer`: the same fact twice;
  rejected.
- An "Organiser" badge on `/me`: no catalog keys are needed until there are
  organiser pages to link to; left to organiser-admin.
- A `Ctx` field for the viewer: `Ctx` is per invocation and also serves the queue
  and cron, which have no viewer; rejected.

## R5. The visibility rule as one pure table

**Decision**:
- A new pure module `src/visibility.ts`, free of D1, clock and text:
  - `RiderData`: one value per row of the FR-020 table, with FR-022's profile link
    as its own row: `firstName`, `profileLink`, `accumulatedRynke`, `progress`,
    `breakdown`, `attendance`, `corrections`, `rides`, `consentRecords`.
  - `Audience`: `self`, `organiser`, `rider`, `visitor`.
  - `VISIBILITY: Record<RiderData, ReadonlySet<Audience>>`: the FR-020 table,
    written once (see [data-model.md](data-model.md)).
  - `audienceOf(viewer, subjectAthleteId): Audience`: `self` if it's the viewer's
    own data; `organiser` or `rider` by role; `visitor` if not signed in.
  - `maySee(audience, data, subjectShared): boolean`: `self` always; `visitor`
    never; anyone else only if the subject is shared (R6) *and* the table allows
    it.
- Data not in `RiderData` has no entry, so no view can ask for it (FR-020: "Data
  not in this table MUST be shown to nobody but the rider").
- The subject's own role plays no part (FR-007).
- The planned views (organiser-admin, team-leaderboard) build their pages with
  these functions; this feature builds no view (spec, Terms).

**Rationale**:
- US3 asks for the rule "defined once, here". A table in code reads like the spec
  table, and the test can compare it cell by cell with FR-020 (SC-002).
- Keeping it pure makes it cheap to test exhaustively for a synthetic team
  (every viewer × every subject × every data item).
- The `self` row lets a view use the same check for "the signed-in rider's own
  row may be marked as theirs" (FR-020).

**Alternatives considered**:
- Per-view `if (organiser)` checks: exactly what US3 wants to avoid; rejected.
- SQL views per audience in D1: the leaderboard and the organiser overview need
  different shapes, and a migration per rule change is heavy; the query helper in
  R6 is the only SQL needed; rejected.
- A generic permission library: Principle IV, and nine items; rejected.

## R6. Who counts as shared: one SQL fragment

**Decision**:
- A rider is **shared** if they have a consent record with a version that includes
  the FR-020 sharing. `SHARING_SINCE_VERSION = 1` sits next to `CONSENT_VERSION`
  in `src/consent.ts`: every version so far includes it.
- `src/db/consents.ts` exports:
  - `SHARED_RIDER_IDS`, the SQL subquery `SELECT athlete_id FROM consent_records
    WHERE version >= 1` (built from the constant), for future team queries to use
    as `WHERE athlete_id IN (${SHARED_RIDER_IDS})`, so every total, count and
    ranking leaves the others out (FR-021);
  - `listSharedRiderIds(db): Promise<number[]>`, ordered by athlete ID, for views
    that list riders, and for the tests;
  - `isShared(db, athleteId): Promise<boolean>`, for the `subjectShared` argument
    of `maySee` when a view shows a single rider.
- Consent records cascade from `riders` (001 migration `0004`), so a deleted rider
  is never shared. No migration.
- The rider's `status` doesn't matter here: a `needs_reconnect` rider still
  consented. Whether a view shows them is the view's own spec.

**Rationale**:
- One subquery, used inside each aggregate, is the only way to keep a
  non-consenting rider out of *figures* (averages, team totals), not just out of
  rows. Filtering lists in TypeScript after the query would still let them into a
  `SUM`.
- A constant instead of "has any record" prepares for US4: when version 2 shares
  more, the views ask for "shared at least as far as version 2" for the new data,
  and riders on version 1 keep being shown as far as version 1 allows (FR-013).
  US4 decides the exact shape.

**Alternatives considered**:
- A `riders.shared` column: duplicates `consent_records` and can drift; rejected.
- An SQL view `shared_riders` in a migration: same effect as the subquery, but
  every change needs a migration; rejected.

## R7. Visitors on a planned view

**Decision**: `readViewer` returns `{ kind: "visitor" }` for anyone not signed in,
and a new `requireRider(viewer)` helper answers `302 /`, the page where they sign
in with Strava (as `/me` does today, 001). Future views call it first, so a
visitor gets no rider data (US3 scenario 5, FR-020 last sentence).

**Rationale**: the landing page is both the consent and the sign-in; there is no
separate sign-in page (001 R21, "Alternatives considered").

**Alternatives considered**: a `401` page with a "sign in" link — a second way to
say the same thing, needing catalog keys; rejected.

## R8. No real organiser ID in the repository (FR-002, SC-007)

**Decision**: every athlete ID in tests, fixtures and `dev/` is synthetic
(constitution Principle I), as for every rider already. Real organiser IDs exist
only in the production and local databases and in the commands the maintainer types
([contracts/organiser-flag.md](contracts/organiser-flag.md)). No new code logs
anything about the role.

**Rationale**: the role isn't secret, so pages and logs need no rule of their own;
what stays protected is the real person's ID, which the repository never holds.

**Alternatives considered**: a test that no organiser ID appears in pages or logs
(the first draft's R8): it guarded the list's secrecy, which the spec no longer
asks for; dropped.

## R9. Testing

**Decision**:
- `seedRider` in `test/support/ctx.ts` gains an `organiser` option (default
  `false`).
- `test/unit/visibility.test.ts`: the whole table for a synthetic team.
- `test/integration/viewer.test.ts`: a flagged and an unflagged rider, the flag
  cleared between two requests, no rider flagged, a deleted rider, a
  `needs_reconnect` rider with the flag.
- `test/integration/db.test.ts`: `getRider` reads the flag; reconnecting keeps it;
  deleting the rider and connecting again leaves it 0.
- `test/integration/schema-minimisation.test.ts`: `organiser` joins the `riders`
  columns (its header asks for a data-model change with every new column).
- `test/integration/shared-riders.test.ts`: riders with and without a record,
  the subquery inside a `SUM` and `COUNT`, deletion.
- `test/integration/me-status.test.ts`: the rider without a record sees the
  consent and the form (R1).
- `test/integration/dev-fake-strava.test.ts`: the seed marks the sample organiser
  (R10).
- All riders are synthetic (constitution Principles I and V). No test reads
  Strava; the fake Strava of `test/support/` is used where the connect flow runs.

## R10. Fake mode (`pnpm dev`)

**Decision**: `SampleRider` gains `organiser?: true`, set on "Tina TrainingDone"
(990004). After connecting the club members, the seed runs
`UPDATE riders SET organiser = 1` for the sample riders that have it, the same
statement the maintainer runs in production. Since the samples change, their
fingerprint changes and an existing fake database is seeded again.

**Rationale**: organiser-admin needs an organiser in fake mode; marking one now
keeps the seed the only place that sets it. Setting the flag after the connect flow
mirrors production: the app's connect flow never sets it (R2).

**Alternatives considered**: no organiser in the samples until organiser-admin —
nothing shows the role yet, but the walk-through couldn't show the flag surviving a
reconnect; rejected.

## R11. Consent versions are a registry in code, passed in through `Ctx`

**Decision**:
- `src/consent.ts` replaces the bare `CONSENT_VERSION = 1` with a registry:

  ```ts
  interface ConsentVersion {
    version: number;              // 1, 2, …
    published: string;            // "YYYY-MM-DD", the team's calendar day
    requiredScopes: readonly string[]; // Strava scopes the rider must have granted
    changes: readonly MessageId[];     // what grew compared with version - 1
  }
  ```

  `CONSENT_VERSIONS` lists them in order; version 1 is
  `{ version: 1, published: "2026-10-06", requiredScopes: ["read", "activity:read"],
  changes: [] }`. `CONSENT_VERSION` stays as the last entry's number, for code
  that has no `Ctx` (seed scripts).
- `Ctx` gains `consentVersions: ConsentVersions` (a non-empty, ordered list).
  `src/index.ts` and `dev/worker.ts` pass `CONSENT_VERSIONS`; `makeCtx` accepts
  a `consentVersions` option, like `catalogs`. Every request path that used
  `CONSENT_VERSION` (`POST /connect`, the callback, `/me`) reads the current
  version from `ctx.consentVersions`.
- A version is part of the app, not rider data (spec Key Entities): no table.
- Raising the version stays a code change reviewed in a PR: a new entry, its
  `consent.changes.v<N>` keys in every catalog, and the landing texts changed
  together ([contracts/re-consent.md](contracts/re-consent.md) "Publishing a new
  version").

**Rationale**:
- US4's behaviour only shows once a version 2 exists, and there is none yet. Tests
  need a synthetic version 2 without shipping one; injecting the registry through
  `Ctx` is how the project already lets tests swap catalogs (001 research R12).
- `consent_records` can't hold a version 0, so a rider "older than current" can only
  be tested with a current version above 1.
- "What changed" (FR-013, US4 scenario 2) needs a text per version, and the
  permissions a version needs decide whether agreeing goes through Strava
  (scenario 4); both belong next to the number.

**Alternatives considered**:
- A `consent_versions` table: versions are code and catalog text, changed by a
  PR; a table would need a migration and seeding for the same content; rejected.
- Mocking the module in tests (`vi.mock`): works poorly in the Workers pool and
  hides the dependency; rejected.
- Keeping each version's full text to show a rider exactly what they agreed to
  back then: the catalogs would carry every old text forever. The gate shows what
  changed plus the current text; a rider on the current version sees the text
  they agreed to (FR-014). Rejected.

## R12. FR-014 (what the rider agreed to) is already met on `/me`

**Decision**: `/me` already shows the version and date
(`me.consent.accepted`), what is read (`landing.dataRead`), who sees what
(`consent.organisers`, `consent.team`), the granted permissions
(`me.scope.readAll`/`sharedOnly`, `me.scope.write`/`noWrite`) and the "Disconnect
and delete my data" link (001). US4 scenario 1 gets one test that checks all of
them together; no code change.

**Rationale**: built by 001 with this spec (R1); only the scenario lacks its own
test.

## R13. Being "shown as far as the accepted version allows": a version per item

**Decision**:
- `src/visibility.ts` gains `SINCE_VERSION: Record<RiderData, number>`: the first
  consent version that shares the item. Today every item is `1`
  (`SHARING_SINCE_VERSION`). A future version that shares something new adds a
  `RiderData` value with its own since-version, or raises an existing one only if
  it shares that item with more people.
- `maySee(audience, data, subjectVersion: number | null)` replaces the boolean
  `subjectShared` of R5: rule 3 becomes "`subjectVersion` is `null` or below
  `SINCE_VERSION[data]` → `false`". The other rules stay.
- `src/db/consents.ts`: `sharedRiderIdsSince(version)` returns the subquery
  `SELECT athlete_id FROM consent_records WHERE version >= <version>`;
  `SHARED_RIDER_IDS` is `sharedRiderIdsSince(SHARING_SINCE_VERSION)`. A query for an
  item filters with `sharedRiderIdsSince(SINCE_VERSION[item])`.
- `isShared(db, athleteId)` becomes `consentVersionOf(db, athleteId):
  Promise<number | null>` (the highest accepted version), which is what `maySee`
  now takes. `listSharedRiderIds` stays.

**Rationale**:
- FR-013: "until they agree, others MUST see them only as far as the version they
  accepted allows". Versions only grow (Principle I: a new version is needed when
  sharing grows), so "accepted ≥ since-version" is exactly "their consent covers
  this item".
- The rider's records are kept per version (`PRIMARY KEY (athlete_id, version)`),
  so `version >= n` works on the existing table; the highest is the current one.
- Changing US3's signature now, before any of it is built, avoids a second
  version of the same function.

**Alternatives considered**:
- Hiding every rider who hasn't accepted the newest version: simpler, but takes
  away what they already agreed to, and FR-013 says "as far as the version they
  accepted allows"; rejected.
- A since-version per audience *and* item: no planned change needs it; a version
  that shares an item with more people adds a new item or raises its since-version.
  Rejected until a version needs it.

## R14. The consent gate on `/me`, and how agreeing works

**Decision**:
- `consentState(versions, accepted, grantedScopes)` (pure, `src/consent.ts`)
  answers one of:
  - `{ kind: "current" }`: accepted ≥ current;
  - `{ kind: "missing" }`: no record (the US1 edge case);
  - `{ kind: "older", accepted, changes }`: `changes` concatenates the `changes`
    of every version after `accepted` up to current;
  plus `viaStrava: boolean`: true when there is no record, or when the current
  version's `requiredScopes` aren't all in the rider's `riders.scopes`.
- `/me`: when the state isn't `current`, the page shows the **gate** instead of
  the rider's content ([contracts/re-consent.md](contracts/re-consent.md)): the
  accepted version and date, what changed, the current consent texts, a form, and
  the link to "Disconnect and delete my data". Status, Rynke, rides and the
  notification switch are not shown until they agree ("before using the app
  further"). Sign-out, `/me/disconnect` and `GET /connect` stay reachable.
- The form:
  - `viaStrava` → `consentForm(i18n, current)`, posting to `POST /connect`; the
    callback already records the version for an existing rider (001 R21), and
    Strava asks for the missing permission (scenario 4);
  - otherwise → a form posting `consent=<current>` to the new
    `POST /me/consent`, with a text button `me.consent.renew.button`.
- `POST /me/consent`: same-origin, signed-in rider, `consent` equals the current
  version, and `viaStrava` false; then `recordConsent(…, current, now)` and `303
  /me`. Not signed in → `302 /`; another origin → 403 (`forbidden`); a wrong
  or missing value → `303 /me`, where the gate asks again (the
  `consent-required` notice sends riders to the start page, which is wrong
  here); a rider who needs Strava → `303 /me`, where the gate shows the Strava
  form.
- Planned views call `requireConsent(viewer, ctx)` after `requireRider`: `302
  /me` unless the state is `current`.
- This supersedes R1's "the form doesn't block the rest of `/me`": a rider
  without a record now gets the gate too, with the same texts and form R1 chose.
- Background work (webhooks, imports, the daily run, notifications to the rider
  themselves) goes on: it reads only what the version they accepted covers and
  shows nothing to anyone else.

**Rationale**:
- Scenario 2 asks for "before using the app further": `/me` is the only page a
  rider uses today, and future views get one helper.
- Scenario 4 needs Strava only for a new permission; sending every re-consent
  through Strava would cost one authorisation and token exchange per rider
  for nothing (Principle II).
- Leaving stays the existing, tested path (scenario 5, 001 FR-023).

**Alternatives considered**:
- Redirecting every page to a separate `/consent` page: one more GET route, and
  `/me` is already where the consent lives; rejected.
- Always through Strava (no `POST /me/consent`): simpler, but against Principle II
  for a text-only change; rejected.
- Pausing background work until the rider agrees: imports would fall behind and
  need catching up; the old consent still covers reading. Rejected.

## R15. The viewer carries the accepted version

**Decision**: `Viewer`'s rider variant becomes
`{ kind: "rider"; rider: Rider; consentVersion: number | null }`. `readViewer`
reads it with `consentVersionOf` in the same request (R13), so `/me` and
`requireConsent` don't read it again.

**Rationale**: every signed-in page needs it for the gate; one more primary-key
read per request is negligible at ≤ 10 riders.

**Alternatives considered**: a separate call in each page: easy to forget,
which is what `readViewer` exists to prevent (R4); rejected.

## R16. Texts

**Decision**:
- New keys, in `de` and `en` (FR-040):
  - `me.consent.renew.heading`: the gate's heading;
  - `me.consent.renew.older`: "You agreed to version {accepted} on {date}. Version
    {version} changes this:";
  - `me.consent.renew.strava`: Strava asks for permissions again;
  - `me.consent.renew.button`: "Agree and continue";
  - `me.consent.renew.leave`: if they don't agree, they can leave, and leaving
    deletes all their data.
- `me.consent.none` (reworded in US1) introduces the gate for a rider without a
  record.
- Each future version N adds `consent.changes.v<N>.*` keys and lists them in its
  registry entry's `changes`. Version 1 has none.

**Rationale**: the catalog tests already require every key in every language
(001 FR-028), which covers SC-008 for future versions too.

## R17. One delivery for US1–US4

**Decision**: US4 is planned into the same PR as US1–US3 (plan "Delivery").

**Rationale**: US4 changes two things US1–US3 introduce and haven't built yet:
`maySee`'s third argument (R13) and the `/me` consent section for riders without
a record (R14). Building US1–US3 first and changing them in a second PR would
build both twice. With only version 1 published, US4 adds no visible change for
riders who have a record.

**Alternatives considered**: a second PR after US1–US3: smaller PRs, but both
changes would land twice; rejected.
