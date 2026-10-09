# Feature Specification: Team Leaderboard and Organiser Overview

**Feature Branch**: `016-team-leaderboard`

**Created**: 2026-10-09

**Status**: Draft

**Input**: Backlog prompt `specs/backlog/team-leaderboard.md` (removed with this
spec): "Specify the team leaderboard and the organiser overview of RynkePoints.
Seeing each other's progress is the purpose of the app: it should motivate riders to
train for the team." Every signed-in rider gets a leaderboard of every consenting
rider's accumulated Training and Team Rynke without names, with a week-by-week
graph; organisers get every consenting rider by first name with totals, breakdown,
amounts missing and qualification, and a list of who qualified. Both read what
feature 003 stores and never trigger an evaluation.

The look follows feature 012's "full fun" style and is agreed in the Claude Design
mock-up "RynkePoints Team Leaderboard" (team leaderboard on a phone in light and dark
mode, organiser overview on a phone and a desktop, sample season on Thursday
25 March 2027). The peloton's breakaway (FR-018) was agreed later and added to the
mock-up's team leaderboard, with a `breakaway` tweak for its three sample states.

## Clarifications

### Session 2026-10-09

- Q: How is the leaderboard ordered? → A: By the kind the rider picks (Training or
  Team Rynke), highest first. By default the list shows the rider's neighbourhood:
  the three places ahead and the three behind; a toggle shows everyone. Only the
  list is cut down; the team total, the peloton and the team chart always cover
  every consenting rider.
- Q: A "lanterne rouge" for the last place? → A: No. Riders who are behind already
  get enough nudges about the pace they need.
- Q: Anything else to motivate riders? → A: A random quote, in German only, fun and
  mostly motivating, from several angles. Riders who need a push and riders who are
  well on track get different lists of about 200 quotes each; the on-track list
  reminds riders to encourage others, plan team rides and the like. The quote
  changes only when the page loads; there is no button for the next one.
- Q: Where does the qualification deadline come from? → A: It is a team setting,
  stored like the season start date (`QUALIFICATION_DEADLINE`), and for now it is
  30 June 2027. Without it the app can't tell who is on track, so there is always
  one; it no longer belongs to the versioned rules.
- Q: A few riders far ahead squash everyone else to the left of the peloton. Leave
  them out or use a logarithmic road? → A: Neither. Riders far ahead ride in a
  "Breakaway" past a gap in the road, in order but not to scale; the bunch stays to
  scale. The label is "Breakaway" in German too, because it is more fun.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rider sees where they stand in the team (Priority: P1)

A rider opens Team and sees the team's combined Rynke, their own place ("You're 6th
of 14 riders 🚴") and how many Rynke they need to move up a place, then the
leaderboard around their place: three anonymous rows ahead, their own row marked
"You 🦧", and three rows behind. Each row shows the rider's total of the picked kind
with the coin, the other kind in small print, and a small line of that rider's
season so far. A switch picks Training or Team Rynke; a toggle shows every row.

**Why this priority**: Seeing each other's progress is the purpose of the app; this
is the view every rider gets.

**Independent Test**: With synthetic riders (`pnpm dev`), sign in as a rider in the
middle of the team and compare places, totals and the rows shown with figures worked
out by hand, for both kinds and both list modes.

**Acceptance Scenarios**:

1. **Given** 14 consenting riders and a viewer with the 6th most Training Rynke,
   **When** the viewer opens Team, **Then** they read "6th of 14", the Rynke the
   5th rider is ahead of them plus one, and the rows for places 3 to 9 with their own
   row marked.
2. **Given** the same viewer, **When** they switch to Team Rynke, **Then** every
   figure, the order and their place follow Team Rynke.
3. **Given** the viewer is 2nd, **When** they open Team, **Then** the list shows
   places 1 to 5 (one ahead, three behind) and says how many rows are hidden.
4. **Given** the list shows the neighbourhood, **When** the viewer picks "Everyone",
   **Then** all 14 rows are shown.
5. **Given** any row other than the viewer's, **When** it is shown, **Then** it
   carries no name, athlete ID, profile link, picture or anything else that names
   the rider.
6. **Given** the top three places, **When** they are shown, **Then** they carry
   🥇🥈🥉; the last place carries nothing special.

---

### User Story 2 - The team's progress at a glance (Priority: P1)

