# Feature Specification: Seasonal Quote Monkeys (December)

**Feature Branch**: `035-seasonal-monkeys`

**Created**: 2026-11-10

**Status**: Implemented

**Input**: User description: "Seasonal quote monkeys, December set, for the Hamburg team (German
holidays only). During a date window the Team page's quote monkey shows a seasonal picture of
Rynke instead of one of the eleven regular ones. December windows: Advent, Nikolaus, Weihnachten,
Silvester/Neujahr. During a short window only the seasonal monkey shows; during Advent the Advent
monkey mixes with the regular ones. Seasonal sets and windows are team data; Team Europe gets none
for now. Pictures are made like the quote monkeys. Windows follow the German calendar and repeat
every year. Must be live before 29 Nov 2026."

## Context

On the Team page Rynke says the rider's quote in a speech bubble, standing on the team total (the
quote monkey, amended into feature 016, Team Leaderboard). Each quote gets one of eleven pictures
of him, the same one every time. They never change with the calendar, while the quotes themselves
already follow the seasons.

This feature dresses Rynke up for the German December holidays: Advent, Nikolaus, Christmas and
New Year's Eve. It is the first set of a longer list (Easter, Halloween, Karneval, the seasons, and
other teams' holidays later), so the way a team names its holidays and their pictures has to carry
those without new code.

**Terms**:

- **Regular monkeys**: the eleven quote monkeys there are today.
- **Seasonal monkey**: a picture of Rynke dressed for one holiday.
- **Window**: the days a seasonal monkey is shown, in German time (Europe/Berlin), the same every
  year.
- **Short window**: a window of a few days that belongs to its seasonal monkey alone.
- **Long window**: a window of weeks, where the seasonal monkey shares the quotes with the regular
  ones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rynke celebrates the holidays (Priority: P1)

A Hamburg rider opens the Team page on Christmas Eve. Rynke says the quote with a Santa hat over his
helmet and a gift-wrapped banana. On 6 December he carries a boot full of bananas and chocolate; on
New Year's Eve and New Year's Day he holds a sparkler and wears a party hat. On those days every
quote shows that holiday's monkey.

**Why this priority**: The short holidays are what riders notice and talk about; they are the point
of the feature.

**Independent Test**: Open the Team page in fake mode on 6 Dec, 24 Dec, 26 Dec, 31 Dec and 1 Jan,
for several quotes, and on 5 Dec, 27 Dec and 2 Jan for comparison.

**Acceptance Scenarios**:

1. **Given** a Hamburg rider and the date 24, 25 or 26 December in German time, **When** the Team
   page shows a quote, **Then** the quote's picture is the Christmas monkey, whatever the quote.
2. **Given** the date 6 December, **When** the Team page shows a quote, **Then** the picture is the
   Nikolaus monkey (not the Advent monkey).
3. **Given** the date 31 December or 1 January, **When** the Team page shows a quote, **Then** the
   picture is the New Year monkey.
4. **Given** the date 27 December or 2 January, **When** the Team page shows a quote, **Then** the
   picture is a regular monkey, as today.
5. **Given** 23:30 on 23 December UTC (00:30 on 24 December in Hamburg), **When** the page shows a
   quote, **Then** it is the Christmas monkey.

---

### User Story 2 - Advent weeks (Priority: P2)

During Advent the Advent monkey (Rynke with an Advent calendar door, or a wreath on his handlebar)
shows up often, but not on every quote, so the four weeks don't get dull.

**Why this priority**: Advent is the longest window and starts first (29 Nov 2026), but on its own
it is a nice extra, not the highlight.

**Independent Test**: Open the Team page in fake mode on several days between the first Advent
Sunday and 23 December, for many quotes, and count the pictures.

**Acceptance Scenarios**:

1. **Given** a date from the first Advent Sunday to 23 December (except 6 December), **When** the
   Team page shows quotes, **Then** about half of them show the Advent monkey and the rest a regular
   monkey.
2. **Given** a quote in the Advent window, **When** the rider sees it again on another Advent day,
   **Then** it shows the same picture as before.
3. **Given** the day before the first Advent Sunday, **When** the page shows a quote, **Then** it
   shows a regular monkey.
4. **Given** the year 2027 (first Advent Sunday 28 Nov) or 2028 (3 Dec), **When** the page shows a
   quote on that Sunday, **Then** the Advent window has begun, with no change to the app.

---

### User Story 3 - Each team its own holidays (Priority: P3)

Team Europe's riders see the regular monkeys all December, as today. A maintainer who later adds a
holiday for a team (Easter for Hamburg, say, or a Swedish Lucia for Europe) adds it to that team's
data with its window and pictures; no code changes.

**Why this priority**: Required by the team rules and for the next sets, but riders don't see it in
December.

**Independent Test**: Open Team Europe's Team page in fake mode on 24 December and check its
monkey; read both teams' data.

**Acceptance Scenarios**:

1. **Given** a Team Europe rider on 24 December, **When** the Team page shows a quote, **Then** it
   shows a regular monkey.
