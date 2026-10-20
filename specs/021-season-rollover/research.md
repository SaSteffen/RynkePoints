# Research: Season Rollover – Feasibility, Tooling and Design

**Feature**: [spec.md](spec.md) · **Date**: 2026-10-20

The spec makes the albums on the maintainer's computer (Phase 1). This research
answers whether the albums could instead be made in the app's Cloudflare account
and downloaded by riders themselves (Phase 3), within the free tier (constitution
Principle IV). Limits were read from Cloudflare's documentation on 2026-10-20 and
change over time; re-check them when Phase 3 is planned.

## R1 – How large and how slow is an album?

A test album was rendered with headless Chromium (Playwright 1.56, the engine the
repo's e2e tests already use) from an HTML page with A4 print CSS: two summary
pages and 11 sticker pages with 12 slots each, all 121 badge pictures of
`public/badges/` (traced SVG, 20.5 MB uncompressed, 4.4 MB gzipped), stickers
rotated and moved as FR-036 asks.

| Album | Pages | Render time (laptop-class VM) | PDF size |
|-------|-------|-------------------------------|----------|
| Every badge earned (worst case) | 13 | 6 s | 11.7 MB |
| Half the badges earned (typical) | 13 | 3 s | 6.4 MB |

The pictures stay vectors in the PDF, so the size grows with the earned badges'
path complexity, not with resolution. The largest pictures (e.g.
`big-training-30.svg`, 0.9 MB) dominate; simplifying the few heaviest traces would
shrink every album.

**Print check (2026-10-20)**: a first run used a CSS `drop-shadow` filter per
sticker. Chromium then turned every sticker into a 638 × 638 px image (about
320 dpi at 50 mm, 17.4 MB, twice as slow). Without the filter the PDF holds no
image at all: every badge, placeholder and text stays vector (checked with
pypdf). Rotation, offsets, opacity and CSS `box-shadow` all stay vector. Hence
FR-054: no filters; shadows as vector shapes. With `@page { size: 210mm 297mm }`
and `preferCSSPageSize`, Chromium writes pages of 594.96 × 841.92 pt, 0.1 mm
from exact A4 (595.28 × 841.89 pt), well inside FR-050. The app has no font of
its own (system fonts), so the album needs a font file of its own (FR-055).

**Decision**: Phase 1 renders the album as an HTML page and prints it to PDF with
headless Chromium on the maintainer's computer. 60 riders take about 5 minutes
(FR-027). **Rationale**: Playwright is already a dev dependency; the same HTML page
is the only place the layout lives, for Phase 1 and Phase 3 (R7). **Alternatives**: a PDF library writing pages
directly (more code for the sticker layout, and the SVG pictures would need
converting).

Generation never runs in Cloudflare (owner, 2026-10-20); R2 to R5 below are kept
as the record of the feasibility question.

## R2 – A PDF library inside a Worker

Workers Free gives **10 ms CPU time per HTTP request** and per cron trigger, and
128 MB memory per isolate. Laying out 13 pages and embedding several MB of vector
paths takes seconds of CPU, not milliseconds.

**Decision**: Not feasible on Workers Free. On Workers Paid ($5/month, CPU limit
configurable up to minutes) it would be possible, but breaks the free-tier rule
without a documented need.

## R3 – Cloudflare Browser Rendering ("Browser Run")

The Worker hands the album's HTML to a headless browser in Cloudflare and gets a
PDF back (binding or `/pdf` quick action, which accepts HTML, A4 and background
printing; request bodies up to 50 MB). Waiting for the browser is I/O, not the
Worker's CPU.

Workers Free limits: **10 minutes browser time per day**, 3 concurrent browsers,
one new browser every 20 s, **60 s browser timeout**, quick actions one request
per 10 s. Workers Paid includes 10 browser hours per month, then $0.09 per hour.

With R1's times (6–14 s per album, likely slower in a shared cloud browser), one
day's budget makes roughly 40–100 albums: enough for a 60-rider team if riders
download on demand and not all on the same day, but with no margin for retries,
re-downloads or a heavier catalog. A 13-page album also needs to stay well under
the 60 s timeout.

**Decision**: Feasible on paper, fragile in practice. Keep as fallback for Phase 3.

## R4 – Where would a made album be kept?

- **D1**: at most 2 MB per row or blob; an album is 9–17 MB. Not usable without
  splitting files, which is not worth it.
- **R2**: 10 GB-month storage free, 1 million writes and 10 million reads per
  month, no egress fees; 60 albums of 17 MB are about 1 GB. Fits easily.
  Enabling R2 in the dashboard asks for a payment method (to be confirmed when
  Phase 3 is planned); Cloudflare's pricing page does not say. It is also a new
  store of personal data in the cloud, which the privacy page must name and which
  must be deleted with the rider (feature 001 FR-022).
- **Not stored at all**: render on each download and stream it out (R3) –
  costs browser time on every download.
- **Static assets**: never. Assets are public, and albums are personal data.

## R5 – Let the rider's own browser make the PDF

The app serves the album as a page for the signed-in rider, built from the same
HTML and print CSS as Phase 1 (R1), with a button "Als PDF speichern" that opens
the browser's print dialog (`window.print()`); the rider saves it as PDF or prints
it directly. The badge pictures are the app's existing static assets.

- Costs: one ordinary page view (a few D1 reads), no CPU-heavy work in the
  Worker, no browser time, no storage, no copy of personal data on the
  maintainer's computer.
- Phones: iOS Safari and Android Chrome can both save a printed page as PDF; the
  layout follows each browser's print engine, so the sticker pages need a test in
  all three engines (the e2e setup already runs Chromium, Firefox and WebKit).
- The page can show the album at any time of the season, not only in August
  (a product decision for Phase 3).
- The repo already prints a document to PDF from HTML (`docs/print.css`,
  `public/rynke-punkte.pdf`).

**Recommendation**: R5. It fits the free tier with room to
spare and removes the maintainer's manual step and the local copy of the data.
**Alternatives**: R3 with R2 storage as a fallback if print layouts differ too much
between browsers; Workers Paid if the team ever decides the $5/month is worth it.

## R6 – Consequence for Phase 1

Build the album as an HTML page with A4 print CSS (one page template, the sticker
layout of FR-036 computed deterministically per rider and badge, FR-026), and let
the Phase 1 command render that page to PDF with headless Chromium against data
read from production. Phase 3 keeps the same command and adds the upload to R2
(R7). R5's in-browser printing is not pursued: one print engine gives every rider
the same print-ready file (FR-050 to FR-057).

## R7 – Owner's decision (2026-10-20)

Phase 3 builds the albums locally, as Phase 1 does, and the command then uploads
them to R2; riders download their own album from the app. This keeps the PDF's
look identical for every rider (one print engine, not three) and costs no browser
time in Cloudflare. What Phase 3 needs, from R4:

- R2 enabled on the account (check whether it asks for a payment method; the free
  tier itself costs nothing at this size: about 1 GB for 60 albums).
- An upload credential on the maintainer's computer only, never in the repo or in
  the Worker's secrets beyond read access.
- A download route that serves a rider only their own album, streamed from R2
  (no egress fees, no Worker CPU spent on the PDF).
- Deletion: an album goes when its rider leaves (feature 001 FR-022) and after a
  retention period the Phase 3 spec sets; the privacy page names R2 as a store.
- The local folder can then be emptied automatically after a successful upload.

Phase 1 builds locally only and uploads nothing (spec FR-020).

## R8 – Which tools build the PDF (owner open to Python or Node, 2026-10-20)

| Option | For | Against |
|--------|-----|---------|
| **Node + TypeScript + Playwright** (HTML page, print to PDF) | Same language and repo tooling as the app (pnpm, Biome, tsc, Vitest); Playwright is already a dev dependency and its Chromium already installed for e2e; can import the app's own badge catalog (`src/badges/catalog.ts`), badge evaluation, i18n catalogs and coin/badge SVGs directly, so album and app can't disagree; the same HTML page serves Phase 3 later; CSS grid and transforms make the sticker layout a few lines; SVGs stay vectors (R1) | Needs a headless Chromium on the maintainer's computer (one `pnpm exec playwright install chromium`) |
| Python + WeasyPrint | Good print CSS (`@page`), no browser | Second language and toolchain in the repo; would re-implement the catalog, badge rules and i18n in Python or read them through an export; weaker SVG and CSS transform support |
| Python + ReportLab / Node + pdf-lib (draw pages directly) | No browser | Sticker layout, text wrapping and SVG embedding by hand; much more code |

**Decision**: Node + TypeScript + Playwright, as in the R1 test. **Rationale**:
the easiest libraries are the ones the repo already has, and reusing the app's
own code for badges and figures is what keeps the album's numbers equal to the
app's (SC-003). It stays a script under `scripts/`, outside `src/`, so nothing
reaches the Worker bundle; reading production data goes through `wrangler d1
execute --remote` (read-only SQL) or a `wrangler d1 export`, run by the maintainer
(CLAUDE.md manual steps). Details belong to `/speckit-plan`.

## R9 – Tour de Paris as a kind that earns nothing

**Decision**: `src/rynke/team-events.ts` gets `EVENT_KINDS = [...TEAM_EVENT_KINDS,
"tour_de_paris"]` and `isEventKind`; `TEAM_EVENT_KINDS` keeps meaning "kinds that
earn Rynke". `evaluateAttendance`, the tally's per-kind breakdown and
`RynkeRules.teamEvents` stay over `TEAM_EVENT_KINDS`, so a tour attendance earns
nothing (FR-002) and the rules have no amount to offer for it. Event rows,
forms, lists and badge inputs are typed with `EventKind`. Migration `0018`
inserts the kind row; the previous release never sees a tour event, since only
the new code can create one (additive migration, CLAUDE.md).
**Rationale**: no rules version change (no stored result changes: there are no
tour events yet), and the type system finds every place that must handle the new
kind. **Alternatives**: amounts `{ team: 0, training: 0 }` in the rules (a rule
change, a breakdown entry with zeros on every balance, and an amount the config
would offer, against FR-002).

The code name is `tour_de_paris`, never plain `tour`: `src/http/tour.ts` is
feature 020's onboarding tour.

## R10 – Tour days are not cut off by the qualification deadline

**Decision**: `rules.ts` gets `seasonEnd(window)` (the day before the season
start's anniversary: season start 2026-09-01 → 2027-08-31) and
`eventInWindow(kind, date, window)`: a tour day counts from the season start to
the season end, every other kind as today (FR-003). Every event filter uses it:
the organiser's event form and attendance (`organiser/events.ts`), the Termine
tab and its reports (`sections/events.ts`), personal and team badge inputs
(`badges/evaluate.ts`, `badges/team.ts`). For badges the end is also capped at
"today" (feature 013 `badgeWindow`), so a tour day dated in the future counts for
nothing until its day (FR-030a). `evaluateAttendance` needs no change: tour
attendance never reaches it (R9). Ride filters keep `inCountingWindow`.
**Alternatives**: moving the deadline (would let rides after it earn Rynke).

## R11 – Tour badges worked out on read

**Decision**: the catalog gets the team category `tour_de_paris`, unit `days`,
ladder `[1, 2, 3, 4, 5, 6, 7, 8]`, ids `tour-de-paris-1` … `-8`, placed after
`attendances` and before `team_surprise` in catalog order;
`BADGE_CATALOG_VERSION` goes to 6 because personal `team_events` now counts tour
days (FR-005, feature 013 FR-012). `TeamBadgeSums` gets `tourDays: { athleteId,
date }[]`, one per listed rider's tour attendance, from one more statement in
`teamBadgeSumsStatements`. Its series: walking the dates in order, the value on a
date is the largest number of tour days any one rider has reached by then, so
the badge for n is dated with the earliest tour day on which some rider reached
n (FR-011). The athlete id is used only inside the pure function, like
`TeamActivity` (feature 013 FR-016a). Team events of every kind, tour included,
keep feeding `big_training` and `attendances` through `eventInWindow`.
Notifications and take-back come for free from feature 013's team-badge notices,
which compare earned ids (FR-012). No picture is added to `BADGE_PICTURES`, so the
app shows the team placeholder (feature 013 FR-040a) until Phase 2.
**Stand-ins**: names "Tour-Tag 1" … "Tour-Tag 8" in `badges.de.ts`; the "what it
was for" line from one message with the day number ("Tag {day} der Tour de Paris
– der Ort folgt"), in de and en. Phase 2 replaces names, that line (with one per
day) and adds pictures; nothing earned changes (FR-014).

## R12 – The album Worker: local only, read-only, same code as the app

**Decision**: `album/worker.ts` is its own Worker with `album/wrangler.jsonc`
(`name: "rynke-album"`, `workers_dev: false`, no routes, `assets` from
`../public`, `d1_databases` `DB` with the production `database_id` and
`remote: true`). It is only ever started by `scripts/season-album.mjs` with
`wrangler dev -c album/wrangler.jsonc --ip 127.0.0.1`; with `--local` it uses
`pnpm dev`'s persisted sample state instead of production. The command passes
`SEASON_START_DATE` and `QUALIFICATION_DEADLINE` from the root `wrangler.jsonc`
as `--var`, so there is one source for them. Under `wrangler dev` the Worker code
runs on the maintainer's computer; only the D1 queries reach production, so no
CPU limit applies and no copy of the database is made.

- **Read-only guard** (`album/guard.ts`): `env.DB` is wrapped before any reader
  sees it; `prepare` accepts only statements starting with `SELECT` or `WITH`
  (after comments and whitespace) and containing no `;` outside the end,
  `batch` only such statements, `exec` and `dump` always throw (FR-021).
- **Local hosts only**: like `dev/worker.ts`, it answers only `127.0.0.1` and
  `localhost`.
- **Not in production**: `src/` never imports `album/`; `dev-guard.test.ts`'s
  layer 1 extends to `album/`, and CI deploys only the root config.
- **Readers**: `album/load.ts` uses the existing statements (listed riders,
  stored balance, stored personal badges, rider attendance, team badge sums,
  the organiser event list with attendee counts, the team total) and the pure
  evaluations, with a context whose clock is the cut-off date (`ctx.now`), so
  "today" everywhere is the cut-off (FR-023). Personal badges come from
  `rider_badges` filtered to `earned_on <= cutoff`; team badges from
  `evaluateTeamBadges` with `badgeWindow(window, cutoff)`. Rynke: the stored
  balance when the cut-off is on or after the qualification deadline (nothing
  counts after it, so it is the balance at the cut-off); otherwise the value of
  feature 009's daily series on the cut-off date. Nothing that writes (reveals,
  rises, notices) is called.
