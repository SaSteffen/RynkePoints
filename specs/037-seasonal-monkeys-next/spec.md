# Feature Specification: Seasonal Quote Monkeys (Next Sets)

**Feature Branch**: `037-seasonal-monkeys-next`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Seasonal quote monkeys: next sets (issue #299), building on feature 035
(December set). Hamburg gets Easter, Halloween, Karneval and Midsummer. Team Europe gets its first
holidays: Advent, Christmas, New Year (Hamburg's pictures), Carnival, Easter, Halloween, Midsummer
(shared with Hamburg) and Europe Day (its own picture). No Nikolaus for Europe. Windows stay in German
time. Pictures follow the quote monkey rules and 035's non-religious rule. Seasons and St. Martin are
not part of this."

## Overview

Feature 035 dressed Rynke up for the German December holidays on Hamburg's Team page. This feature
adds the next sets and gives Team Europe its first holiday monkeys. Feature 035 already made a
holiday a piece of team data with a window and a picture, so this feature brings new pictures and
team data, and no new behaviour.

Terms are as in feature 035: a **seasonal monkey** is a picture of Rynke dressed for one holiday; a
**window** is the days it shows, in German time; in a **short** window every quote shows it, in a
**long** one about half of the quotes do.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Team Europe celebrates too (Priority: P1)

A Team Europe rider opens the Team page on Christmas Eve. Rynke says the quote with a Santa hat over
the helmet, as Hamburg's riders see it. During Advent, about half of the quotes show the Advent
monkey; on New Year's Eve the party monkey.

**Why this priority**: Its pictures already exist, and December is the next holiday season: Europe's
riders would otherwise see plain monkeys while Hamburg's celebrate.

**Independent Test**: Open Team Europe's Team page in fake mode on 6, 24 and 31 December and on a day
in Advent, and check the monkey.

**Acceptance Scenarios**:

1. **Given** a Team Europe rider on 24, 25 or 26 December, **When** the Team page shows a quote,
   **Then** it shows the Christmas monkey.
2. **Given** a Team Europe rider on 31 December or 1 January, **Then** every quote shows the New Year
   monkey.
3. **Given** a Team Europe rider between the first Advent Sunday and 23 December, **Then** about half
   of the quotes show the Advent monkey, each quote always the same picture.
4. **Given** a Team Europe rider on 6 December, **Then** the page shows the Advent window's mix as on
   the days around it: Europe has no Nikolaus.

---

### User Story 2 - Karneval and Easter in spring (Priority: P2)

A rider of either team opens the Team page during Karneval and Rynke wears a carnival costume; at
Easter Rynke wears bunny ears and carries a basket of eggs.

**Why this priority**: These are the next windows after December (Karneval from 4 February 2027,
Easter from 26 March 2027) and each needs a new picture first.

**Independent Test**: Open both teams' Team pages in fake mode on Weiberfastnacht, Ash Wednesday, Good
Friday and Easter Monday 2027, and on the days just outside these windows.

**Acceptance Scenarios**:

1. **Given** a rider of either team between Weiberfastnacht and Ash Wednesday (4–10 February 2027),
   **When** the Team page shows a quote, **Then** it shows the Karneval monkey; on 3 and 11 February
   it doesn't.
2. **Given** a rider of either team between Good Friday and Easter Monday (26–29 March 2027),
   **Then** every quote shows the Easter monkey; on 25 and 30 March it doesn't.
3. **Given** a year with a different Easter date (16 April 2028), **Then** both windows move with it,
   without any change to the app.

---

### User Story 3 - Midsummer, Europe Day and Halloween (Priority: P3)

A rider of either team sees a flower-crowned Rynke around midsummer and a Halloween Rynke with a
pumpkin at the end of October. A Team Europe rider also sees a Europe Day monkey on 9 May.

**Why this priority**: Their windows are later in 2027 (May, June, October), so their pictures can
follow the spring ones.

**Independent Test**: Open both teams' Team pages in fake mode on 9 May, 20–24 June and 29–31 October,
and on the days around them.

**Acceptance Scenarios**:

1. **Given** a rider of either team between 20 and 24 June, **Then** every quote shows the Midsummer
   monkey.
2. **Given** a rider of either team between 29 and 31 October, **Then** every quote shows the
   Halloween monkey.
3. **Given** a Team Europe rider on 9 May, **Then** every quote shows the Europe Day monkey; a
   Hamburg rider that day sees the regular monkeys.

---

### Edge Cases

- **A picture not built yet**: its window shows the regular monkeys, as outside it (035 FR-010). So
  each set can go live once its picture exists, and the team data can list all holidays at once.
- **Shared pictures**: both teams show the same Karneval, Easter, Midsummer and Halloween pictures,
  and Europe shows Hamburg's December pictures. None of them shows a place, a team name or a team's
  art, so this doesn't break the rule that no team shows another team's place (feature 026 FR-023).
- **Europe in German time**: Team Europe's riders live in several time zones; the windows still change
  at midnight German time, one or two hours off at most for them.
- **Overlaps**: none of the new windows overlap each other or the December ones in any year (Karneval
  ends by 10 March at the latest, Easter Monday by 26 April, both before Europe Day on 9 May).
- **Early Karneval**: Weiberfastnacht can fall as early as 29 January (Easter on 22 March), so the
  Karneval picture must be live in January.
- **Rider language**: Europe's holidays belong to the team, like Hamburg's; a Europe rider reading
  German sees the same monkeys as one reading English.

## Requirements *(mandatory)*

### Functional Requirements

**Pictures**

- **FR-001**: There MUST be five new seasonal monkeys, made like the quote monkeys and following their
  rules (full-body Rynke as on the badges and coin, talking, turned a little to the right where the
  bubble is; no bubble, ground or background; nothing cropped; same palette):
  - **Karneval**: a carnival costume over the kit: a red clown nose, a jester's collar, confetti
    and streamers.
  - **Easter**: bunny ears over the helmet, holding a small basket of painted eggs.
  - **Midsummer**: a crown of flowers and leaves over the helmet, holding a bunch of wild flowers.
  - **Halloween**: holding a carved pumpkin lantern with a friendly face, a few cartoon bats and a
    spider around; fun, never scary.
  - **Europe Day**: festive and friendly, e.g. waving a garland of plain pennants in the palette's
    colours.
- **FR-002**: The new monkeys MUST follow 035's rules for seasonal pictures: fun and non-religious (no
  crosses, angels, churches; Easter is bunnies and eggs; no maypole, which can read as a cross), and
  no year, digits or letters.
- **FR-003**: The Europe Day monkey MUST stay non-political: no flag, no EU emblem or ring of stars,
  no map or country shapes, no country colours.
- **FR-004**: The new monkeys MUST NOT show a place, a team's name or a team's art, so that both teams can
  show it.

**Windows**

- **FR-005**: Hamburg's holidays MUST be, in German time, every year, in addition to the December
  ones of feature 035:
  | Holiday | Window | Kind |
  |---|---|---|
  | Karneval | Weiberfastnacht to Ash Wednesday (Easter Sunday −52 to −46) | short |
  | Easter | Good Friday to Easter Monday (Easter Sunday −2 to +1) | short |
  | Midsummer | 20–24 June | short |
  | Halloween | 29–31 October | short |
- **FR-006**: Team Europe's holidays MUST be, in German time, every year:
  | Holiday | Window | Kind | Picture |
  |---|---|---|---|
  | Carnival | as Hamburg's Karneval | short | Karneval |
  | Easter | as Hamburg's | short | Easter |
  | Europe Day | 9 May | short | Europe Day |
  | Midsummer | as Hamburg's | short | Midsummer |
  | Halloween | as Hamburg's | short | Halloween |
  | Advent | first Advent Sunday to 23 December | long | Advent |
  | Christmas | 24–26 December | short | Christmas |
  | New Year | 31 December – 1 January | short | New Year |
- **FR-007**: Team Europe MUST NOT have a Nikolaus window.
- **FR-008**: Windows, kinds, the shortest-window rule, the long-window mix and the fallback for an
  unbuilt picture MUST behave as in feature 035 (FR-005 to FR-010 there).

**Team data**

- **FR-009**: The holidays MUST be team data, as in feature 035; Team Europe's holidays are no longer
  a placeholder. This replaces 035 FR-011's "Team Europe's MUST hold none".
- **FR-010**: Two teams MAY list the same seasonal monkey when it meets FR-004. This clarifies 035
  FR-012: a team never shows a picture made for another team's place.

**Checking**

- **FR-011**: A maintainer MUST be able to see every new window's picture for both teams in local
  fake mode before the window starts, by choosing the date there (035 FR-014).

### Key Entities

- **Holiday**: as in feature 035; this feature adds entries to both teams' data.
- **Seasonal monkey**: as in feature 035; this feature adds Karneval, Easter, Midsummer, Halloween and
  Europe Day, which may be listed by more than one team.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Team Europe's December monkeys are live wherever Europe's site runs before 29 November
  2026 (Advent), and at the latest before 24 December 2026.
- **SC-002**: The Karneval monkey is live for both teams before 4 February 2027, the Easter monkey
  before 26 March 2027, the Europe Day monkey before 9 May 2027, the Midsummer monkey before 20 June
  2027 and the Halloween monkey before 29 October 2027.
- **SC-003**: On every day of a short window, 100% of that team's quotes show that window's monkey.
- **SC-004**: On every day outside all of a team's windows, its quote pictures match today's.
- **SC-005**: Both teams' windows are right for the years 2026 to 2035 without any change after
  release.

## Assumptions

- The windows of feature 035's code already support fixed dates and dates counted from Easter or the
  first Advent Sunday; no new kind of date is needed.
- Hamburg's Karneval is kept short and German-named in Hamburg's data; Europe calls the same window
  Carnival. The name is a maintainer's label; riders see only the picture.
- Midsummer uses a fixed window around the solstice (20–24 June) rather than any country's own
  Midsummer day, as both teams' riders celebrate on different days.
- The pictures come from the same picture pipeline as the quote monkeys and are checked by eye, with
  the extra seasonal checks (no religious symbols, no digits or letters) and, for Europe Day, the
  political check of FR-003.
- Europe's site may not be in production by the December dates; SC-001 applies once it is.
- The seasons set and St. Martin stay in issue #299 for later.
- The quote texts don't change; only the picture does.
