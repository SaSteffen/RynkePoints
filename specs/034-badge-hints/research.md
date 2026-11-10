# Research: Badge Hints from the Monkey

## R1. Where the "last shown" record lives, and who picks

**Decision**: The server works out the hint candidates and renders the first three (FR-011 order)
as `<template>`s in a slot on the badges page. `public/app.js` decides in the browser whether this
visit shows one (first visit of the day, else a coin flip), picks one, and keeps
`{date, key}` in `localStorage` (`rp-badge-hint`). No cookie, no request of its own.

**Rationale**: FR-019 keeps the record in the browser and writes nothing to the database. A cookie
would let the server pick, but the privacy page (all ten languages) says there are no cookies
besides `rp_session`, `rp_oauth_state` and `rp_lang`; a fourth would mean new privacy text.
`localStorage` already holds the theme, the install prompt and the shows switch. A separate hint
request after load (`/me/badges/hint`) would re-read the rider's badges and break FR-020.

**Alternatives considered**: cookie and server pick (privacy text, see above); a lazy fragment
request only on hint visits (a second Worker request and about seven reads); the database
(`quote_seen`-style table; FR-019 forbids it).

## R2. The reads (FR-020, SC-002)

**Decision**: No new statement. The badges page's batch already reads the rider's
`rider_summaries` row (`days`, `virtual_days`, `own_days`) and sums over `runs` and `swims` for
the season. The summary read also selects `run_days` and `active`, and the runs and swims reads
each get an `EXISTS` over the previous season (FR-007), by the existing `runs_by_rider` and
`swims_by_rider` indexes. The parsed day lists are passed on instead of being dropped after the
progress bars.

**Rationale**: FR-020 allows up to two small extra reads, and none on visits without a hint. With
the client picking (R1), the server can't know which visits show one; adding columns to reads it
already makes costs no extra statement and no round trip on any visit.

**Alternatives considered**: two extra statements in the same batch (allowed, but on every visit);
re-reading activities (far larger).

A rider without a summary row at `OWN_SUMMARY_SINCE` (the page then adds up their rides) gets no
hints until the daily job writes the row.

**Update (implementation)**: no previous-season `EXISTS`. The daily job deletes every ride, run and
swim dated before the season start (`purgePreSeasonActivities`), so a previous-season run or swim
is never on record; FR-007 is checked against the season's runs and swims (`runDistanceM`,
`swimDistanceM` > 0), from the sums the page already reads. The batch keeps its five statements.

## R3. Feasibility figures (FR-006)

**Decision**: "Best day of that kind in the season", from the stored day lists:

| Category | Best day |
| --- | --- |
| Distance | max of `days[i][1]` (metres per day of counting rides) |
| Elevation, Everesting | max of `days[i][3]` (decimetres per day) |
| Training Rynke | max of `days[i][2]` (distance Rynke per day) |
| Running | max of `run_days[i][1]` |
| Virtual rides | max of `virtual_days[i][1]` |
| Swimming | the longest single swim (no swim day list exists) |
| Festive 500 | max of `days[i][1]` |

Days left: from today to the window's end, both included. For a day count (winter months), today
is left only if `own_days` has no outdoor entry for today (FR-005). Season-long categories end at
`QUALIFICATION_DEADLINE`, before `badgeWindow` clamps it to today.

**Rationale**: everything is in the reads of R2. Training Rynke's best day leaves out corrections
and event Rynke, so it is a slight underestimate; a hint that is held back is harmless, one that
can't be reached isn't (SC-001).

## R4. Order and randomness (FR-011, FR-012)

**Decision**: The server orders the candidates by window end (soonest first), then by closeness
(missing ÷ next step, smallest first; surprise hints count as 1), then by key. It renders the
first three. The browser drops the last shown key when another remains, then picks the first with
probability ½, the second ¼ and the third ¼ (with two left: ⅔ and ⅓). A visit that isn't the
first of the day shows a hint with probability ½.

**Rationale**: over ten visits that gives the 3 to 7 hints of SC-004 in most runs, never the same
twice in a row, and still leans towards what closes soonest.

## R5. Same hint while on the page (FR-013)

**Decision**: `app.js` keeps the shown hint's key in memory. When `refreshPage()` swaps the same
page in place (back after a minute, the first data, the fetching line, the refresh button), the
slot shows that key again if the new candidates still have it, and nothing otherwise. A switch to
another section and back is a new visit.

The phrase variant of a hint (two lines per surprise badge and for Distance and Elevation) is
picked on the server from the Berlin date and the key, so the same key gives the same line all day.

## R6. Language and numbers (FR-014)

**Decision**: The team decides, as for the quotes (`phraseSet(team).locale`) and badge names:
Hamburg, with its own German phrases, always gets German lines; every other team English, whatever
the rider picked. Numbers are formatted in the line's language (`Intl.NumberFormat`). Month names in a line come from
`Intl.DateTimeFormat` in the line's language. The "Tipp"/"Tip" label and the "Zur Karte"/"To the
card" line belong to the hint lines, not the ten-language catalogs, so the bubble is one language. The lines live in `src/content/hints/de.ts` and `en.ts`, beside the quote
phrases (same exception, feature 026 FR-025).

## R7. Link and outline after the tap (FR-003, design draft)

**Decision**: The bubble is an `<a href="#badge-card-<category>">`; every personal card gets that
`id`. CSS `:target` gives the card the draft's outline for about two seconds, with
`scroll-margin-top` clearing the sticky switch. When the "Alle" filter is on (cards hidden),
`app.js` sets "Neueste" before following the link. Surprise hints link to `#badge-card-surprise`.

**Rationale**: works without the hint's own script beyond the pick; keyboard and screen readers
get a normal link whose name is the hint text.

## R8. When no hint renders at all

- The waiting state (no balance yet) and a rider with no personal group.
- A visit that reveals new badges (`badges-reveal`): the celebration comes first.
- No candidates.

## R9. Pictures

`HINT_MONKEYS` holds all six. Each hint kind maps to its monkey (FR-016 table); a monkey missing
from the list falls back to the first quote monkey, so the feature never shows a broken image.
The picture is `alt=""`, 104 px like the draft.
