# Feature Specification: Badge Hints from the Monkey

**Feature Branch**: `034-badge-hints`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "I want to motivate people a little more. I want to give them hints
for finding the hidden badges or for the next achievable badge. Make the monkey say from time to
time something like 'try this?' or 'only one more day riding outside until the next November
badge'. The hints must be for stuff that is currently achievable. Also: they should not overuse our
shared resources." Follow-up: "The monkey on the badges page might make sense, right? Only add the
hints there. We will add a few more monkey bubble graphics as well for this."

## Context

Badges (feature 013, Badges and Achievements) show a bar towards the next step of most categories,
but a rider has to read the cards to see what is close, and the surprise badges show only "?" until
earned. Many riders never find out that an early ride, a ride on Pi Day or a run and a swim on the
same day would earn one. A short line at the right moment ("Noch ein Tag draußen, dann gibt's das
nächste November-Abzeichen") turns a badge that is in reach into a reason to ride today.

The monkey (Rynke, the coin's orangutan) already says the Team page's quote in a speech bubble
(feature 016, "RynkePoints Quote Monkey"). This feature puts a monkey with a speech bubble on the
badges page, and that monkey says a badge hint. The Team page stays as it is.

**Terms**:

- **Hint**: one short line about one badge the rider has not earned yet and can still earn in time.
- **Next-step hint**: a hint about the next step of a category with a ladder (Distance, Elevation,
  Training Rynke, Running, Swimming, Virtual rides, run, ride and swim length, the winter months).
  It names the category and what is missing.
- **Surprise hint**: a hint about a surprise badge (feature 013 part D, F and J). It nudges without
  giving the rule away (FR-009).
- **Hint window**: the dates in which a hint may be shown, because the badge can still be earned
  then (FR-005, table "Hint windows").
- **Hint monkey**: the monkey picture next to the bubble on the badges page.

## Clarifications

### Session 2026-11-10

- Q (raised by the project owner): Where does the monkey say the hints? → A: On the badges page
  only, with its own monkey and speech bubble. The Team page's quotes stay unchanged. New monkey
  bubble pictures will be added for it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A hint about the next step that is in reach (Priority: P1)

A rider opens their badges page. Above the cards, the monkey says in a speech bubble how close the
next step of one category is, for example "Noch 38 km bis zum nächsten Distanz-Abzeichen" or "Noch
ein Tag draußen, dann gibt's das nächste November-Abzeichen". Tapping the bubble takes them to that
category's card.

**Why this priority**: it is the core of the request, motivation from a badge that is close, and
it needs only figures the badges page already shows.

**Independent Test**: in local fake mode, give a synthetic rider 4 outdoor riding days in November
and open the badges page on 20 November; the monkey's hint is about the 5-day November badge. Move
the date to 30 November with 1 riding day; no November hint shows.

**Acceptance Scenarios**:

1. **Given** a rider with 462 km in the season and the next Distance step at 500 km, **When** the
   page shows a Distance hint, **Then** it says 38 km are missing, in the rider's language and
   number format.
2. **Given** a rider with 4 outdoor riding days in November and November not over, **When** a
   November hint shows, **Then** it says one more day riding outside is enough.
3. **Given** 28 November and a rider with 1 outdoor riding day in November, **When** they open the
   badges page, **Then** no hint about the 5-day November badge shows (4 more days don't fit into
   the 3 days left).
4. **Given** a rider who has earned every step of a category, **When** they open the badges page,
   **Then** no hint about that category shows.
5. **Given** a hint is shown, **When** the rider taps it, **Then** the page scrolls to that
   category's card.

---

### User Story 2 - A nudge towards a surprise badge (Priority: P2)

Now and then the monkey hints at a surprise badge the rider can still earn soon, without naming it
or stating its rule: in the days before Christmas Eve, "Am 24. schon was vor? Ein paar Kilometer
passen bestimmt rein."; any time, for the early bird, "Schon mal vor dem Wecker losgefahren?".
Tapping it takes the rider to the surprise badges.

**Why this priority**: the surprise badges are the most fun and the least found; a nudge makes
them findable without spoiling them. It builds on the hint bubble from story 1.

**Independent Test**: in fake mode, open the badges page on 20 December as a rider without the
Christmas Eve badge; a Christmas Eve nudge can show. On 27 December it never shows.

**Acceptance Scenarios**:

1. **Given** a rider without the Christmas Eve badge and a date from 17 to 24 December, **When** a
   surprise hint is picked, **Then** the Christmas Eve nudge can be among the candidates.
2. **Given** 25 December or later, **When** the rider opens the badges page, **Then** no Christmas
   Eve nudge shows.
3. **Given** a rider who already earned the early bird badge, **When** they open the page, **Then**
   no early bird nudge shows.
4. **Given** any surprise hint, **When** it shows, **Then** it names neither the badge nor its exact
   rule (no time, distance or date figure that gives the rule away, FR-009).

---

### User Story 3 - The monkey does not nag (Priority: P3)

The hint is a small extra, not a banner. It does not show on every visit, it changes between
visits, and when nothing is in reach the monkey stays away.

**Why this priority**: hints that repeat or always show stop being read; this keeps them fresh.

**Independent Test**: open the badges page ten times as a rider with several candidate hints;
hints show on some visits, not all, and the same hint never shows twice in a row.

**Acceptance Scenarios**:

1. **Given** a rider with no achievable hint, **When** they open the badges page, **Then** no
   monkey and no empty bubble show.
2. **Given** a rider with three candidate hints, **When** they open the page several times, **Then**
   the hint differs from the one shown last time.
3. **Given** a hint is shown, **When** the rider stays on the page, **Then** it does not change.

---

### Edge Cases

- **Today already counted**: a rider who rode outside today in November has today counted; the
  hint counts the days left from tomorrow. A rider who hasn't is counted from today (FR-005).
- **Last day of a window**: on 30 November with 4 November days, the 5-day hint still shows (today
  is enough); on 1 December it is gone.
- **Season end**: in the last days of the season, season-long categories follow the same
  feasibility rule as windows (FR-006); after the season rollover (feature 021) only the new
  season counts.
- **No activities yet**: a rider with nothing of a kind in the season gets no amount hint for
  it (FR-006); day-count and surprise hints whose windows are open can still show.
- **Activity kinds the rider never does**: no hint about running, swimming or a triathlon-style
  surprise for a rider with no run or swim on record (FR-007).
- **Indoor and virtual rides**: winter months, Sonnenwende and Winterschlaf beendet count outdoor
  rides only; their hints say "draußen" (feature 013).
- **A rider who left the team or withdrew consent**: they have no badges page, so no hint.
- **Two hints for one category**: only the next step of a category is ever a candidate, never a
  later one.
- **Team badges**: never a hint (out of scope).
- **Clock**: all dates are Berlin dates, like every badge rule (feature 013 FR-030a).

## Requirements *(mandatory)*

### Functional Requirements

**Where and when**

- **FR-001**: The badges page MUST show the hint monkey with one hint in a speech bubble, above the
  cards, on some of the rider's visits (FR-012). No other page shows hints; the Team page's quotes
  (feature 016) stay unchanged.
- **FR-002**: A hint MUST only ever be about the viewing rider's own personal badges and use only
  their own data. Hints MUST NOT name, rank or compare riders, and MUST NOT appear in push
  notifications, Strava descriptions, shared badge pictures (feature 033) or the organiser pages.
- **FR-003**: Tapping or clicking the hint MUST take the rider to the hinted category's card (for
  a surprise hint, to the surprise badges). The hint MUST be reachable by keyboard and read by
  screen readers as text; the monkey picture is decorative.

**Achievable only**

- **FR-004**: A hint MUST be about a badge the rider has not earned, and only about the next step
  of its category.
- **FR-005**: A hint MUST show only inside its hint window (table "Hint windows"): the dates in
  which the badge can still be earned. Today counts as left unless today already counts towards
  the badge.
- **FR-006**: A hint with a count of days MUST show only when the days still needed fit into the
  days left in its window. A hint with an amount (km, m, Rynke) MUST show only when the amount
  still needed is at most the days left in its window (the season for season-long categories) times
  the rider's best single day of that kind in the season. A rider with no activity of that kind in
  the season gets no amount hint for it.
- **FR-007**: A hint about running, swimming, run or swim length, or a surprise badge that needs a
  run or a swim, MUST show only to a rider with at least one run or swim of that kind on record in
  the current or previous season.
- **FR-008**: Categories that depend on events organisers plan (Team events attended, Technique
  training, Tour de Paris) and all team badges MUST NOT get hints.

**Surprise hints**

- **FR-009**: A surprise hint MUST NOT name the badge or state its exact rule: no clock time,
  distance, height or exact date that gives the rule away. It MAY name a day everyone knows
  ("am 24.", "an Ostern", "an Silvester") and MUST point in the right direction, so a rider who
  follows it has a fair chance to earn the badge.
- **FR-010**: Each surprise badge listed in "Hint windows" MUST have at least two nudges per
  language. Surprise badges without a row there get no hint.

**Choosing and rotating**

- **FR-011**: When several hints are achievable, the pick MUST prefer the hint whose window closes
  soonest, then the one closest to done (least missing relative to the step), with some randomness
  so that the same rider sees different hints over a few visits.
- **FR-012**: A hint MUST show on about half of the rider's visits to the badges page, picked at
  random, and on the rider's first visit of the day when one is achievable. The same hint MUST NOT
  show on two visits in a row when another is achievable. On the visits without a hint, the
  monkey and bubble MUST NOT show.
- **FR-013**: The hint MUST stay the same while the rider stays on the page, including when the
  page updates in place.

**Text and art**

- **FR-014**: Hint text MUST come from the i18n catalogs in all ten languages, German as the key
  source (feature 001 FR-028), with numbers in the rider's number format. It MUST follow the
  project's copy rules: dry and specific, no slogans or punchline tags, neutral German wording.
  The monkey is no character: hints MUST NOT speak as the monkey ("Ich …") or give it feelings.
- **FR-015**: Hint text MUST suit every team: no team's name or place, and no assumption of group
  rides (Team Europe's riders ride alone, feature 026 FR-023).
- **FR-016**: The hint monkey MUST be a picture from a new set of monkey pictures made for the
  badges page, in the style of the quote monkeys, with the speech bubble in the quote's style
  (feature 016). Until that set exists, the quote monkeys' pictures MAY stand in. The same hint
  MUST always get the same picture.
- **FR-017**: The bubble MUST fit at phone width (360 px) without horizontal scrolling and in
  every theme (feature 022), light and dark.

**Shared resources**

- **FR-018**: Hints MUST NOT cause any Strava API request, and MUST NOT add queue messages,
  scheduled work or background jobs.
- **FR-019**: Showing a hint MUST NOT write to the database. What was shown last (FR-012) MUST be
  kept in the rider's own browser, and a lost record only means a hint may repeat once.
- **FR-020**: Hints MUST be worked out from data the app already stores for the rider's badges
  (feature 013), while the badges page loads. Working them out MUST add no more than two small
  database reads per visit, each limited to the rider's own current season, and none on visits
  that show no hint.
- **FR-021**: Hints MUST need no new data from Strava and no change to what riders agreed to share
  (feature 004): they come from figures the app already reads for badges. No re-ask of consent.

### Hint windows

All dates are Berlin dates, inside the current season. "Season" means the team's season dates
(feature 021). Surprise rules are feature 013's; the names here are the
rules' names, not the badges' shown names.

| Badge | Hint window | Also needs |
| --- | --- | --- |
| Distance, Elevation, Training Rynke, Running, Swimming, Virtual rides (next step) | the season | FR-006 against the season's end |
| Run, ride and swim length (next step) | the season | a longest activity of that kind of at least half the next step |
| November, December, January, February (next step) | that month | FR-006 against the month's end |
| New Year | 27 December to 1 January | |
| Christmas Eve | 17 to 24 December | |
| Christmas | 17 to 26 December | |
| Festive 500 | 17 to 31 December | from 24 December, FR-006 against 31 December |
| Night owl, early bird | the season | a counting ride in the season |
| Rest day | the season | an activity on each of the last 5 days or more |
| Etappenfahrer (stage rider) | the season | a day of at least 70 km of counting rides in the season |
| Dreikampf (ride, run and swim) | the season | FR-007 for both runs and swims |
| Kreiszahl (Pi Day) | 7 to 14 March | a counting ride of at least 25 km in the season |
| Sonnenwende | 14 to 21 December; 14 to 21 June | in June only after an outdoor ride on the December solstice |
| Easter | the 7 days before Easter Monday, and Easter Monday | |
| Everesting | each calendar month | FR-006 against the month's end |
| Winterschlaf beendet | 1 January to the season's end | no outdoor counting ride since 1 January |

### Key Entities

- **Hint**: a badge (category and next step, or surprise badge), its hint window, what is
  missing (a number for next-step hints), and the text key. Worked out per visit; never stored.
- **Hint candidate list**: the hints achievable for one rider on one date, ordered by FR-011.
- **Last shown hint**: which hint the rider saw last and on which date, kept in their browser
  only.
- **Hint monkey picture**: one of the new monkey pictures for the badges page, picked from the hint.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In tests over every date of a season and a set of synthetic riders, no hint ever
  shows for a badge that can no longer be earned in time by FR-005 to FR-007.
- **SC-002**: A visit to the badges page makes zero Strava requests, zero database writes and at
  most two more database reads than without this feature.
- **SC-003**: The badges page with a hint loads as fast as today, within normal variation (no
  more than 50 ms slower at the median in local measurements).
- **SC-004**: Over ten visits by a rider with several achievable hints, a hint shows on 3 to 7 of
  them and never the same one twice in a row.
- **SC-005**: Every hint text exists in all ten languages, and no surprise hint contains the
  badge's name or the clock time, distance, height or exact date of its rule.
- **SC-006**: Within the first season with hints, more riders earn at least one surprise badge
  than in the season before, at the same share of active riders (owner's judgement from the
  organiser figures).

## Assumptions

- **How often** (FR-012): about half of the visits, and always the first visit of the day when a
  hint exists. The owner may change this in clarification.
- **How openly** (FR-009): surprise hints are veiled nudges, not the rule. The owner may change
  this in clarification.
- **Feasibility** (FR-006): "the rider's best day of that kind in the season" stands in for what
  the rider can do; it avoids hints like "500 km in two days" for a rider whose longest day is
  60 km. The thresholds in "Hint windows" (70 km, 25 km, half the next step, 5 days) are starting
  values the plan may tune.
- **Placement**: above the cards and below the switch (feature 013 part I), so it is the first
  thing on the page without moving the cards much.
- **Art**: the new hint monkey pictures are made with the quote monkeys' process (`art/quotes/`)
  and may land after the feature; the quote monkeys stand in.
- **Team badges** are out of scope for now; a team-badge hint could follow later.
- No new data, consent or migration is expected: badge evaluation already stores what the hints
  need (feature 013).