- **Season-start check** (FR-024): the command reads `SEASON_START_DATE` and
  stops when the cut-off lies before it.
**Alternatives**: `wrangler d1 export --remote` into a local database (a full copy
of all rider data, tokens included, on the laptop; rejected); a production
route behind `ADMIN_TOKEN` (against FR-020); re-implementing the readers in the
script (numbers could drift from the app, against SC-003).

## R13 – Page layout computed in millimetres

**Decision**: `album/layout.ts` computes every page and slot as absolute
positions in mm, and `render.ts` writes them as `position: absolute` with mm
units; the browser does no flowing or page breaking of its own, so pagination is
deterministic and unit-testable.

- **Page**: 210 × 297 mm. Safe area: top 12, bottom 12, outer 12, gutter 20 mm;
  odd pages gutter left, even pages right (FR-051). Content box 178 × 273 mm.
- **Slots**: 3 per row, 59.3 mm wide; slot height 60 mm: sticker 44 mm
  diameter, pose margin 3 mm sideways and 2 mm up and down, caption 8 mm (name,
  date or "?", 9 pt), shadow 1.5 mm (contracts/album-layout.md, as in the
  mock-up). A category heading takes 9 mm and is never the last thing on a
  page (FR-053); a category longer than the page continues with its heading
  repeated ("Distanz (Fortsetzung)").
