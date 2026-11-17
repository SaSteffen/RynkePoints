# Feature Specification: Team Europe's Own Rules

**Feature Branch**: `039-europe-rules`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Team Europe's own rules (decided in a call with Team Europe,
2026-11-17). 1) Europe's Strava club is https://www.strava.com/clubs/2292744 (replaces the
STRAVA_CLUB_ID placeholder; Hamburg's otherClubIds gains it for the one-team-at-a-time notice).
2) A minimum ride length becomes a Rynke rule value: Europe 25 km, Hamburg 0 km (no change to
Hamburg's rules or results). A shorter ride doesn't count, like any ride failing a rule, and the
rider sees why. 3) Team Europe has no Team Rynke and no team events at all: no Team Rynke
threshold, gauge, ranking view or coin side meaning; organisers record no events (neither the three
team-event kinds nor Tour de Paris days); badges that can only be earned through events (team
events, technique trainings, tour-day badges, big training, attendances) don't exist for Europe.
Team badges earned in other ways (team distance, elevation, running, Training Rynke, team
surprises) stay. Hamburg unchanged. Differences are team data (src/teams/<id>.ts), never a branch
in code." Added by the maintainer while specifying: "It is extremely important that these changes
we make for Europe have no side effects for Hamburg." Added after the first implementation: "Europe
might not want the requirement for only having a part of the rides virtual. So: we should have a
setting that says how many of the required minimum amount of Training Rynke must be from outside
rides. If that is 0, then that requirement goes away completely. For now, let's change to a third.
Hamburg is 2/3, right? The setting must be a full number of Rynke."

## Overview

Feature 026 brought Team Rynkeby Europe into the app with Hamburg's rules, events and badges as
placeholders. In a call on 2026-11-17, Team Europe set its own rules:

- Its Strava club is club 2292744.
- A ride counts for Rynke only if it is at least **25 km** long.
- It has **no Team Rynke and no team events** at all. Europe is a distributed team without regular
  team rides; its riders qualify through Training Rynke alone.
- Only **84** of its 250 Training Rynke, a third, must come from outside virtual rides, instead of
  Hamburg's 167 (at most a third virtual, so 2/3 of 250, rounded up).

Hamburg keeps everything as it is. Its minimum ride length is 0 km, which is today's behaviour. Its
virtual-ride rule becomes the same whole number of Training Rynke it already asks for, 167; the one
visible change is the onboarding tour's sentence about it (User Story 6).

Terms: a **counting ride** is a ride whose result counts for Rynke, as in feature 003. An
**event-only badge** is a badge that can only be earned through recorded events: every badge of
the team events, technique, Tour de Paris, big training and attendances categories.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hamburg stays exactly as it is (Priority: P1)

A Hamburg rider, organiser or maintainer sees no change at all after the release: the same Rynke,
the same counting rides, gauges, rankings, events, badges, rules page, handout, notifications and
season album, in every language.

**Why this priority**: Hamburg is the team using the app every day. Its riders' Rynke decide who
rides to Paris, so a side effect there costs trust that Europe's changes can't make up for.

**Independent Test**: Run Hamburg in fake mode before and after the change on the same day of the
season and compare every rider page, the organiser pages and the stored results; run every existing
Hamburg test unchanged.

**Acceptance Scenarios**:

1. **Given** Hamburg's stored results before the release, **When** the new version is deployed and
   the daily work has run, **Then** no Hamburg result has changed, and no Hamburg rider has been
   re-evaluated or notified because of the release.
2. **Given** a Hamburg ride of 5 km that passes every rule, **Then** it counts, as today.
3. **Given** a Hamburg page of any kind, **Then** it shows no new text, value or control from this
   feature; Hamburg's rules page and handout don't mention a minimum ride length.

---

### User Story 2 - Europe's riders join through their own club (Priority: P1)

A Team Europe rider who is in Strava club 2292744 connects and is let in. A rider who is in both
Europe's and Hamburg's club sees the one-team-at-a-time notice on either team's app.

**Why this priority**: Without the club, no Europe rider can join.

**Independent Test**: In fake mode, connect a sample rider in club 2292744 to Europe and one in both
clubs to each team.

**Acceptance Scenarios**:

1. **Given** a rider in club 2292744 only, **When** they connect to Europe's app, **Then** they are
   let in as a member.
