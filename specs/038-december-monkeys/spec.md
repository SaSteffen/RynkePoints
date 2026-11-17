# Feature Specification: December Quote Monkeys

**Feature Branch**: `038-december-monkeys`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "December quote monkeys (builds on features 035 seasonal monkeys and 037
next sets; refs issue #299). For both teams: Advent becomes a set of pictures (the Advent calendar
plus a Christmas market, mulled wine and baking Christmas biscuits), still on about half the quotes.
The four Advent Sundays each get a one-day window with an Advent wreath with the matching number of
lit candles. The days between Christmas and New Year (27–30 December) get Rynke riding off the
holiday biscuits outside in the snow. On a clash of two one-day windows (Nikolaus on the second
Advent Sunday), the quotes split 50/50. No shortest-day monkey. Anything shown from the first Advent Sunday (29 November 2026) must be released before
then."

## Overview

Features 035 and 037 dress Rynke up for the holidays on both teams' Team pages. In December, Advent is
one picture for about four weeks, and 27–30 December has none. This feature makes December richer:
Advent gets several pictures, each Advent Sunday its own wreath, and a new window fills the days
between Christmas and New Year.

Terms are as in feature 035: a **seasonal monkey** is a picture of Rynke dressed for one holiday; a
**window** is the days it shows, in German time; in a **short** window every quote shows it, in a
**long** one about half of the quotes do. New here: a window's **picture set** is the seasonal
monkeys it can show, one per quote.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - More than one Advent picture (Priority: P1)

A rider opens the Team page on a weekday in Advent. About half of the quotes show an Advent monkey, as
today, but now one of several: the Advent calendar, a Christmas market, a mug of mulled wine or baking
Christmas biscuits. Each quote keeps its picture.

**Why this priority**: Advent is the longest window, and it starts on 29 November 2026; one picture
for four weeks gets old.

**Independent Test**: Open both teams' Team pages in fake mode on several Advent weekdays and check
that the Advent quotes show different pictures from the set, and the same quote the same picture each
day.

**Acceptance Scenarios**:

1. **Given** a rider of either team on an Advent weekday, **When** the Team page shows quotes,
   **Then** about half of them show an Advent monkey, and across quotes all four Advent pictures
   appear.
2. **Given** a quote that shows an Advent picture, **When** the rider opens the page again on another
   Advent weekday, **Then** the quote shows the same picture.
3. **Given** a rider on 28 November 2026, the day before Advent, **Then** the quote pictures are as
   outside every window.

---

### User Story 2 - The Advent Sundays (Priority: P1)

On each Advent Sunday, every quote shows Rynke with an Advent wreath: one lit candle on the first
Sunday, two on the second, three on the third, four on the fourth.

**Why this priority**: The first Advent Sunday is the first day of the window (29 November 2026), so
its wreath must be live with the Advent set.

**Independent Test**: Open both teams' Team pages in fake mode on the four Advent Sundays of 2026 and
on the Saturdays and Mondays around them.

**Acceptance Scenarios**:

1. **Given** a rider of either team on 29 November 2026, **Then** every quote shows the wreath with
   one lit candle; on 30 November the Advent set's mix shows again.
2. **Given** a Team Europe rider on 6, 13 and 20 December 2026, **Then** every quote shows the wreath
   with two, three and four lit candles.
3. **Given** a Hamburg rider on 6 December 2026, which is both Nikolaus and the second Advent Sunday,
   **Then** about half of the quotes show the Nikolaus monkey and the others the two-candle wreath.
4. **Given** a year where the fourth Advent Sunday is 24 December (2028), **Then** about half of that
   day's quotes show the Christmas monkey and the others the four-candle wreath.

---

### User Story 3 - The days after Christmas (Priority: P2)

From 27 to 30 December, Rynke, round and chubby after the holidays, rides outside through falling
snow with a half-eaten Christmas biscuit.

**Why this priority**: Its window comes after the Advent ones.

**Independent Test**: Open both teams' Team pages in fake mode on 26, 27, 30 and 31 December.

**Acceptance Scenarios**:

1. **Given** a rider of either team between 27 and 30 December, **Then** every quote shows the
   snowy-ride monkey; on 26 December the Christmas monkey and on 31 December the New Year monkey.

---

### Edge Cases

- **Nikolaus on an Advent Sunday**: 6 December is the second Advent Sunday in some years (2026, 2037,
  2043); Hamburg then splits the day's quotes about evenly between Nikolaus and the two-candle wreath.
  Europe has no Nikolaus and shows only the wreath.
- **Fourth Advent on Christmas Eve**: when 24 December is a Sunday (2028, 2034), it is also the fourth
  Advent Sunday; the day's quotes split about evenly between the Christmas monkey and the four-candle
  wreath. On 25 and 26 December only Christmas shows.
- **A picture not built yet**: a set leaves it out; a window whose pictures are all unbuilt shows the
  regular monkeys, as outside it (035 FR-010). Each picture can go live once it exists.
- **Shared pictures**: both teams show all new pictures; none shows a place, a team name or a team's
  art (feature 026 FR-023).
- **Europe in German time**: as in feature 037, windows change at midnight German time.

## Requirements *(mandatory)*

