# Research: Roles and Rider Consent (User Stories 1–3)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

Each section records the decision, why it was taken, and what else was considered.
"001" is feature 001-strava-connect-webhook, whose code this plan reads and extends.
User Stories 4 and 5 are out of scope for this plan; where a decision prepares for
them, the section says so.

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

## R2. The organiser list is a declared Worker secret

**Decision**:
- `ORGANISER_ATHLETE_IDS`, a Cloudflare secret holding the organisers' Strava
  athlete IDs. It goes in `secrets.required` in `wrangler.jsonc`, then
  `pnpm types`, like `ADMIN_TOKEN` (feature 007 R4).
- Production: the maintainer runs `pnpm wrangler secret put ORGANISER_ATHLETE_IDS`
  before the release containing this feature is merged into `main`
  ([contracts/configuration.md](contracts/configuration.md)). Changing the list
  later is the same command; it takes effect without a code change or deploy
  (FR-002, SC-006).
- Tests: `vitest.config.ts` binds it to `""` (no organisers); a test that needs
  organisers builds its `Ctx` with another value (R9).
- `pnpm dev`: `dev/fake.env` holds synthetic sample IDs (R10), and the `pnpm dev`
  script unsets the variable like the other declared secrets.
- `.dev.vars.example` gets the line with a comment, for `pnpm dev:strava`.

**Rationale**:
- A secret keeps the IDs out of the repository, `wrangler.jsonc`, CI logs and the
  Cloudflare dashboard's plain variables (FR-002, SC-007).
- Declaring it is the only way Wrangler loads it from `.dev.vars` or
  `dev/fake.env`: once `secrets.required` exists, `wrangler dev` loads only the
  declared secrets from env files (wrangler 4.147, `getVarsForDev`). It also makes
  `pnpm types` add it to `Env`.