2. **Given** a team's data, **When** a maintainer reads it, **Then** it lists that team's holidays,
   each with its window, whether it is short or long, and its pictures.

---

### Edge Cases

- **Overlapping windows**: Nikolaus lies inside Advent. The shorter window wins: on 6 December only
  the Nikolaus monkey shows.
- **4th Advent on 24 December** (2028, 2033): Advent ends on 23 December regardless; 24 December
  is Christmas.
- **New Year across the year end**: the New Year window runs from 31 December to 1 January and
  counts as one window, not two.
- **A seasonal picture not built yet**: the page shows the regular monkeys in that window, as
  outside it; it never shows a broken picture.
- **Midnight**: the window changes at midnight German time, not UTC. A page loaded before midnight
  keeps its picture until reloaded.
- **A quote seen in a short window**: after the window it gets its regular monkey back.
- **Rider language**: a Hamburg rider who reads the app in English still sees the German holidays;
  the holidays belong to the team, not to the language.
- **Rider state illustrations**: the fallback pictures used when no monkey is built are unchanged.

## Requirements *(mandatory)*

### Functional Requirements

**Pictures**

- **FR-001**: There MUST be four seasonal monkeys for Hamburg, made like the quote monkeys and
  following their rules (full-body Rynke as on the badges and coin, talking, turned a little to the
  right where the bubble is; no bubble, ground or background; nothing cropped; same palette):
  - **Advent**: holding an open Advent calendar door, or an Advent wreath on the handlebar.
  - **Nikolaus**: holding a boot full of bananas and chocolate.
  - **Christmas**: a Santa hat over the helmet, holding a gift-wrapped banana.
  - **New Year**: a sparkler and a party hat, glasses in the shape of the new year's digits or
    plain party glasses (the year changes every year, so the picture must not name one).
- **FR-002**: The seasonal monkeys MUST stay fun and non-religious: no crosses, angels, nativity
  scenes, churches or candles in a religious setting. Nikolaus is a gift-bringer here, not a saint.
- **FR-003**: Each seasonal monkey MUST stay decorative, like the regular ones (no alt text, no
  rider-facing text added).

**Windows**

- **FR-004**: Hamburg's December windows MUST be, in German time (Europe/Berlin), every year:
  | Holiday | Window | Kind |
  |---|---|---|
  | Advent | first Advent Sunday to 23 December | long |
  | Nikolaus | 6 December | short |
  | Christmas | 24–26 December | short |
  | New Year | 31 December – 1 January | short |
- **FR-005**: The first Advent Sunday MUST be computed from the year: the fourth Sunday before
  25 December (between 27 November and 3 December).
- **FR-006**: When windows overlap, the shortest one MUST apply.
- **FR-007**: In a short window, every quote MUST show that window's seasonal monkey.
- **FR-008**: In a long window, about half of the quotes MUST show its seasonal monkey and the
  others a regular one; which picture a quote gets MUST be the same each time within the window.
- **FR-009**: Outside every window, the quote pictures MUST be exactly as today.
- **FR-010**: When a window's seasonal monkey has no finished picture, the page MUST behave as
  outside that window.

**Team data**

- **FR-011**: A team's holidays (name, window, short or long, picture) MUST be team data, never a
  branch in code. Hamburg's data MUST hold the four December holidays; Team Europe's MUST hold none.
- **FR-012**: A team MUST never show another team's seasonal monkey.
- **FR-013**: Adding a later holiday with a fixed date, or one computed from Christmas or Easter,
  MUST need only team data and its pictures.

**Checking**

- **FR-014**: A maintainer MUST be able to see every window's picture in local fake mode before the
  window starts, by choosing the date there.

### Key Entities

- **Holiday**: belongs to one team; a name, a window (start and end, as fixed day-months or
  relative to Christmas or Easter), a kind (short or long) and one seasonal monkey.
- **Seasonal monkey**: a quote monkey picture with an id, made and built like the regular ones,
  listed only under the holiday that uses it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The four December monkeys are live on Hamburg's site before 29 November 2026.
- **SC-002**: On 6, 24–26 and 31 December and 1 January, 100% of Hamburg quotes show that day's
  seasonal monkey.
- **SC-003**: Across 40 different quotes during Advent, between 30% and 70% show the Advent
  monkey.
- **SC-004**: On every day outside the windows, and every day for Team Europe, the quote pictures
  match today's.
- **SC-005**: The windows are right for the years 2026 to 2035 without any change after release.

## Assumptions

- The Hamburg team is German: its holidays are German ones, in German time. Other German holidays
  (Easter, Halloween, Karneval, St. Martin, the seasons) and other teams' holidays are later sets,
  not this feature.
- The days between the windows (27–30 December, 2 January onward) show the regular monkeys; a
  winter monkey is part of the later seasons set.
- The pictures come from the same picture pipeline as the quote monkeys and are checked by eye the
  same way; their prompts follow FR-001.
- The quotes themselves (the text) don't change; only the picture does.
- Production gets the feature through the normal release to `main`; the release has to be done by
  about 27 November to meet SC-001.
- Quotes for which the Team page shows no monkey (or a rider-state illustration) are out of scope.