### Functional Requirements

**Pictures**

- **FR-001**: There MUST be eight new seasonal monkeys, made like the quote monkeys and following their
  rules (full-body Rynke as on the badges and coin, talking, turned a little to the right where the
  bubble is; no bubble, ground or background; nothing cropped; same palette):
  - **Christmas market**: holding an open paper cone of roasted almonds and a gingerbread heart
    without writing, a scarf and a Christmassy bobble hat (reindeer band) over the helmet; no
    background.
  - **Mulled wine**: holding a steaming mug of mulled wine in both hands, a scarf around the neck.
  - **Christmas biscuits**: an apron over the kit, a baking tray of cut-out biscuits in one hand, a
    biscuit cutter in the other, a little flour on the face.
  - **Advent wreath, one to four candles** (four pictures): holding a fir wreath with four candles,
    of which exactly one, two, three or four are lit; the count MUST be easy to see at the size the
    Team page shows the monkey.
  - **Between the years**: round and chubby after the holidays, riding Rynke's own bike outside
    through falling snow, a scarf, a half-eaten Christmas biscuit in one hand.
- **FR-002**: The new monkeys MUST follow 035's rules for seasonal pictures (035 FR-002), with one
  exception: the Advent wreaths MUST show candles. They show no other religious symbol, and no year,
  digits or letters, including on mugs, bags or gingerbread.
- **FR-003**: The new monkeys MUST NOT show a place, a landmark, a team's name or a team's art, so that
  both teams can show them.

**Picture sets**

- **FR-004**: A window MUST be able to show a set of seasonal monkeys instead of one; each quote that
  shows a seasonal monkey shows one picture of the set, and the same quote MUST show the same picture
  on every day of the window.
- **FR-005**: The quotes showing each picture of a set MUST be spread about evenly across the set.
- **FR-006**: The Advent window's set MUST be the existing Advent calendar monkey plus the Christmas
  market, mulled wine and Christmas biscuits monkeys; Advent stays long (about half the quotes, 035
  FR-008).

**Windows**

- **FR-007**: Both teams MUST have, in German time, every year, in addition to their current
  windows:
  | Holiday | Window | Kind | Picture |
  |---|---|---|---|
  | First Advent | first Advent Sunday | short | wreath, one candle |
  | Second Advent | first Advent Sunday + 7 days | short | wreath, two candles |
  | Third Advent | first Advent Sunday + 14 days | short | wreath, three candles |
  | Fourth Advent | first Advent Sunday + 21 days | short | wreath, four candles |
  | Between the years | 27–30 December | short | between the years |
- **FR-008**: When the shortest windows on a day have the same length, the day's picture set MUST be
  all their pictures together, and each quote shows one of them (FR-004, FR-005): with two one-picture
  windows, about half of the quotes show each. This replaces the tie rule of 035 FR-006.
- **FR-008a**: For FR-008, Christmas Eve (24 December) MUST count as a one-day Christmas window, so that
  it splits with the fourth Advent wreath; 25 and 26 December stay Christmas only.
- **FR-009**: Windows, kinds, the shortest-window rule, the long-window mix and the fallback for an
  unbuilt picture MUST otherwise behave as in feature 035 (FR-005 to FR-010 there).

**Team data**

- **FR-010**: The new windows and the Advent set MUST be team data, as in features 035 and 037; both
  teams list the same pictures (037 FR-010).

**Checking**

- **FR-011**: A maintainer MUST be able to see every new window's pictures, and every picture of the
  Advent set, for both teams in local fake mode before the window starts, by choosing the date there
  (035 FR-014).

### Key Entities

- **Holiday**: as in feature 035; it now names a set of seasonal monkeys (often a set of one).
- **Seasonal monkey**: as in feature 035; this feature adds eight, which both teams list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Advent set and the one-candle wreath are live for both teams before 29 November
  2026; the two-, three- and four-candle wreaths before 6, 13 and 20 December 2026; the
  between-the-years monkey before 27 December 2026.
- **SC-002**: On an Advent weekday, every picture of the Advent set shows on at least one of a team's
  quotes, and no picture on more than twice its fair share of the Advent quotes.
- **SC-003**: On every day of a short window, 100% of that team's quotes show that window's monkey;
  on a day where two one-day windows meet, 100% show one of their two pictures, each on about half.
- **SC-004**: On every day outside all of a team's windows, its quote pictures match today's.
- **SC-005**: Both teams' windows, including the overlaps in the edge cases, are right for the years
  2026 to 2075 without any change after release.

## Assumptions

- The first Advent Sunday is already computed from the year (035 FR-005); the Advent Sundays are
  counted from it, so no new kind of date is needed.
- No shortest-day monkey (maintainer's decision).
- Mulled wine is fine to show for both teams; the picture shows a mug only, no bottle.
- The wreath's candles are an Advent custom on the wreath only, decided by the maintainer as the one
  exception to 035's no-candles rule.
- The pictures come from the same picture pipeline as the quote monkeys and are checked by eye, with
  the seasonal checks (no other religious symbols, no digits or letters) and, for the wreaths, the
  count of lit candles.
- The quote texts don't change; only the picture does.
- St. Martin and the seasons set stay in issue #299 for later.
