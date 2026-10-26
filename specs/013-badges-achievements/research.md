# Research: Badges and Achievements

Each decision names what was chosen, why, and what else was considered.
R1 to R9 belong to part A, the art pipeline; R10 to R22 to part B, the app;
R23 to R31 to part C, the categories added on 2026-10-12; R32 to R37 to part
D, the surprise badges; R38 to R41 to part E, the team surprise badges (see
[plan.md](plan.md)).

# Part A: art pipeline

## R1 Frame in code, picture from Gemini

- **Decision**: The badge frame (sunflower-petal edge, ring with three stars,
  round cream window) is drawn exactly in SVG by our code. Gemini draws only the picture for
  the window, on plain white.
- **Rationale**: Gemini's circles and repeated shapes are never exact, and 69
  frames drawn by Gemini would all differ. The rider-state illustrations (PR
  #101) made the same call ("we draw the disc in SVG").
- **Alternatives**: Gemini draws the whole badge, then the window is cut out:
  the window's position and size would differ per image, so cropping would need
  detection and still leave uneven frames.

## R2 One finished SVG per badge, composed at build time

- **Decision**: `pnpm badge-build` composes frame plus traced picture into one
  self-contained SVG per badge (`public/badges/<id>.svg`), with explicit colours.
  The app shows it with a plain `<img>`.
- **Rationale**: The coin colours are the same in light and dark mode
  (`--rp-coin-*` has no dark override in `src/http/style.ts`), and the gold edge
  separates the badge from either background, so CSS variables add nothing. One
  file per badge means one request, lazy loading, and no compositing code in the
  Worker. The page only references badges the rider has earned, which keeps the
  surprise (SC-003).
- **Alternatives**: Frame as an inline sprite (like the coin) plus the picture
  as a separate `<img>` clipped by CSS: two layers to keep aligned and twice the
  requests. Inlining the pictures in the page: page weight grows with every badge.

## R3 Frame source of truth: `scripts/badge-frame.mjs`

- **Decision**: A dependency-free module exports the frame markup for both kinds,
  the window geometry and the coin's Rynke as the placeholder picture. The
  placeholders and every finished badge come from it. Its design follows the
  hand-made reference images in `art/badges/reference/` (the project owner's
  design, 2026-10-11): two layers of petals (gold behind, yellow in front, each
  with a centre vein), the ring, three stars, the window.
- **Rationale**: One definition, so the placeholder and the shipped badges can't
  drift apart. The reference images stay hand-made: Gemini only needs the look,
  and an exact SVG copy of a raster design would be redrawn by hand anyway. A test checks that its Rynke matches
  the coin's front in `src/http/coin.ts`, so a change to the coin can't be
  forgotten here.
- **Alternatives**: Importing `coin.ts` from the script: Node can't resolve the
  app's extensionless TypeScript imports without a build step.

## R4 Picture placement in the window

- **Decision**: Gemini's canvas is 2048 px with the scene inside a centred circle
  of 1800 px (`prompt.txt`). Traced over the full canvas into 100 units, that
  circle has radius 1800 / 2048 × 50 = 43.95 at (50, 50). With the window's
  radius `r` (set when the frame is drawn, T009), the picture is placed with
  `translate(50 50) scale(r / 43.95) translate(-50 -50)` and clipped to the
  window; for `r` = 31 that is `scale(0.7054)`.
- **Rationale**: Every picture is generated on the same canvas, so one fixed
  transform fits all, like the illustrations keep a shared scale.
- **Alternatives**: Fitting each picture to its own bounding box: pictures would
  end up at different sizes and lose the "cropped round" composition the prompt
  asks for.

## R5 Tracing: shared tracer from PR #101

- **Decision**: After #101 is merged, its tracing is moved into
  `scripts/trace.mjs` (`traceImage(file) → { viewBox, paths }`), used by both
  `illustrations.mjs` and `badge-build.mjs`. Settings stay the same (palette
  snapping, 5 × 5 majority filter, one potrace layer per colour).
- **Rationale**: One tracer, one palette. The badge prompts ask for the same flat
  style and colours as the illustrations; the thinner outlines (about 32 px, 20
  px for background) and smallest details (about 24 px) are above the filter's
  5 px and potrace's 48 px² speck limit.
- **Alternatives**: A copy of the tracer for badges: two places to fix. Changing
  #101 now: another session is working on that branch.

## R6 Generation: Playwright on the maintainer's Chrome

- **Decision**: `scripts/badge-art.mjs` (exists) drives Google Chrome with its
  own profile outside the repo (or an already running Chrome over CDP): a fresh
  Gemini chat per badge, reference attached, prompt pasted, image downloaded at
  full size. Strictly sequential and paced so it doesn't stress Gemini: a few
  seconds between steps, one to three minutes between badges (doubled after a
  failure), at most 10 badges per run. Resumable, skips existing originals,
  stops on a usage limit, screenshots failures. Selectors in one `SELECTORS` table, English and German.
- **Rationale**: The project owner wants the proven manual flow (web Gemini,
  prompt plus reference) without the copy and paste. Playwright is already a dev
  dependency.
- **Alternatives**: The Gemini API with an API key: more robust and testable, but
  a different account setup and billing than the owner uses; can replace the
  browser step later without touching anything after it (originals in the same
  folder).

## R7 Originals stored palette-snapped

- **Decision**: After download, `pnpm badge-build` snaps each original to the
  coin palette (the tracer's first step) and stores it as an indexed PNG of at
  most 2048 px in `art/badges/originals/<id>.png`; the raw download is kept only
  locally.
- **Rationale**: Raw Gemini PNGs are around 1 to 3 MB each; 69 of them would add
  well over 100 MB to a public repo, and again with every retake. A
  palette-snapped image has 7 colours and compresses to roughly 50 to 150 KB,
  and snapping it again changes nothing, so every build traces the same
  pixels. (Measured on two of #101's Gemini images: 1.5 and 2.0 MB raw, 52 KB
  snapped; the first snap may move a few edge pixels against the raw file.)
- **Alternatives**: Committing raw originals as #101 does for three images:
  fine for three, not for 69. Not committing originals at all: retuning the
  tracer would need new Gemini images.

## R8 The picture list for the app

- **Decision**: `pnpm badge-build` writes `src/badges/pictures.ts` with the ids
  of every badge that has a finished SVG (`BADGE_PICTURES: ReadonlySet<string>`).
  The app shows `/badges/<id>.svg` for those and the placeholder of the badge's
  group otherwise.
- **Rationale**: The Worker can't cheaply check whether a static asset exists;
  a generated list is checked by `tsc` and costs nothing at runtime. It makes
  FR-040a hold by construction: adding a picture changes only this list.
- **Alternatives**: Requesting the file and falling back on 404 in the browser:
  a failed request per missing picture and a visible flash.

## R9 Badge ids: `badges.json` now, the app catalog later

- **Decision**: `art/badges/badges.json` holds the ids, groups, categories and
  thresholds of the spec's ladders for the pipeline. When the app's badge
  catalog is built (the other part of this feature), a test asserts both list
  the same ids, groups and thresholds.
- **Rationale**: The art can be made before the evaluation exists, and a
  mismatch is caught the moment both exist.
- **Alternatives**: The app catalog importing `badges.json`: it would mix scene
  prose into the app bundle.

# Part B: the app

## R10 Runs in a table of their own

- **Decision**: Runs go into a new `runs` table, never into `activities`.
  `toActivityRecord` stays cycling-only; a new `toRunRecord` maps Strava's
  outdoor runs.
- **Rationale**: Everything in feature 003 (ride rules, overlap, pause, speed,
  the ride list, the Team page's weekly sums) reads `activities`. Keeping runs
  out of it makes FR-021 and SC-004 hold by construction: no Rynke code can see
  a run.
- **Alternatives**: Runs in `activities` with a sport-type filter in every
  reader: one forgotten filter and a run earns Rynke or shows as a ride.

## R11 Only outdoor, non-manual runs are kept

- **Decision**: `toRunRecord` keeps an activity only when its sport type is
  `Run` or `TrailRun`, Strava's `trainer` flag isn't true and its `manual` flag
  isn't true; it stores the activity id, rider, start date, local start date,
  distance, private flag and refresh time. A run that later becomes indoor or is
  deleted is removed like a ride that stops being cycling. A flag Strava doesn't
  send counts as not set (feature 003 FR-005f: an unknown figure never
  excludes).
- **Rationale**: Manual runs count nothing (FR-020) and indoor runs nothing
  (FR-020a), so storing them would keep data without a use (Principle I). This
  is stricter than FR-020's "whether entered manually"; the spec is updated to
  match. The private flag is needed so withdrawing private access removes
  private runs too (feature 001 FR-007).
- **Alternatives**: Store all runs with flags, filter in the evaluation: more
  data, same badges.

## R12 Existing riders' runs: the one-time re-read

- **Decision**: Raise `ACTIVITY_FIGURES_VERSION` from 3 to 4. The daily cron
  already re-reads every rider stored with an older version, page by page within
  the Strava budget (feature 001 research R20); `storeActivityPage` now keeps
  runs from those pages too.
- **Rationale**: FR-022 asks for exactly this mechanism ("like feature 008's
  one-time re-read"); no new job, no burst.
- **Alternatives**: A separate run backfill: a second paging job with the same
  budget logic.

## R13 Personal badges in the evaluation batch

- **Decision**: `applyAndEvaluate` (and the team-event and correction variants,
  which share `readRiders` and `riderWrites`) also reads the rider's runs,
  stored badges and `badges_version`, works out the personal badges with the
  pure `evaluateBadges` from the evaluation it already has, and writes only the
  badges that appeared, disappeared or changed date (`rider_badges`), in the
  same batch as the Rynke. It returns the badges that are new compared with the
  state before the change, next to `rose`.
- **Rationale**: Badges then follow every input change exactly like the Rynke:
  idempotent (FR-030), taken back when the ride stops counting (US2), deleted
  with the rider, and in one batch, so the page never shows a badge for Rynke
  it doesn't show. Storing them gives the notification something to name and
  the page a cheap read.
- **Alternatives**: Working personal badges out on every page view: the page
  would need every activity of the rider, and notifications would have to
  recompute the "before" state.

## R14 The date a badge was earned

- **Decision**: Each category's value is built from dated contributions in
  date order: counting rides by local start date (distance, elevation), runs by
  local start date (longest run, running total), attended events by event date
  (team events, technique trainings). Training Rynke by date comes from
  re-tallying the rider's dated inputs per day with feature 003's own `tally`
  (rides of that day and before, the season elevation total floored once,
  attendance and corrections by date), the way `rynke/weeks.ts` does per week.
  A badge's date is the first date whose running value reaches the threshold;
  several thresholds crossed the same day share it (spec edge case).
- **Rationale**: FR-013 asks for the date of the activity, event or correction
  that first reached the threshold; re-using `tally` keeps the Training Rynke
  rule in one place, including the elevation step on the season total.
- **Alternatives**: Storing a cumulative Rynke history: a second source of truth
  for what `tally` already computes.

## R15 Team badges per request, not stored

- **Decision**: The Overview reads daily team sums in one batch, limited to
  014's listed riders inside SQL like the Team page (`LISTED_RIDER_IDS`):
  counting ride distance, elevation and Training Rynke inputs per day, run
  distance per day, and per team event its listed attendees. The pure
  `evaluateTeamBadges` turns them into earned team badges with dates and the
  progress per team category. Nothing is stored.
- **Rationale**: Team badges depend on every listed rider. Worked out on read,
  they follow consents, departures, corrections and rule changes with no extra
  job, can be taken back (spec edge case) and never reveal who contributed
  (FR-032): only sums leave SQL. About 40 riders keep the read small, and the
  Team page already does the same per request.
- **Alternatives**: A stored `team_badges` table refreshed after each
  evaluation and on consent changes and departures: many triggers to forget.

## R16 Reveals

- **Decision**: `badge_reveals` holds, per rider, each badge already revealed to
  them with the date it had then. On a GET of the Overview, every earned badge
  (personal stored, team computed) without a reveal row, or with an earlier
  earned date, is new: the page shows one reveal for all of them (FR-031) and
  writes their reveal rows, like `rynke_seen`. Silent cases insert reveal rows
  where the badge appears instead: an evaluation under new rules or a new badge
  catalog (FR-031, R18). A team badge earned before the rider connected is shown
  without a reveal (US4 scenario 5).
- **Rationale**: One mechanism covers "new since your last visit", imports (one
  reveal of everything, FR-031), re-earning on a later date (spec edge case) and
  team badges.
- **Alternatives**: A "seen up to date" marker: can't tell a taken-back-and-
  re-earned badge from an old one.

## R17 Notifications name the new badge

- **Decision**: When an evaluation brings new personal badges, the batch writes
  `badge_rises` (rider, the new badge ids, time), like `rynke_rises`. The
  callers that notify on a Rynke rise today (activity events, team-event and
  correction changes; feature 010 "Which changes notify") notify when Rynke rose
  or a badge is new; imports, re-reads and recalculations don't. The
  notification text (`/me/notification-text`) names the newest badge when its
  rise is the latest ("Neues Abzeichen: Wochenend-Krieger 🏅"), else says the
  Rynke as today.
- **Rationale**: FR-031 wants the badge named in that evaluation's
  notification, and runs give badges without any Rynke, so a badge alone must
  be able to notify. Team badges never notify (FR-032).
- **Amendment (issue #125)**: team badges notify too. They are still worked
  out on read (R15); after each change that notifies, `teamBadgeNews`
  (`src/work/team-badge-news.ts`) works them out once more and compares them
  with `team_badge_notices`, the badge ids already announced this season. Each
  new one is announced once per season (taking a badge back and earning it
  again doesn't notify twice) and written as a badge rise of every listed rider
  it is new to by R16's rule: earned on or after the day they connected and not
  yet revealed. The very first check stores what the team has without
  notifying, so deploying doesn't announce every badge so far; a later season
  starts with none announced. The announced ids and the rises are written in
  one batch. The rise replaces the rider's last one, except that it joins the
  same change's personal badges. Only sums are read and every listed rider
  gets the same news, so nothing tells who contributed. A change that doesn't
  notify (imports, consents, departures, edits that leave the figures alone)
  is caught by the next check.
- **Alternatives**: Adding columns to `rynke_rises`: mixes two kinds of rise in
  one row with different write rules.

## R18 The catalog, its version, and the art list

- **Decision**: `src/badges/catalog.ts` holds the 13 categories (id, group,
  unit, how the value is read, ladder) and derives the 69 badge ids
  (`distance-100`, `run-length-half`, …), with `BADGE_CATALOG_VERSION`. Riders
  store the version their badges were worked out with (`riders.badges_version`);
  the daily cron sends an evaluation for riders on an older one, which awards
  or takes back silently (FR-012). A test asserts the catalog and
  `art/badges/badges.json` list the same ids, groups, categories and thresholds
  (part A T019).
- **Rationale**: Changing a ladder is a release (FR-012); the version makes the
  re-evaluation happen without anyone remembering it, the same way
  `figures_version` works.
- **Alternatives**: The app reading `badges.json`: it would carry every scene
  into the bundle.

## R19 The section: server-rendered, Popover API, ribbon text in HTML

- **Decision**: `src/http/sections/badges.ts` renders the drafts' layout from
  the pure view model (`src/badges/view.ts`): cards and the gallery as plain
  HTML; the gallery is a `<details>` closed by default; each earned badge is a
  `<button popovertarget>` that opens a `popover` with the 280 px badge, its
  name, what it was for and the date; `public/app.js` also opens it on
  `pointerenter` for mouse pointers, floating beside the mouse and following
  it, and closes it on `pointerleave`. The badge
  image is `<img loading="lazy" alt="">` (`<id>.svg`, the group's placeholder
  when `BADGE_PICTURES` lacks the id; on cards and in the popover with the
  ribbon drawn over it as inline SVG, issue #180); the milestone is an HTML `<span>` placed over
  the ribbon with `src/badges/ribbon.ts`'s box in percent and its colour per
  group. A test keeps that box equal to `RIBBON` in `scripts/badge-frame.mjs`.
  Progress bars are `<meter>`-like markup with the value as text (FR-042).
- **Rationale**: Tap, keyboard and screen readers work natively (popover and
  button; `<details>`); the hover is a progressive enhancement. The page refers
  only to earned badges, so unearned names and pictures never reach the browser
  (SC-003); the milestone stays translatable and crisp (FR-040b).
- **Alternatives**: A JavaScript carousel for the large view: more code for no
  gain at this size. CSS-only `:hover`/`:focus` previews: no reliable close on
  touch.

## R20 German-only badge names beside the catalogs

- **Decision**: `src/i18n/messages/badges.de.ts` exports `BADGE_NAMES:
  Record<BadgeId, string>`, German, used in every app language; everything else
  (category names, what a badge was for, milestones and units, headings, the
  explanation line, the empty state, the notification text) gets catalog keys
  in `de.ts` and `en.ts`. The no-hard-coded-copy test treats the names file like
  `quotes.de.ts`.
- **Rationale**: FR-041 and the project owner's decision; the catalogs keep
  their rule that every locale has the same keys.
- **Alternatives**: Names as catalog keys with the German text copied into
  `en.ts`: suggests a translation that must never happen.

## R21 Sample data for `pnpm dev`

- **Decision**: The fake Strava's synthetic riders get outdoor and indoor runs,
  a manual run, team events with many attendees and technique trainings, so the
  sample riders show: no badge, a few badges, a full category, team badges, a
  badge earned just now (reveal) and every placeholder.
- **Rationale**: The section must be checkable locally at 360 px in both colour
  modes (SC-005) without real data (Principle I).
- **Alternatives**: none worth keeping.

## R22 Consent wording without a new version

- **Decision**: `consent.short.read` and the details name runs ("deine Rad- und
  Laufaktivitäten") and that kilometres and elevation count towards team sums
  without names; `CONSENT_VERSIONS` stays at version 1, and `src/consent.ts`'s
  comment gains feature 013 next to 008 and 010.
- **Rationale**: FR-023 and the project owner's decision: the app already
  receives runs with every read, keeps them for the rider's own badges and
  shows others only team sums (constitution v2.1.0).
- **Alternatives**: Version 2 and asking every rider again: rejected by the
  project owner.

# Part C: more categories (2026-10-12)

## R23 Ride length, virtual rides and winter from the counting rides

- **Decision**: `figuresOf` in `rynke/apply.ts` already builds the rider's
  counting rides for the badges from feature 003's evaluation; each
  `CountingRide` gains `virtual`, taken from the evaluation result's
  `isVirtual` (003 FR-013a, `rynke/rides.ts`). `evaluateBadges` then works out
  ride length (the longest counting ride so far, like run length), virtual
  rides (cumulative kilometres of virtual counting rides) and the four winter
  categories (days with at least one non-virtual counting ride in that month)
  from the same list.
- **Rationale**: One definition of "counting" and of "virtual" for Rynke and
  badges: an excluded, overlapping or private ride drops out of these
  categories exactly as it drops out of Distance, and is taken back the same
  way (US2). An unknown trainer flag makes only a `VirtualRide` virtual, as in
  003, so older rows never lose a winter day.
- **Alternatives**: Reading `activities` directly for these categories: a
  second set of ride rules, and rides that earn no Rynke would earn badges.

## R24 Winter days by the ride's local start date

- **Decision**: A ride's winter day is the first 10 characters of its
  `start_date_local`, the date every badge uses (FR-013, R14); the month is
  characters 6 and 7. Several rides on one date count once. The spec's
  scenario 8 and FR-010 were aligned to this (they first said Berlin time).
- **Rationale**: The riders ride around Hamburg, where local time is Berlin
  time; on a training camp abroad the rider's own calendar day is the natural
  one. A second date rule would let a badge's date differ from the day shown
  for the ride.
- **Alternatives**: Converting `start_date` to Europe/Berlin: an extra rule for
  no gain; counting rides instead of days: rejected by the project owner
  (splitting a ride would earn badges).

## R25 A winter month that is over

- **Decision**: The catalog gives each winter category its month (11, 12, 1,
  2). The season's month falls in the year of `SEASON_START_DATE` for
  November and December and the year after for January and February (the
  season starts on 1 September, spec Assumptions). `buildBadgeSection` gets
  `today` (`berlinDate(now)`, as the section already uses for `connectedOn`)
  and drops a winter category's progress once `today` is past the last day of
  its month, so its card shows no bar (FR-004a); an earned card stays, a card
  without a badge keeps its outline. The evaluation stays a pure function of
  stored data (FR-030): only the view looks at the clock.
- **Rationale**: Keeps the "never moving bar" out of the page without a
  stored flag or a cron job; a later correction still changes the month's
  value and badges (spec edge case).
- **Alternatives**: A `closed` flag written by the daily cron: state for what
  is a pure function of the date.

## R26 Swims in a table of their own

- **Decision**: A new `swims` table with exactly `runs`' columns, and
  `toSwimRecord` in `strava/activity.ts`: an activity is kept when its sport
  type is `Swim` and its `manual` flag isn't true. The trainer flag is ignored
  (a pool swim covers its distance). Intake follows runs everywhere: the
  webhook (`work/activity-event.ts`) and list pages (`work/activity-page.ts`)
  pass `swims` in the `upsert` change; `delete` and `delete-private` remove
  swims as they remove runs; `readRiders` reads them into `RiderState.swims`.
  A change that touches only swims leaves `figuresChanged` false, so team
  badges are never re-announced for a swim.
- **Rationale**: The same reasoning as R10 and R11: no Rynke code, ride list
  or team sum can see a swim (FR-025, SC-004), and nothing is kept that no
  badge uses (Principle I).
- **Alternatives**: One `other_activities` table with a sport column: every
  reader would need the filter R10 avoided.

## R27 Existing riders' swims and the new categories

- **Decision**: Raise `ACTIVITY_FIGURES_VERSION` from 4 to 5 (the daily cron
  re-reads every rider once, within the Strava budget, and the pages now keep
  swims, R12) and `BADGE_CATALOG_VERSION` from 1 to 2 (the daily cron
  re-evaluates every rider once, R18). Both award silently and reveal together
  (FR-031).
- **Rationale**: FR-022 and FR-012 ask for exactly these mechanisms; ride
  length, virtual rides and winter need only the re-evaluation, swims need the
  re-read.
- **Alternatives**: A swim backfill job: a second paging job with the same
  budget logic.

## R28 Catalog: eight categories, ids, units and decimals

- **Decision**: `BADGE_CATEGORIES` gains, after `running` and before the team
  ones: `ride_length` (km), `virtual_rides` (km), `swim_length` (km),
  `swimming` (km), `winter_november`, `winter_december`, `winter_january`,
  `winter_february` (new unit `days`), with the spec's ladders: 21 categories,
  101 badges. Swim length's thresholds are in km (0.5, 1, 1.9, 3.8) but its ids
  are in metres (`swim-length-500`, `-1000`, `-1900`, `-3800`) through
  `NAMED_THRESHOLDS`, since ids allow no dot (`scripts/badge-prompts.mjs`). The
  ids equal `art/badges/badges.json`, which already lists them (part C's art
  commit). Run length, swim length and swimming show one decimal
  (`shownMissing`, the ribbon and the gallery); the rest whole units.
- **Rationale**: The catalog test keeps app and art equal (R18); one id
  scheme per category keeps the art files and `BADGE_PICTURES` stable.
- **Alternatives**: Swim length in metres as its unit: the spec shows
  kilometres like the other distances.

## R29 The Overview's figures for the new categories

- **Decision**: `readRiderBadges` (`db/badges.ts`) adds, in its one batch:
  `max(a.distance_m)` over counting rides and `sum(a.distance_m)` over
  counting rides with `r.is_virtual = 1` (from `ride_results` joined with
  `activities`, as Distance); per winter month the number of distinct
  `substr(a.start_date_local, 1, 10)` of counting rides with `r.is_virtual =
  0`; and `max`/`sum` of `swims.distance_m` in the counting window, like runs.
  `PersonalFigures` and `personalProgress` gain the same values.
- **Rationale**: The section keeps reading stored figures instead of
  re-evaluating every ride (R13), with no extra round trip.
- **Alternatives**: Storing per-category values: a second copy of what the
  results already hold.

## R30 Consent wording names swims, still version 1

- **Decision**: `consent.short.read` and the details name swims next to rides
  and runs ("deine Rad-, Lauf- und Schwimmaktivitäten"); `CONSENT_VERSIONS`
  stays at 1. Swims count towards no team sum, so the team wording is
  unchanged.
- **Rationale**: The same decision as R22 (spec Clarifications, FR-023): the
  app already receives swims with every read and keeps them only for the
  rider's own badges.
- **Alternatives**: A new consent version: rejected for runs by the project
  owner, and swims are shown to no one else.

## R31 Sample data and pictures

- **Decision**: The fake Strava's sample riders get a ride over 300 km,
  virtual rides, outdoor and virtual rides on several days in November to
  February (two on one day), pool, open-water and manual swims. Until the
  project owner generates the 32 new pictures (`pnpm badge-art`, then
  `pnpm badge-build`), the new badges show the placeholder (FR-040a); the app
  needs no change when they arrive.
- **Rationale**: Every new category must be checkable locally (SC-005) without
  waiting for the art.
- **Alternatives**: none worth keeping.

# Part D: surprise badges (2026-10-12)

## R32 One category, six named badges

- **Decision**: `surprise` is one personal category in the catalog with
  `ladder: [1, 2, 3, 4, 5, 6]` only to order its badges, marked `surprise:
  true`, and `NAMED_THRESHOLDS` giving the ids `surprise-new-year`,
  `-christmas-eve`, `-christmas`, `-night-owl`, `-early-bird`, `-rest-day`
  (the ids already in `art/badges/badges.json`). `BADGE_CATALOG_VERSION`
  becomes 3, so every rider is re-evaluated once, silently (R18).
- **Rationale**: The catalog, the art list and the catalog test keep one shape;
  ids stay stable for the pictures; the section's gallery already shows one
  outline per badge still to earn (issue #109), which is exactly "riders know
  they exist".
- **Alternatives**: Six categories of one badge each: six cards of "?" instead
  of one; a separate surprise list outside the catalog: a second id scheme.

## R33 Surprise rules in the pure evaluation

- **Decision**: `evaluateBadges` works the surprise badges out from its
  inputs, apart from the threshold series: each rule finds the first date of
  the season that meets it (FR-013). `CountingRide` gains `startTime`
  (`HH:MM`, characters 12 to 16 of `start_date_local`); runs and swims add
  their dates to the activity days. Holidays look at the date's `MM-DD`;
  night owl and early bird at counting rides' `startTime` (`>= "21:30"`,
  `< "06:00"`); the rest day is the first date D with no activity, an
  activity on each of the seven dates before it and one on a date after it.
  The surprise category's progress is `{ value: earned count, next: null }`,
  so no bar ever shows (FR-015).
- **Rationale**: Pure and idempotent like every other badge (FR-030); taken
  back when its activity goes (US2); no clock needed, because the later
  activity is what proves the rest day is over (spec Clarifications).
- **Alternatives**: The daily cron awarding rest days at midnight: a clock in
  the evaluation and a second award path.

## R34 "?" until earned, why once earned

- **Decision**: `badges.about.surprise` is "?" in every language, so card and
  gallery show only "?" (FR-015b). Each surprise badge gets a ribbon text
  `badges.surprise.<name>` ("Neujahr", "Heiligabend", "Weihnachten",
  "Nachteule", "Frühaufsteher", "Ruhetag") and a why-text
  `badges.surprise.<name>.for` for its large view, used instead of the
  category's `badges.for.*`. Both reach the page only for earned badges, like
  names and pictures (SC-003).
- **Rationale**: The surprise holds in the HTML; the text stays translatable
  (FR-041 keeps only names German-only).
- **Alternatives**: Showing the German name on the ribbon: names are not
  translated, ribbons are.

## R35 The surprise card

- **Decision**: In `groupView` the surprise card shows the newest earned
  surprise badge (by `earnedOn`, then catalog order) instead of the highest,
  never with progress; without one it is an outline card without a bar
  (`NotYetRow.progress` null, as for a winter month that is over). The
  gallery lists earned surprise badges newest first, then one outline per
  badge still to earn.
- **Rationale**: For single badges "highest" means nothing; the newest is the
  one worth showing.
- **Alternatives**: none worth keeping.

## R36 The Overview's figures

- **Decision**: Nothing new to read: the surprise card needs only the stored
  earned badges (`rider_badges`); its progress comes from their count.
- **Rationale**: The rules need every activity's date and time, which only the
  evaluation batch has; the page shows no bar for them.
- **Alternatives**: none.

## R37 Samples and art

- **Decision**: Wanda Winter (R31) gains a ride at 22:00 on 24 December
  (Christmas Eve and night owl) and one at 5:30 on 1 January (New Year and
  early bird); a new streak of seven daily activities with a day off and an
  activity after it gives a sample rider the rest day badge. The six art
  scenes are already in `art/badges/badges.json`, each with its own gag
  (FR-015c; the shared `surprise` snippet was removed in part F).
- **Rationale**: Every surprise badge checkable locally (SC-005).
- **Alternatives**: none.

# Part E: team surprise badges (2026-10-12)

## R38 Same shape as the personal surprises

- **Decision**: `team_surprise`, a team category with `surprise: true`,
  ladder 1 to 6 and named ids `team-surprise-day-off`, `-all-out`,
  `-round-the-clock`, `-relay`, `-new-years-eve`, `-sunday-outing` (already in
  `art/badges/badges.json`); `BADGE_CATALOG_VERSION` 4. `surpriseName` works
  for every category marked `surprise`, so the view (newest on the card, no
  bar) and the section ("?", ribbon and why-text keys
  `badges.surprise.<name>`) need no new branch.
- **Rationale**: One mechanism for both groups.
- **Alternatives**: none worth keeping.

## R39 What the team sums add

- **Decision**: `readTeamBadgeSums` adds two reads to its batch, over listed
  riders only: per rider, local date and start hour of every counting ride,
  outdoor run and swim (`SELECT DISTINCT athlete_id, date, hour`), and each listed
  rider's connection date (`berlinDate(connected_at)`). `TeamBadgeSums` gains
  `active` (date → rider count and the set of start hours, with rider ids
  only to count distinct riders and test "everyone"; never leaving the pure
  function) and `connectedOn` (the listed riders' connection dates). Team
  event dates already come with `events`.
- **Rationale**: Enough for all six rules, nothing per rider reaches the view
  (FR-016a). Swims count like runs (project owner, 2026-10-12): only their
  date and hour, never their figures (FR-025). A change that touches only
  swims therefore sets `figuresChanged` again, so `teamBadgeNews` (#125) can
  announce a team surprise a swim completed (this reverses R26's rule).
- **Alternatives**: Per-day counts in SQL only: "everyone connected by then"
  needs the rider ids per day.

## R40 The rules

- **Decision**: In `team.ts`, each rule the first date that meets it, within
  the counting window: day off, the first date after the team's first active
  date and before its last one without an active rider; all out, a date whose
  active riders include every listed rider connected on or before it, at
  least two; round the clock, a date with 24 distinct start hours; relay, the
  30th of 30 consecutive active dates; New Year's Eve, 12-31 with at least
  five riders; Sunday outing, a Sunday (UTC weekday of the date) with at least
  ten riders and no team event that day. Progress `{ next: null }`.
- **Rationale**: Pure and recomputed on every request, like every team badge
  (R15): consent changes and departures follow; notifications come through
  `teamBadgeNews` (#125) unchanged.
- **Alternatives**: none.

## R41 Samples

- **Decision**: The fake Strava's listed riders already ride on most recent
  days; tests cover each rule with synthetic riders. No sample change is
  needed beyond what earns at least one team surprise on its own.
- **Rationale**: Six riders can't make a realistic Sunday outing of ten.
- **Alternatives**: none.


# Part F: surprise badges from cycling traditions (2026-10-14)

## R42 Longer ladders, same categories

- **Decision**: `surprise` gets `ladder: [1, …, 13]`, `team_surprise`
  `[1, …, 7]`. `NAMED_THRESHOLDS` adds `surprise` 7 `festive-500`, 8
  `stage-rider`, 9 `triathlon`, 10 `pi-day`, 11 `solstice`, 12 `easter`, 13
  `everesting`, and `team_surprise` 7 `festive-team`, giving the ids
  `surprise-festive-500` … `surprise-everesting` and
  `team-surprise-festive-team`. `BADGE_CATALOG_VERSION` becomes 5, so every
  rider is re-evaluated once, silently (R18): badges the new rules award for
  past dates appear without a celebration (FR-017b).
- **Rationale**: Parts D and E made everything downstream (card, gallery
  outlines, "?", ribbon and why-text keys, notifications, `teamBadgeNews`)
  follow the catalog; appending keeps the existing ids and their order.
- **Alternatives**: A third surprise category "Traditionen": a new card
  and heading for what riders should only discover; rejected with the spec.

## R43 The personal rules

- **Decision**: In `surpriseBadges`, each rule finds the first date of the
  counting window that meets it (FR-013), from the inputs it already gets:

  | Badge | Rule (rides = counting rides in the window) |
  |-------|---------------------------------------------|
  | Festive 500 | rides dated `MM-DD` 12-24 to 12-31 in date order; the date their running sum reaches 500 km |
  | Etappenfahrer | per date, the sum of rides' km; the third of the first three consecutive dates each ≥ 100 km |
  | Dreikampf | the first date with a ride, a run and a swim |
  | Kreiszahl | the first ride on 03-14 with `distanceM >= 31400` |
  | Sonnenwende | the first non-virtual ride on 12-21 and the first on 06-21; dated with the later of the two (21 June in a season from September) |
  | Osterhase | the first activity day equal to Easter Sunday or the day after it, for the date's year |
  | Everesting | per `YYYY-MM`, rides in date order; the first date a month's running elevation reaches 8,848 m |

  Distances compare in metres and elevation in decimetres
  (`elevationDm >= 88480`), so no rounding decides a badge. Sums add whole
  days at once, so a badge is dated with the day whose rides reach the mark.
- **Rationale**: Pure and idempotent like the rest of part D (R33); a
  deleted ride takes a badge back on the next evaluation (US2). All seven
  only read dates, distances, elevation and the virtual flag, which
  `CountingRide` already carries (R23, R33).
- **Alternatives**: A single 100 km ride per Etappenfahrer day: rejected in
  the spec's Clarifications; Everesting in one ride: too rare to be fun for
  the team (spec).

## R44 Easter

- **Decision**: `src/badges/easter.ts` exports `easterSunday(year: number):
  string` (`YYYY-MM-DD`), the anonymous Gregorian algorithm (Meeus/Jones/
  Butcher), integer arithmetic only. Osterhase compares each activity day
  with `easterSunday(year)` and its day after (`shift(…, 1)`).
- **Rationale**: Fifteen lines, no dependency (Principle IV), checkable
  against known dates (2026-04-05, 2027-03-28, 2028-04-16, 2030-04-21).
- **Alternatives**: A table of dates: runs out and needs maintenance.

## R45 Festive Team

- **Decision**: `TeamActivity` gains `ride: boolean`; part E's read in
  `readTeamBadgeSums` adds `1 AS ride` to the counting-ride branch and `0` to
  runs and swims, and keeps `DISTINCT` over all four columns. In `team.ts`:
  for the December inside the counting window, the riders due are the listed
  riders with `connectedOn <= YYYY-12-24`; with at least two of them, each
  needs a `ride` activity dated 12-24 to 12-31; the badge is dated with the
  latest of their first such dates. A rider connecting later is not due, so
  doesn't take it back (spec Clarifications).
- **Rationale**: One bit more in an existing read, nothing per rider leaves
  the pure function (FR-016a, FR-017a); the existing rules ignore `ride`,
  so they stay as they are.
- **Alternatives**: A second read of counting-ride dates only: one more
  statement for what one column gives.

## R46 Text and names

- **Decision**: Ribbon texts and why-texts as in
  [contracts/badge-messages.md](contracts/badge-messages.md), in `de.ts` and
  `en.ts`; German-only names in `badges.de.ts` (FR-041), drafts the project
  owner confirms. The why-texts name the rule after the fact, which is
  allowed once earned (FR-015b).
- **Rationale**: As R34.
- **Alternatives**: none.

## R47 Art

- **Decision**: Eight new entries in `art/badges/badges.json` with the shared
  `{{bike}}` snippet (and `{{team}}` for the team badge); each scene carries
  its own over-the-top gag (FR-015c). The shared `surprise` snippet, a
  generic "make it EXTRA fun" sentence, is removed from every surprise scene
  of parts D to F and from the snippets: the project owner found it made the
  pictures less fun. Scenes as in `badges.json`; the catalog test keeps
  `badges.json` and the catalog equal. Until `pnpm badge-art` and `pnpm
  badge-build` have run, the placeholder shows (FR-040a).
- **Rationale**: The art pipeline is unchanged (part A).
- **Alternatives**: none.

## R48 Samples

- **Decision**: A new sample rider, "Fritz Festtag", earns all seven
  personal surprises on the fake Strava: 520 km between 24 and 31 December
  (two of them Zwift rides), three 100 km days in a row (one of them in two
  rides), a ride, a run and a swim on one day, a 32 km ride on 14 March,
  outdoor rides on 21 December and 21 June, a ride on Easter Monday, and
  9,000 m of climbing in May. As for Wanda Winter, rides dated after today
  count only once their day has passed, so the test checks the five whose
  days lie before the test clock's 6 October 2026. `ride()` gains an option `onEaster`
  that places a ride relative to the season's Easter Sunday, computed with
  `easterSunday` (dev may import `src/`, not the reverse). Festive Team is
  covered by tests with synthetic riders, like R41.
- **Rationale**: Every new personal badge checkable locally in one place
  without changing other samples' states.
- **Alternatives**: Adding them to Wanda Winter: her state would no longer
  describe her.

## R49 Winterschlaf beendet (part J)

- **Decision**: A 14th personal surprise badge, id `surprise-winter-sleep`,
  name "Winterschlaf beendet": the earliest outdoor counting ride dated on
  or after 1 January of the year after `seasonStart`'s year, from the
  counting rides the other surprise rules see. Catalog version 8. One more
  scene in `art/badges/badges.json`; the placeholder shows until the
  project owner has made the picture (FR-040a).
- **Rationale**: "New year" means the calendar year after the season start,
  which for the team's September season is exactly the January after it.
  A season from 1 January (the test and sample season) would otherwise give
  the badge for the first ride of the season, which is what the badge is
  meant not to be. Outdoor only, like Sonnenwende and the winter months:
  a Zwift ride ends no hibernation.
- **Alternatives**: Rides from January to August by month: the same for a
  September season, but wrong for a season starting at another month.

## R50 15 km and Pi-Run (part K)

- **Decision**: Run length's ladder becomes 5, 10, 15, 21.0975, 31.4,
  42.195. 31.4 km is a named step, id `run-length-pi-run`, ribbon and name
  "Pi-Run" in German and English (`badges.value.piRun`); 15 km is a numbered
  one, `run-length-15`, name "Fünfzehner" (a draft, like the other names).
  Catalog version 9, so the daily cron gives riders who already ran that far
  the new badges, dated with the run. Two more scenes in
  `art/badges/badges.json`; the placeholder shows until the project owner has
  made the pictures (FR-040a).
- **Rationale**: 31.4 km is π × 10, the distance Kreiszahl already uses, so
  the two pi badges agree. It is a distance step, not a surprise: a run of
  that length on any date earns it. Ids have no dot, hence the name.
- **Alternatives**: A 30 km step as well: almost the same badge as the
  Pi-Run, one long run would earn both. A surprise badge for the Pi-Run:
  keeps the ladder plain, but the project owner wanted it on the ladder.
  Counting runs for Kreiszahl: a different badge, on one date only.