Above the leaderboard, a rider sees the team's combined Rynke of the picked kind
with "+N this week 🔥", a "peloton" where every rider is a coin on a road placed by
their total (the viewer's coin bigger and marked "You"; riders far ahead of the
bunch ride in a breakaway past a gap in the road), and a bar chart of the
team's accumulated Rynke at the end of each week, the current week highlighted, with
the team's best week so far.

**Why this priority**: The team figures show that everyone's riding adds up, which
motivates more than the ranking alone.

**Independent Test**: For synthetic riders, compare the team total, this week's
gain, the weekly bars and the best week with sums worked out by hand.

**Acceptance Scenarios**:

1. **Given** consenting riders with stored balances, **When** a rider opens Team,
   **Then** the team total is the sum of their totals of the picked kind.
2. **Given** a rider without a current consent, **When** anyone opens Team, **Then**
   their Rynke are in no total, bar, coin, place or count.
3. **Given** the peloton, **When** it is shown, **Then** it shows every consenting
   rider, whatever the list mode, with no names and no threshold line.
4. **Given** 14 riders with 52 to 384 Training Rynke and two more with 760 and 912,
   **When** the peloton is shown, **Then** the two ride in the breakaway right of
   the gap, 760 behind 912, and the bunch spreads to scale from the left up to its
   front rider with 384.
5. **Given** no rider far enough ahead (FR-018), **When** the peloton is shown,
   **Then** it has no gap and every coin is placed to scale against the highest
   total.

---

### User Story 3 - A quote that fits the rider (Priority: P2)

