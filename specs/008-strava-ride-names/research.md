# Research: Ride Names and Links to Strava in the Ride List

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

Each section records a decision, why it was taken, and what else was considered.
"001", "005" and "006" are the earlier features whose code this one extends.

## R1. Store the name in `activities.name`, nullable (FR-001, FR-005)

**Decision**:
- Migration `0007_activity_name.sql` adds `name TEXT` to `activities`. It has no
  default and no `NOT NULL`, so rows stored before the migration start as `NULL`
  (unknown).
- `StravaActivity` gains `name?: string`, and `ActivityRecord` gains
  `name: string | null`.
- `toActivityRecord` copies the name exactly as Strava sends it. A missing name,
  `""` or a name of whitespace only becomes `NULL` (FR-005). Nothing is trimmed or
  shortened.
- `upsertActivityStatement` writes the name in both the insert and the
  `ON CONFLICT … DO UPDATE` part. A later reading therefore replaces the name, and
  a later blank name clears it.
- The column is named after Strava's field, `name`.
  `test/integration/schema-minimisation.test.ts` forbids column names containing
  `name` or `title`, so the test gets a second documented exception,
  `activities.name`, next to `riders.first_name`, and `name` joins its
  `activities` column list.

**Rationale**: the column is additive and nullable, so the code deployed before
this release keeps working: its upsert never mentions `name` (CLAUDE.md, forward-only
migrations). `NULL` for unknown follows the rule migrations 0002 and 0003 set for
figures: never a guessed value. The exact text matters because it is the
rider's own wording (FR-010).

**Alternatives considered**:
- *A separate `activity_names` table*: one more join and one more deletion path,
  but nothing gained. Deleting the `activities` row deletes the name with it
  (FR-003).
- *Column `title`*: Strava's webhook calls the change `title`, but its activity
  objects call the field `name`. Matching the API keeps the mapping obvious.
- *Cap the length* (e.g. 255 characters): Strava already limits names, and the
  spec asks for the name exactly as on Strava. A wrapping rule in CSS handles long
  names (R4).

## R2. A title-only update refetches the ride (FR-004)

**Decision**: remove the early return in `src/work/activity-event.ts` that skips
`aspect: "update"` events whose only change is `title`. Every update now takes
the existing path: `GET /activities/{id}`, then `evaluateChange` with an upsert.

**Rationale**:
- The decision table already converges any update to Strava's current state, and
  the name is now part of that state.
- Rynke can't change from a rename. Feature 003's rules read figures only, and
  evaluation is a pure function of them (constitution IV). The ride's result is
  recomputed with identical figures; only `activity_refreshed_at` moves.
- The cost is one read request per rename. Riders typically rename a ride once,
  shortly after uploading, so this adds at most about one request per ride. That
  is far below the read limit of 100 per 15 minutes and 1,000 per day
  (constitution II). Budget exhaustion is handled as for every update: the
  message is retried later (001 FR-018).

**Alternatives considered**:
- *Store the title from the webhook's `updates.title`* without fetching: the
  webhook body is unauthenticated input. The app only trusts what it reads from
  the API with the rider's token (001 research). It would also need a write path
  that bypasses `toActivityRecord`.
- *Keep ignoring title-only updates*: then renames would never show (Story 2,
  scenario 2).

## R3. Names for stored rides through the existing re-read (FR-006, SC-002, SC-003)

**Decision**:
- Raise `ACTIVITY_FIGURES_VERSION` from 2 to 3 and document version 3 as "the
  ride name". The daily cron's `fanOutFiguresReread` then sends one `reread-page`
  per connected rider at a lower version, as it did for versions 1 and 2.
- `rereadPage` lists the rider's season, 200 rides per page, and upserts every
  listed cycling ride through `storeActivityPage`. The activity list returns the
  name with each summary, so every listed ride gets its name.
- `listActivityIdsMissingFigures` stays as it is: the name is **not** a figure.
  After the last page the re-read refetches only rows with a missing *figure*,
  never rows with a missing name. A ride the list didn't return keeps no name
  until its next update. This applies to rides stored before the season start, or
  a ride whose name is blank.
- The column on `riders` stays `figures_version`, and the constant keeps its name.
  Their doc comments now say "field set" rather than "figures".

**Rationale**:
- The re-read is already resumable, throttled and checkpointed per page.
  `storeActivityPage` and the queue consumer handle the budget, retries and
  `failed_work` (001 FR-018, FR-021). This needs no new machinery.