2. **Given** a rider in club 2292744 only, **When** they connect to Hamburg's app, **Then** they are
   refused as a non-member, as any rider outside Hamburg's clubs is today.
3. **Given** a rider in both teams' clubs, **When** they connect to either app, **Then** they see the
   one-team-at-a-time notice (feature 026 FR-012).

---

### User Story 3 - Short rides don't count for Europe (Priority: P1)

A Team Europe rider's ride of 18 km, which passes every other rule, doesn't count. On the rider page
it is listed with the reason, in the rider's language, as other rides that don't count are: it is
shorter than 25 km. A 25 km ride counts.

**Why this priority**: It is Europe's main rule; riders need to know why a ride is missing.

**Independent Test**: In Europe's fake mode, give a sample rider rides of 24.9 km, 25.0 km and
60 km and check the rider page, the Training Rynke and the ride figures.

**Acceptance Scenarios**:

1. **Given** a Europe ride of 24.9 km, **Then** it earns no Rynke, is shown as not counting with the
   reason "shorter than 25 km", and doesn't enter the ride figures (feature 032), the badges or
   the team's sums.
2. **Given** a Europe ride of exactly 25.0 km that passes every other rule, **Then** it counts.
3. **Given** a Europe ride of 20 km that also fails another rule (too slow), **Then** both reasons
   are shown.
4. **Given** Europe's rules page and handout, **Then** they state the 25 km minimum.

---

### User Story 4 - Europe has no Team Rynke and no events (Priority: P1)

A Team Europe rider sees only Training Rynke: one goal, one gauge, one ranking view. Nothing in
Europe's app mentions Team Rynke, team events, attendance or the Tour de Paris days. A rider
qualifies once they have the Training Rynke threshold and enough of them from outside virtual rides. Europe's
organisers have no event pages, no reports to answer and corrections in Training Rynke only.

**Why this priority**: Europe can't earn Team Rynke at all, so showing it would leave every rider
"not qualified" forever.

**Independent Test**: Walk through every rider and organiser page of Europe's fake mode, in English
and one other language, and look for Team Rynke, events, attendance and tour days.

**Acceptance Scenarios**:

1. **Given** a Europe rider with the Training Rynke threshold reached and enough of them from outside
   virtual rides, **Then** they are shown as qualified; nothing says Team Rynke are missing.
2. **Given** any Europe rider page (home, Rynke, Team, badges, help, onboarding tour, consent and
   privacy texts, notifications), **Then** it shows no Team Rynke, no event, no attendance and no
   Tour de Paris day, and offers no way to report or join an event.
3. **Given** Europe's Team tab, **Then** it shows only the Training view (no Team Rynke view or
   ranking).
4. **Given** any Europe organiser page, **Then** it offers no event pages, event reports or
   attendance, shows no Team Rynke column or figure, and corrections take Training Rynke only.
5. **Given** Europe's coin, **Then** its front and back show wherever the app shows them today;
   the back is art only, as on Hamburg's coin, and nothing about the coin changes.

---

### User Story 5 - Europe's badges without event-only badges (Priority: P2)

A Team Europe rider's badges page lists every badge except the event-only ones. The team badges
earned in other ways (team distance, elevation, running, Training Rynke, the team surprises) stay.

**Why this priority**: Event-only badges could never be earned in Europe; they would sit there
locked forever.

**Independent Test**: Open Europe's badges page in fake mode and count the badges; open Hamburg's and
check it lists all of them as today.

**Acceptance Scenarios**:

1. **Given** Europe's badges page, **Then** no badge of the team events, technique, Tour de Paris,
   big training or attendances categories is shown, earned or locked, nor a hint for one
   (feature 034).
2. **Given** Europe's badges page, **Then** every other badge is shown as today.
3. **Given** Hamburg's badges page, **Then** it lists every badge as today.

---

### User Story 6 - Europe needs only a third from outside virtual rides (Priority: P1)

A team sets how many of its Training Rynke threshold must come from anything but virtual rides
(rides outdoors, events, corrections), as a whole number of Training Rynke. Europe needs 84, a third
of 250, rounded up; Hamburg keeps the 167 it needs today. A team that sets 0 has no such requirement
at all, and nothing about it shows.

**Why this priority**: Europe is a distributed team whose riders train indoors more; Hamburg's
"at most a third virtual" would keep riders out who ride enough.