- **Sticker pose** (FR-026, FR-036): from a 32-bit hash of `athleteId` and
  `badgeId` (the same FNV-style hash as `tiltOf`, salted with the rider), a
  rotation in [-6°, 6°] and an offset in [-3, 3] mm sideways and [-2, 2] mm up
  and down. The rotated sticker's bounding circle stays inside its slot, which the tests check for every badge and a sample of riders.
- **Sticker look**: a white die-cut edge (the app's sticker edge, feature 013
  issue #180) and a shadow drawn as a CSS `box-shadow` on a circle, which
  Chromium keeps vector (R1); no `filter` anywhere in `album.css` (a test greps
  for it).
- **Empty slot**: the gallery's dashed circle (`BADGE_OUTLINE_PLAIN`, feature 013),
  name below for ladder badges, "?" for surprise badges (FR-037).
- **Summary pages**: page 1 cover and the rider's figures; page 2 the team's
  season and the event table (5 mm rows, about 48 per page), continued on page 3
  if needed; sticker pages start on the next page; a blank page is added at the
  end if the total is odd (FR-053).
- **Font**: one OFL-licensed font in `album/fonts/` (proposed: Nunito, regular
  and bold, woff2), loaded with `@font-face` from the album Worker; the command
  waits for `document.fonts.ready` before printing so it is embedded (FR-055).
  Its licence file sits next to it.

## R14 – Printing and checking the PDF

**Decision**: per rider the command opens `/album/<id>?cutoff=…` in one
Playwright Chromium page, waits for the network to be idle and the fonts ready,
and calls `page.pdf({ preferCSSPageSize: true, printBackground: true })`
(`@page { size: 210mm 297mm; margin: 0 }`). One browser, pages reused; files
`season-albums/<season>/<first-name>-<n>.pdf` (n only tells same names apart).

The print check reads each PDF with `pdf-lib` and fails the album when:
a page's MediaBox is not 210 × 297 mm within 0.5 mm (FR-050); the page count is
odd (FR-053); any page has an image XObject (FR-054, FR-056: every picture in
the album is SVG, so any image means a vector was turned into one, research R1);
a font is not embedded (FR-055). Failing albums are listed and the command exits
non-zero (FR-057). `pdf-lib` is the new dev dependency: pure JavaScript, no
native build, reads page boxes and resources without rendering; pypdf (Python)
or pdf.js would do the same with a second language or a much larger package.

## R15 – Where the album folder lives and how it stays out of git

**Decision**: `season-albums/` at the repository root, in `.gitignore` next to
`strava-review/` (the same pattern: maintainer output with real data), with
`album-ignore.test.ts` reading `.gitignore` through `import.meta.glob(?raw)` as
`dev-guard.test.ts` reads sources. The command refuses to write if `git
check-ignore` says the folder is not ignored, prints the folder and the deletion
reminder, and, when older albums are already there, their age (FR-034). It never
deletes anything itself (the owner deletes manually).

## R16 – Tests against synthetic data

**Decision**: `album-render.test.ts` seeds a synthetic season (riders, events,
tour days, attendances, balances, badges) with the existing test support, runs
`album/load.ts` and `render.ts` inside the Workers pool, and compares the
summary figures with what the rider page, the Team page and the badges page
show for the same data (SC-003), and checks that no other rider's first name
appears (FR-033). Printing to PDF is not part of `pnpm test` (it needs a
browser); the quickstart covers it against `pnpm dev`'s sample season.

## Sources

- Wrangler remote bindings: https://developers.cloudflare.com/workers/development-testing/
- Cloudflare Browser Rendering limits: https://developers.cloudflare.com/browser-rendering/limits/
- Cloudflare Browser Rendering pricing: https://developers.cloudflare.com/browser-rendering/platform/pricing
- Browser Rendering `/pdf` quick action: https://developers.cloudflare.com/browser-rendering/quick-actions/pdf-endpoint/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