- Cost: `ceil(rides / 200)` list requests per rider. With at most 10 riders and at
  most 500 rides each, that is at most 30 requests, spread over the queue.
- Keeping names out of the per-ride refetch is what makes SC-003 hold
  ("no request per ride"). An empty or blank name can't be fixed by refetching
  anyway.
- Rynke don't move. The listed figures equal the stored ones unless the rider
  changed the ride on Strava, which is the exception FR-006 allows.

**Caveat for SC-002**: the re-read covers rides since the season start (the
import's `after`). A ride stored before that date only exists if the season start
moved, and it gets its name with its next update. SC-002 is checked against
season rides. Tasks should state this rather than add per-ride requests.

**Alternatives considered**:
- *A separate "names re-read" message kind*: it would duplicate `reread-page`
  except for one field.
- *Fetch the name per ride when the page is shown*: this breaks 005 FR-003 (the page
  never calls Strava) and uses one request per row (FR-002).
- *Leave old rides unnamed*: this fails Story 3.

## R4. Where the name and the link go in the ride table (FR-009, FR-011, FR-013, SC-007)

**Decision**: 005 gives each ride two table rows: a main row (date, distance,
status, Rynke, elevation total) and a detail row spanning all five columns.
The name and the link go first in the detail row:

```html
<tr class="ride-details"><td colspan="5"><p class="ride-strava"><span class="ride-name">Rund um den Sorpesee</span> <a class="tap strava-activity" href="https://www.strava.com/activities/8000001">View on Strava</a></p>Rennrad · 640 m …</td></tr>
```

- When the name is unknown, the `span.ride-name` is left out entirely, with no
  placeholder (FR-005). The link stays (FR-011).
- The name is interpolated through the `html` template, which escapes it (FR-010).
  It is never put in an attribute.
- The link points to `${STRAVA_ORIGIN}/activities/${activityId}`. The ID is a
  number from D1, never user input.
- The link opens in the same tab, without `target` or `rel`, like the app's existing
  links to the Strava club (`landing.ts`, `notice.ts`). This resolves the spec
  assumption that was "left to planning".
- CSS: `.ride-name{overflow-wrap:anywhere;color:#333}` and
  `.strava-activity{font-weight:700;text-decoration:underline}`. The link inherits
  the detail row's `.875rem`, so it is never larger than the text around it.
  `.tap` gives it the 44 px tap height (005 FR-072).

**Rationale**:
- The detail row spans the whole table width on every screen. A 100-character
  name therefore wraps inside it and never widens the five data columns, which
  005 sized for 360 px (SC-007).
- 005 FR-071 allows moving content below the main columns. Putting it there on
  desktop too keeps one markup for all widths, so no media query is needed.
- The name sits right above the sport and the reasons for the same ride. The
  fix hint ("change it on Strava", 005 FR-044) and the link that does it are
  therefore in the same cell.

**Alternatives considered**:
- *Name in the date cell*: a long name would widen the first column, and the 360 px
  layout needs a second wrapping rule.
- *A sixth column*: it breaks 005's phone layout.
- *Open in a new tab* (`target="_blank" rel="noopener"`): this is unlike the app's
  other Strava links, and on phones the Strava app link handling usually takes
  over anyway.

## R5. Link styling under Strava's Brand Guidelines (FR-009)

**Decision**: bold and underlined, in the page's normal link colour. Not Strava
orange.

**Rationale**: §3 allows any one of bold, underline or #FC5200. Orange #FC5200
on white has a contrast ratio of about 3.0:1, below WCAG AA's 4.5:1 for small
text. The detail row's text is .875rem, so orange would make the link harder to
read than the text around it. Bold plus underline also survives a later Material
Design restyle (005 research R10) without depending on colour.

**Alternatives considered**: *Strava orange*: rejected for contrast. *Underline
only*: allowed, but bold makes the brand rule hold even if a restyle removes
underlines.

## R6. Consent text without a new consent version (FR-007)

**Decision**:
- `landing.dataRead` (de, en) names the ride name first among the data read.
  `landing.purpose` already says nobody sees single rides except the rider. It
  gains the name explicitly (wording in
  [contracts/messages.md](contracts/messages.md)).
- `CONSENT_VERSION` stays `1`. The comment in `src/consent.ts` gets one sentence
  recording the exception and pointing to 008 FR-007. The exception covers a
  field the app already received, now kept and shown only to the rider.
- The consent section on `/me` (`me.ts`, `consent()`) shows `landing.dataRead`
  above `consent.organisers` and `consent.team`. Connected riders, who are not
  asked again, can then read what is stored about their rides (FR-007, last
  sentence; 004 FR-014).

**Rationale**: the user settled the version question in the spec's
clarification (Q1 → B). The `/me` consent section today shows only who sees
what, so without this change a connected rider would never see the updated
"what is read" text.

**Alternatives considered**: *A notice on `/me` about the change*: it has to be
dismissed or expire, which means state the page can't write (005 FR-003).
*Raise the version*: rejected in the clarification.

## R7. The name stays on the rider's own page (FR-008, SC-005)

**Decision**:
- Only `RIDE_PAGE_SQL` (`src/db/rider-view.ts`) selects `a.name`. It is read with
  `WHERE a.athlete_id = ?1`, where the ID comes from the session (005 FR-002).
- `listRiderActivitiesStatement` and `listRecentActivities` keep their column
  list. Evaluation, organiser pages and the team view (when they exist) work from
  those lists and never carry the name. `COLUMNS` in `src/db/activities.ts` gets
  no `name`.
- Names are never logged. Queue messages and `failed_work` rows hold IDs only (001
  contracts/queue-messages.md), so a name can't reach a log through them.
  `test/unit/no-secret-logging.test.ts` keeps guarding console output.
- An integration test seeds a ride with a distinctive name and fetches every
  rider-facing route except `/me`. These are `RIDER_PAGES` from
  `test/support/pages.ts`, plus the landing page, the notice and disconnect pages
  and `/admin/run-daily`. The test asserts the name is absent from each. A
  second rider's `/me` must not show it either.

**Rationale**: excluding the column from the shared read paths keeps the name
out of any future page built on them by default, rather than by review alone.

## R8. Copy guard and catalog contract (FR-012)

**Decision**:
- New message ID `brand.viewOnStrava`: `"View on Strava"` in both `de` and `en`.
  It goes under `brand.*` because the text is Strava's, like
  `brand.poweredByStrava.alt`. It is added to `CONTRACT_IDS` in
  `test/unit/catalogs.test.ts`, with an assertion that `de` holds the English
  text word for word.
- `test/integration/no-hardcoded-copy.test.ts` wraps every catalog text in ⟦…⟧
  and fails on any other visible text. Ride names are rider data, not copy, so
  `unmarkedText` drops the content of `span.ride-name` the same way it drops
  `<style>`. The seeded page riders get names, so the guard also proves the name
  is the only text exempted.

**Rationale**: FR-012 requires the label in the catalogs even though it isn't
translated, so a third language changes catalogs only (Language section of the
constitution).

## R9. Fake Strava in `pnpm dev` (spec Assumptions, 006)

**Decision**:
- Sample rides already carry invented names (`dev/fake-strava/samples.ts`,
  `"<sport> on <day> at <time>"`). The app now stores and shows them, with no
  sample changes needed.
- The fake's "Change a ride" form gains a `Name` field. `updatesFor` reports a
  changed name as `title`, the key Strava's events use. The title-only path (R2)
  can then be tried locally.
- The dev entry (`dev/worker.ts`) rewrites `a.strava-activity` links in HTML
  responses with `HTMLRewriter`. The rewritten target is
  `/_dev/strava/activities/<id>`, a small stand-in page listing the fake ride's
  fields. This is the same idea as `rewriteAuthorize`.

**Rationale**: fake activity IDs start at 8,000,001, and those IDs exist on the
real Strava. Without the rewrite, a developer clicking a link in `pnpm dev`
would land on a real stranger's activity page. The rewrite lives in `dev/`, so
the production bundle is unchanged (006 FR-009, `dev-guard.test.ts`).

**Alternatives considered**: *A configurable activity-link origin in `src/`*:
this puts a dev concern into production code and config. *Leave it*: it sends
developers to strangers' rides.

## R10. Documents that change with the code

`README.md`'s list of stored data adds the ride name and drops "titles" from
what is not stored. 001's `data-model.md` adds the `name` row to `activities`
(the schema test points there). 005's `contracts/rider-page.md` gets a pointer
to this feature's [contracts/rider-page.md](contracts/rider-page.md). The spec
notes that 008 supersedes (001 assumption, 005 note) stay as history. These
edits ship with the implementation PR, not with this plan.

## R11. Dependencies and platform

No new dependency. `HTMLRewriter` (R9) is a Workers runtime API, used only in
`dev/`. There are no new bindings, routes in `src/`, queue message kinds or
cron jobs. D1 grows by one short text per ride, negligible against the free
tier.