**Independent Test**: In Europe's fake mode, a rider with 80 Training Rynke outdoors and 180 virtual
isn't qualified (4 missing outdoors); with 90 outdoors and 160 virtual they are. On Hamburg, the
same results as before for every sample rider.

**Acceptance Scenarios**:

1. **Given** a Europe rider with 250 Training Rynke, 84 of them from outside virtual rides, **Then**
   they are qualified; with 83, 1 Training Rynke outdoors is missing.
2. **Given** a Hamburg rider, **Then** they need 167 Training Rynke from outside virtual rides, as
   today, and every stored result stays as it is.
3. **Given** a team whose setting is 0, **Then** riders qualify without any Training Rynke from
   outside virtual rides, and no gauge, missing amount, curve, tour step, organiser figure, reason
   or pace check about it shows.
4. **Given** Hamburg's onboarding tour step about virtual rides, **Then** it no longer says "at most
   1/3"; it still says "at least 167 of 250" (maintainer, 2026-11-17: a whole number has no share
   to name).
5. **Given** Europe's handout, **Then** it states the 84.

---

### Edge Cases

- **Exactly 25 km**: counts; the minimum is inclusive. The ride's distance as Strava reports it is
  compared, with no rounding up.
- **A ride shortened by a crop**: a rider who crops a ride on Strava below 25 km loses it once the
  ride is re-checked (feature 036); a crop never makes a short ride count, so the length reason is
  not one of the reasons a crop can fix.
- **Virtual rides**: the minimum applies to virtual rides too; only counting rides enter the Training
  Rynke from outside virtual rides.
- **Badges and short rides**: a ride below 25 km doesn't count, so it doesn't count for badges that
  look at counting rides either (distance, winter days, surprises). Runs and swims are not rides and
  are unaffected.
- **"Sunday outing" team surprise**: it asks for ten riders out on a Sunday without a team event;
  with no events in Europe, every Sunday qualifies. It stays.
- **Rule history**: Europe gets its own rule history, starting with the 25 km minimum and no Team
  Rynke. Europe has no production riders yet, so no stored result needs explaining with Hamburg's
  earlier versions. Europe's sandbox is reseeded after the release.
- **Seasonal or onboarding text written for both teams** that mentions Team Rynke or events must
  have a Europe variant without them, so no team sees text about something it doesn't have.

## Requirements *(mandatory)*

### Functional Requirements

**No side effects for Hamburg**

- **FR-001**: Everything Hamburg's riders, organisers or maintainers see or receive MUST stay as it is: Rynke,
  counting rides and their reasons, gauges, rankings, events, badges, hints, rules page, rules
  handout, notifications, season album and every text, in every language. The one exception is
  the onboarding tour's sentence about virtual rides (FR-020).
- **FR-002**: Hamburg's rule version MUST NOT change, and Hamburg riders MUST NOT be re-evaluated,
  re-notified or have a stored result changed because of this feature.
- **FR-003**: Every difference between the teams MUST be team data (feature 026 contracts/
  team-data.md), never a branch on the team in code; a team's data that leaves the new values at
  Hamburg's settings MUST behave exactly as today.
- **FR-004**: Every existing Hamburg test MUST pass unchanged; new tests MUST show both teams'
  behaviour side by side for the minimum ride length, Team Rynke and events.

**Club**

- **FR-005**: Europe's Strava club MUST be club 2292744, for production and the Europe sandbox
  alike; Europe keeps no extra clubs.
- **FR-006**: Hamburg's list of other teams' clubs MUST name club 2292744, so a rider in both clubs
  sees the one-team-at-a-time notice on Hamburg's app too (feature 026 FR-012).

**Minimum ride length**

- **FR-007**: The Rynke rules MUST have a minimum ride length: Europe 25 km, Hamburg 0 km.
- **FR-008**: A ride shorter than its team's minimum MUST NOT count, like a ride failing any other
  rule, and MUST be shown with its reason, naming the minimum, in all ten languages.
- **FR-009**: Europe's rules page and English rules handout MUST state the minimum; Hamburg's MUST
  NOT mention one.

**No Team Rynke and no events in Europe**

- **FR-010**: Whether a team has Team Rynke and team events MUST be team data; Europe has neither,
  Hamburg has both.