- Declaring it also makes a deploy without it fail ("The following required
  secrets have not been set"). That is the same rollout step as `ADMIN_TOKEN`, and
  the code still treats a missing or empty value as "no organisers" (FR-006, R3),
  so local runs and tests don't depend on it.

**Alternatives considered**:
- An undeclared, optional secret with a hand-written `Env` augmentation: deploys
  without it, but `wrangler dev` would never load it from `.dev.vars`, so the
  maintainer couldn't try organiser rights locally; rejected.
- A plain `vars` entry: visible in the repository and dashboard (FR-002);
  rejected.
- A D1 table of organisers: needs a way to change it, which FR-004 rules out from
  inside the app, and the spec puts the list in deployment configuration; rejected.
- Strava club admins as organisers: the app would need club admin data from Strava
  on every request, and club admins aren't necessarily the team's organisers;
  rejected.

## R3. Reading the list

**Decision**:
- `organiserIds(value: string | undefined): ReadonlySet<number>` in a new
  `src/roles.ts`: splits on commas and whitespace, keeps entries that are positive
  decimal integers, ignores everything else. `undefined`, `""` or only
  separators give an empty set.
- Read from `ctx.env` on every request, never cached across requests (FR-003).
- Nothing is logged: not the list, not the count, not ignored entries.

**Rationale**:
- Commas or spaces are what someone typing `wrangler secret put` produces;
  accepting both avoids a format error turning into "nobody is an organiser".
- Ignoring malformed entries keeps the app working for riders (FR-006). The effect
  of a typo is visible at once to the organiser concerned, who has no organiser
  pages; a log line would put information about the list into the logs on every
  request, which FR-002 forbids for the IDs themselves.
- Parsing a short string per request costs nothing.

**Alternatives considered**:
- JSON (`[123, 456]`): easy to get wrong at the prompt, no benefit for a list of
  integers; rejected.
- Failing the request on a malformed list: breaks the app for riders because of an
  organiser typo (FR-006); rejected.
- A count-only warning for ignored entries: noise on every request; rejected.

## R4. Who is asking: one viewer per request

**Decision**:
- A new `src/http/viewer.ts` with `readViewer(request, ctx): Promise<Viewer>`:
  - no valid session, or a session whose rider row no longer exists →
    `{ kind: "visitor" }` (as `/me` already treats it, 001 R9);
  - otherwise `{ kind: "rider", rider, organiser }`, where `organiser` is
    `organiserIds(ctx.env.ORGANISER_ATHLETE_IDS).has(rider.athleteId)`.
- The role is computed only after the rider row is found, so an ID on the list
  whose owner isn't a rider grants nothing (FR-003, US2 scenario 3), and a removed
  ID stops counting on the next request (US2 scenario 4).
- A rider in `needs_reconnect` is still a rider (001: their row and data stay, and
  they see `/me`), so they can be an organiser too.
- Role doesn't depend on consent: an organiser is a rider on the list (FR-001).
  Whether they are *shown* to others depends on their consent like everyone's
  (FR-007, R6).
- `/me` and `/me/disconnect` switch from their local `signedInRider` to
  `readViewer`; their behaviour doesn't change. Future organiser pages check
  `viewer.kind === "rider" && viewer.organiser`.
- Nothing about the role is shown on any page in this feature, and the role is
  never stored (Key Entities: "Role: not stored").

**Rationale**:
- One function decides "who is asking" for every page, so no view can forget the
  rider-row check or cache the role in a cookie (FR-003, edge case "organiser
  removed mid-session").
- The session cookie stays an athlete ID only; putting the role in it would keep a
  removed organiser's rights until the cookie expires.

**Alternatives considered**:
- The role in the session cookie: stale after a list change; rejected.
- An "Organiser" badge on `/me`: no catalog keys are needed until there are
  organiser pages to link to, and it adds a page that reveals the role; left to
  organiser-admin.
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

## R8. Keeping organiser IDs out of pages and logs (FR-002, SC-007)

**Decision**:
- No page renders the list, the role, or anyone's athlete ID because of the role.
- `src/roles.ts` and `src/http/viewer.ts` log nothing.
- Existing log lines that name a rider's athlete ID (e.g. `src/strava/tokens.ts`
  "Revoke for athlete …") stay: they are about that rider, not about the list,
  and never say whether the rider is an organiser.
- A test renders the landing page and `/me` for an organiser and for a rider while
  the list holds both their IDs and a third one, and checks that none of the
  listed IDs appears in the pages or in any console output. Pages render no
  athlete ID today; the test keeps it that way.
- The repository holds synthetic IDs only (constitution Principle I): the
  test value is `""` or invented IDs, `dev/fake.env` holds sample IDs (R10).

**Rationale**: SC-007 is about the list leaking. An organiser is a rider, and a log
line about their own Strava token is no more revealing than for anyone else.

**Alternatives considered**: removing athlete IDs from every log line — a change to
features 001 and 003 beyond this scope, and those lines are how the maintainer
finds a rider's failure; rejected.

## R9. Testing

**Decision**:
- `makeCtx` in `test/support/ctx.ts` gains an `env` option merged over the test
  bindings, so a test sets `ORGANISER_ATHLETE_IDS` per case (and leaves it out to
  test "missing").
- Pure modules get unit tests: `test/unit/roles.test.ts` (parsing) and
  `test/unit/visibility.test.ts` (the whole table for a synthetic team).
- `test/integration/viewer.test.ts`: roles for riders on and off the list, an ID
  without a rider, a list change between two requests, an empty and a missing
  list, a deleted rider, a `needs_reconnect` rider.
- `test/integration/shared-riders.test.ts`: riders with and without a record,
  the subquery inside a `SUM` and `COUNT`, deletion.
- `test/integration/organiser-ids-hidden.test.ts`: R8.
- `test/integration/me-status.test.ts`: the rider without a record sees the
  consent and the form (R1).
- All riders are synthetic (constitution Principles I and V). No test reads
  Strava; the fake Strava of `test/support/` is used where the connect flow runs.

## R10. Fake mode (`pnpm dev`)

**Decision**: `dev/fake.env` gets `ORGANISER_ATHLETE_IDS=990004,990099`: the
sample rider "Tina TrainingDone" is an organiser, and 990099 is an invented ID no
sample rider has, so the list also shows "an ID without a rider grants nothing".
Nothing in fake mode shows the role yet; organiser-admin will use it.

**Rationale**: the declared secret must have a value in fake mode, or Wrangler
warns on every start (R2); a real organiser in the samples saves organiser-admin
a change to `dev/`.

**Alternatives considered**: an empty value — no warning, but later features would
need to change `dev/fake.env` anyway; rejected.