Below their place, the rider gets one German quote picked at random: a rider who
needs a push gets a motivating one ("Jeder Kilometer zählt – auch der im
Nieselregen."), a rider who is well on track gets one that asks them to bring the
others along ("Plan doch die nächste Teamausfahrt – Kuchenstopp inklusive.").

**Why this priority**: Adds fun and a personal nudge; the leaderboard works without
it.

**Independent Test**: Sign in as a synthetic rider behind the even pace and as one
ahead of it, load Team several times, and check every quote comes from the matching
list and changes between loads.

**Acceptance Scenarios**:

1. **Given** a rider behind the even pace (FR-030), **When** they open Team, **Then**
   the quote comes from the "needs a push" list.
2. **Given** a rider on or ahead of the even pace, or one who qualifies, **When**
   they open Team, **Then** the quote comes from the "on track" list.
3. **Given** a quote is shown, **When** the rider stays on the page, **Then** it
   does not change; **when** they load the page again, **Then** a new random quote
   from the same list may appear.
4. **Given** a rider who uses the app in English, **When** they open Team, **Then**
   the quote is still in German.

---

### User Story 4 - Organisers see who needs help (Priority: P1)

An organiser opens the organiser overview and sees how many days are left until the
qualification deadline, how many riders "reached their training goal 🎯", and every consenting
rider by first name, sorted into three groups: "Need a push 🍌", "On track 🚴" and
"Training goal reached 🎯". Each rider shows Training and Team bars with a mark for the even
pace, what is still missing (Training, Team, outdoor Training), and, on request,
the breakdown of where their Rynke come from, including attendance and corrections.
A list shows who qualified.

**Why this priority**: Organisers need to find riders who need help before the
deadline; this was the prompt's second view.

**Independent Test**: Sign in as a synthetic organiser and compare each rider's
group, figures and breakdown with the stored balance; sign in as a rider and check
the overview is refused.

**Acceptance Scenarios**:

1. **Given** an organiser on a phone before the deadline, **When** they open the
   overview, **Then** "Need a push" is selected and lists every rider who is behind the even pace (FR-030) on
   Training, Team or outdoor Training Rynke and does not yet qualify.
2. **Given** a rider who qualifies (feature 003 FR-013), **When** the organiser looks,
   **Then** the rider is in "Training goal reached" and in the list of who qualified.
3. **Given** two riders named Jonas, **When** they are shown, **Then** each carries a
   "View on Strava" link to their Strava profile.
4. **Given** a rider who is not an organiser, **When** they ask for the overview,
   **Then** they get "not allowed" and see no entry for it in the navigation.
5. **Given** a desktop screen, **When** an organiser opens the overview, **Then** the
   riders are a table with one row per rider and every figure in a column.

### Edge Cases

- Equal totals share a place ("joint 4th"); they are listed by the other kind, then
  in a fixed order that does not depend on anything that names the rider.
- The viewer near the top or the bottom: the neighbourhood is shorter on that side
  and is not filled up from the other side.
- A team of seven or fewer riders: the neighbourhood is the whole list; the toggle is
  not shown.
- A viewer whose place is 1st: "You lead the peloton. Bring the others along!"
  instead of the Rynke to the next place.
- A viewer in the breakaway: their larger coin rides past the gap like the other
  breakaway riders.
- A team of four or fewer consenting riders: the peloton has no breakaway; with so
  few totals the outlier rule says nothing useful.
- A rider without any stored balance yet (no evaluated rides): counted with 0 Rynke.
- The deadline has passed: the days-to-go card says the deadline has passed; groups
  and quote lists follow qualification only.
- The first week of the season can be shorter (feature 009's week).
- An organiser who is also a rider appears in the leaderboard and the overview like
  every other consenting rider.
- A consenting rider whose Strava connection needs renewing is left out of both views
  until they reconnect, as on feature 014's organiser pages; "consenting riders"
  throughout means connected riders with a current consent.

## Requirements *(mandatory)*

### Functional Requirements

**Access and data**

- **FR-001**: Every signed-in rider MUST reach the team leaderboard under Team
  (feature 011), replacing its placeholder. Visitors who are not signed in MUST see
  no rider data (feature 004 FR-020).
- **FR-002**: Only organisers MUST reach the organiser overview, checked on every
  request; others get "not allowed" (feature 014 FR-001). Organisers MUST find it
  under an "Orga" tab in the app navigation, left of Settings, whose page switches
  between the overview and the events like Team's Training and Team switch; riders
  who are not organisers MUST NOT see the tab (feature 014 FR-002).
- **FR-003**: Both views MUST read the balances and results feature 003 stores and
  MUST NOT trigger an evaluation or a Strava request.
- **FR-004**: Riders without a current consent MUST be left out of every row,
  coin, count, total, bar, place and group (feature 004 FR-021).
- **FR-005**: The qualification deadline MUST be a team setting like the season
  start date (feature 002), always set: the last day rides and team events count
  (feature 003 FR-011) and the end of the even pace (FR-030). It is 30 June 2027.

**Team leaderboard**

- **FR-010**: The leaderboard MUST show every consenting rider's accumulated
  Training and Team Rynke, overall and per week, and nothing else about other riders
  (feature 004 FR-020): no name, athlete ID, profile link, picture, progress to a
  threshold, qualification or individual ride.
- **FR-011**: A switch MUST pick Training or Team Rynke; ordering, places, the
  rider's own place, the team total, the peloton and the team chart MUST follow it.
  Training Rynke is selected when the page opens.
- **FR-012**: Rows MUST be ordered by the picked kind, highest first, as in the edge
  cases; the top three places MUST carry 🥇🥈🥉 and the last place nothing special.
- **FR-013**: By default the list MUST show the viewer's row with up to three rows
  ahead and up to three behind, and say how many rows ahead and behind are hidden. A
  toggle MUST show every row. The neighbourhood is the default each time the page
  opens.
- **FR-014**: The viewer's own row MUST be marked "You 🦧" and highlighted.
- **FR-015**: Each row MUST show a small line of the rider's accumulated Rynke of the
  picked kind at the end of each week of the season.
- **FR-016**: The page MUST show the viewer's place out of all consenting riders and
  how many Rynke of the picked kind they need to pass the next place.
- **FR-017**: The page MUST show the team total of the picked kind, its gain in the
  current week, a peloton of every consenting rider placed by total (the viewer's
  coin larger and marked), and a bar chart of the team's accumulated Rynke at the end
  of each week with the current week highlighted and the best week named.
- **FR-018**: A consenting rider whose total of the picked kind is above the upper
  outlier fence (third quartile + 1.5 × the interquartile range of all consenting
  riders' totals) MUST ride in the peloton's **breakaway**, from five consenting
  riders on. The road then shows a gap; the bunch sits left of it, placed to scale
  against its own highest total, and the breakaway right of it, in order of total
  but not to scale. The road's front end is labelled "Breakaway 🏁" instead of
  "Front 🏁", in German too, and the text for assistive technology says how many
  riders are in the breakaway (FR-041). Without a breakaway the road has no gap and
  is placed to scale against the highest total.

**Quotes**

- **FR-020**: The Team page MUST show the viewer one quote picked at random from one
  of two lists, picked anew each time the page loads and never in between; there is
  no control for the next quote.
- **FR-021**: The "needs a push" list MUST be used for a rider who does not qualify
  and is behind the even pace (FR-030) on Training, Team or outdoor Training Rynke;
  the "on track" list for every other rider.
- **FR-022**: Each list MUST hold about 200 quotes in German, fun and mostly
  motivating, from several angles (cycling, the team, Paris, the coin and its
  orangutan, weather, the cause the team rides for). The "on track" list MUST mostly
  ask riders to bring others along: encourage teammates, plan team rides, share
  tips.
- **FR-023**: Quotes MUST be German in every language of the app, an exception to
  feature 001 FR-028 ("in every language"); they live in a German-only list beside
  the i18n catalogs, not in pages or logic. They MUST be marked as German for assistive technology.
- **FR-024**: Quotes MUST NOT name, rank or compare individual riders.

**Organiser overview**

- **FR-030**: The **even pace** of a threshold on a day MUST be the threshold × the days since season start ÷ the days from season start to
  the deadline, rounded down. It applies to the Training threshold, the Team
  threshold and the outdoor Training amount (feature 003 FR-013a).
- **FR-031**: The overview MUST show the qualification deadline, the days left, and
  how many consenting riders qualify out of all consenting riders.
- **FR-032**: The overview MUST show every consenting rider by first name (feature
  004 FR-022), with a "View on Strava" link when two connected riders share a first
  name, in three groups: **Need a push** (FR-021's rule), **On track** (not
  qualified, not behind) and **Training goal reached** (qualifies, feature 003 FR-013). Tiles
  with each group's size MUST filter the list; "Need a push" is selected when the
  page opens on a phone, all riders on a desktop.
- **FR-033**: For each rider the overview MUST show Training and Team Rynke against
  their thresholds with the even pace marked, the amounts still missing (Training,
  Team, outdoor Training), marked when behind the even pace, and the breakdown of
  feature 003 FR-014a: distance, elevation, each team-event kind with attendance,
  corrections and the virtual-ride share.
- **FR-034**: The overview MUST list who qualified.
- **FR-035**: On wide screens the overview MUST be a table with one row per rider;
  on a phone, one card per rider with the breakdown folded away.

**Look**

- **FR-040**: Both views MUST follow feature 012's look: Rynkeby colours, the coin
  (front for Training, back for Team, mini coin below 32 px) and emoji in the copy, in
  light and dark mode, at 360 px width without horizontal scrolling.
- **FR-041**: Every figure in a graphic (peloton, sparkline, chart, bar) MUST also be
  available as text to assistive technology.
- **FR-042**: All text except the quotes MUST come from the i18n catalogs in German
  and English (feature 001 FR-028).

### Key Entities

- **Leaderboard row**: one consenting rider's accumulated Training and Team Rynke,
  overall and per week; no identity beyond "this is you".
- **Team totals**: the sums of all leaderboard rows, per week.
- **Quote**: a German sentence in one of two lists ("needs a push", "on track"),
  kept in a German-only list beside the i18n catalogs (FR-023).
- **Rider status** (organiser view): Need a push, On track or Training goal reached, worked
  out from the stored balance, the thresholds, the deadline and the day.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For synthetic teams, every place, total, weekly figure and group matches
  figures worked out by hand, and no rider without a current consent shows up in any
  of them.
- **SC-002**: No page shown to a rider who is not an organiser contains another
  rider's name, athlete ID, profile link, picture, threshold progress or
  qualification.
- **SC-003**: Opening either view starts no evaluation and no Strava request.
- **SC-004**: Both views work at 360 px width in both colour modes without
  horizontal scrolling.
- **SC-005**: Organisers can name the riders who need a push within a minute of
  opening the overview (owner's judgement).
- **SC-006**: Riders asked after a month say the leaderboard makes them want to ride
  more and the quotes make them smile (owner's judgement).

## Assumptions

- Features 003, 004, 011, 012 and 014 are in place; the overview uses 014's
  organiser check and navigation.
- Weeks run Monday to Sunday in Europe/Berlin, as in feature 009.
- The quotes are written in German by the project and ship as written; the owner
  may edit either list at any time without a spec change.
- The mock-up's figures are a synthetic sample season; real figures come from feature
  003's stored balances.
- Teams have tens of riders, not hundreds; no paging is needed.