- **FR-011**: A team without Team Rynke MUST qualify riders on Training Rynke and the Training Rynke
  needed from outside virtual rides alone, and MUST NOT show Team Rynke anywhere a rider or organiser can see: gauges, totals,
  rankings, the Team tab's Team Rynke view, notifications, celebrations, help texts, the onboarding
  tour, the season album, the organiser overview and corrections.
- **FR-012**: A team without events MUST offer no event kinds to its organisers (neither the three
  team-event kinds nor Tour de Paris days), no event or report pages, no "Events" navigation for
  riders or organisers, and no texts about events or attendance.
- **FR-013**: Europe's consent and privacy texts MUST NOT describe event, attendance or Team Rynke
  data, since Europe processes none; dropping a use of data is a minor revision for riders (no
  re-ask).
- **FR-014**: A team without events MUST NOT show event-only badges (team events, technique, Tour de
  Paris, big training, attendances) or their hints anywhere; every other badge, personal and team,
  MUST stay.

**Training Rynke from outside virtual rides**

- **FR-017**: The Rynke rules MUST say, as a whole number of Training Rynke from 0 to the Training
  Rynke threshold, how many must come from anything but virtual rides: Europe 84, Hamburg 167.
  It replaces the share of virtual rides.
- **FR-018**: With 0, the requirement MUST go away completely: riders qualify without it, and no
  gauge, missing amount, progress curve or column, onboarding tour step, organiser figure, reason
  or pace check about it shows.
- **FR-019**: Hamburg's 167 MUST give exactly today's results: no new rule version, no
  re-evaluation, no stored result changed.
- **FR-020**: The onboarding tour's sentence about virtual rides MUST name the whole number and the
  threshold ("at least 167 of 250") and no longer a share, for both teams.
- **FR-021**: Europe's rules handout MUST state the 84; Hamburg's stays as it is (it already names
  167).

**Checking**

- **FR-015**: A maintainer MUST be able to see all of the above for both teams side by side in
  local fake mode, with sample rides below and above 25 km for Europe.
- **FR-016**: Europe's sample riders and the sandbox's data MUST contain no events, attendance or
  Team Rynke.

### Key Entities

- **Rynke rules**: gains a minimum ride length; the share of virtual rides becomes a whole number of
  Training Rynke needed from outside them; each team has its own rule history.
- **Team data**: says whether the team has Team Rynke and events; Europe's says neither, its club is
  2292744, and Hamburg's other clubs list it.
- **Ride result**: gains the reason "shorter than the minimum".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the release and one daily run, 0 Hamburg results have changed, 0 Hamburg riders
  have been re-evaluated or notified because of it, and Hamburg's pages in fake mode are identical
  to before on the same day of the season.
- **SC-002**: A rider in club 2292744 can connect to Europe's app; a rider in both clubs sees the
  one-team-at-a-time notice on both apps.
- **SC-003**: 100% of Europe's rides under 25 km show as not counting with the length reason, and 0
  of them add Rynke, ride figures or badge progress.
- **SC-004**: A walk through every Europe rider and organiser page in fake mode, in English and one
  more language, finds 0 mentions of Team Rynke, team events, attendance or tour days, and 0
  event-only badges.
- **SC-005**: A Europe rider with the Training Rynke threshold and 84 of them from outside virtual
  rides is shown as qualified.
- **SC-006**: With the setting at 0, a walk through a rider's and an organiser's pages finds 0
  mentions of Training Rynke needed from outside virtual rides.

## Assumptions

- Europe has no production riders or stored results yet (its database is still a placeholder), so
  it can start with its own rule history without migrating anything.
- Europe's training period, the days its Rynke count, is 1 January to 30 June (maintainer,
  2026-11-17): `SEASON_START_DATE` 2027-01-01 and `QUALIFICATION_DEADLINE` 2027-06-30 in its block
  and its sandbox's. Its controller, contact and other placeholders stay as they are.
- The Training Rynke threshold, distance and elevation steps and every other rule value stay
  Hamburg's for Europe until Team Europe decides otherwise.
- The coin's back stands for nothing on either team (maintainer, 2026-11-17); both sides keep
  showing wherever they show today. Only the Team Rynke and event functions go.
- The minimum compares the ride's distance as Strava reports it, in kilometres, without rounding.
- Europe's rules handout is regenerated from its Markdown source; Hamburg's handout is not touched.
- "A third" for Europe is 84: 83⅓ rounded up, as Hamburg's 2/3 (166⅔) is 167 (maintainer,
  2026-11-17).
