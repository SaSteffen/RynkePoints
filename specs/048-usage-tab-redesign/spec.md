# Feature Specification: Usage Tab Redesign

**Feature Branch**: `048-usage-tab-redesign`

**Created**: 2026-11-24

**Status**: Draft

**Issue**: #435. This feature settles every open point of the issue, and its pull
request completes it.

**Design draft**: the Claude Design canvas "RynkePoints Admin Usage"
(https://claude.ai/artifact/Ct6Z4crmMZDvdjqzatbqbc). Board 1 is the page with
something to look at, board 2 an opened figure, board 3 an opened Betrieb row,
board 4 the calm page. The page follows its look; the answers in its "Decided"
note are part of this spec.

**Input**: User description: "Redesign Admin › Nutzung (usage tab) following the Claude Design canvas https://claude.ai/artifact/Ct6Z4crmMZDvdjqzatbqbc. A list "Das braucht deinen Blick" on top gathers everything that needs a look (Kritisch at 95 %, Warnung at 80 %, Hinweis: a figure past its early threshold, the other team didn't answer, no device gets alerts; also marked routing days, Strava calls that don't add up, CPU marks, late re-checks), worst first, each row jumps to its figure; calm state "Alles im Rahmen" with one line. Header counts only figures (kritisch/Warnung/Hinweis); non-figure hints listed but not counted. Strava and Cloudflare figures become one grouped list per source (name, bar with marks at the Hinweis threshold, 80 % and 95 %, numbers, percentage); opening a row shows levels line, team split, history, Alle Tage. Rows keep a fixed order. The two Strava 15-minute rows hide on phone while at 0 % (note says so), always shown on desktop. Betrieb section: waiting queue, Strava-Aufrufe, Nachprüfung, Gateway-Routing, CPU time, each a row with one-line status, explanation inside the opened row; every row always shows. Alerts switch in its own row; "no device" under it and in the top list. Desktop two columns like Settings, phone one column with top list first; built from Settings' grouped-list pieces. New early level Hinweis: every figure gets a third level, threshold per group of figures set in code beside the limits (Strava daily, Strava 15-min, connected riders, Cloudflare daily counters, database storage), all 25 % for now; 80/95 unchanged; notifies like the other levels, once per figure, level and period; switch reads "Benachrichtigung bei Hinweis, Warnung und kritisch". A figure's Hinweis counts in the red number on the Admin tab in the navigation too (can be changed later if too much)."

## Context and terms

Admin › Nutzung (feature 025) has grown one section at a time: the "Alle Teams"
table, Strava, waiting for the Strava budget, Cloudflare, the ride re-check's
day table (feature 036), CPU time, gateway routing (feature 046) and Strava
calls (feature 047). Each section marks problems its own way and the summary at
the top counts only some of them, so an administrator can't see at a glance
whether anything needs a look, least of all on a phone. Push alerts start at
80 %, which is late for noticing that usage is rising.

This feature rebuilds the page around one question, "does anything need a
look?", and adds an early level so administrators hear about rising usage
sooner. It changes no recorded figure, no limit and no rule that marks a day.

- **Figure**: a value with a limit, shown as a percentage of it: Strava reads and
  all requests per day and per 15 minutes, connected riders, and Cloudflare's
  Worker requests, queue operations, database rows read and written per day and
  database storage.
- **Level**: how close a figure is to its limit. Fine; **Hinweis** from the
  figure's early threshold; **Warnung** from 80 %; **Kritisch** from 95 %. Only
  the highest reached level shows.
- **Early threshold**: where Hinweis starts. Set per group of figures that
  behave alike (FR-010).
- **Mark**: a level shown on the page: on a figure, on a CPU value (feature 025
  FR-043), or on a day of the re-check, routing or Strava-calls tables (their
  own rules, unchanged).
- **State hint**: something that needs a look but isn't a mark: another team
  didn't answer the usage exchange, or the administrator gets usage alerts on
  no device.
- **Betrieb**: the operations the app runs that have no single percentage:
  waiting for the Strava budget, Strava calls, the ride re-check, gateway
  routing, CPU time.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See at once whether anything needs a look (Priority: P1)

An administrator opens Admin › Nutzung, often on a phone. At the top, one list
"Das braucht deinen Blick" holds everything that needs a look, worst first, with
a count of the marks. When nothing does, the page says "Alles im Rahmen" in one
line instead.

**Why this priority**: This is the issue's core: today an administrator has to
scroll through every section to know whether anything is wrong.

**Independent Test**: In fake mode, set synthetic values so one figure is at
97 %, one at 85 %, one at 40 %, another team doesn't answer and the
administrator has notifications off. Open the page and check the list, its order
and its count; then set every value below its early threshold, both teams
answering and notifications on, and check the calm line.

**Acceptance Scenarios**:

1. **Given** marks and state hints exist, **When** the page opens, **Then** "Das
   braucht deinen Blick" comes first and lists every Kritisch, then every
   Warnung, then every Hinweis, then the state hints; each row names what it is
   about, its numbers or one line of explanation, and its percentage where it
   has one.
2. **Given** the list shows, **When** the administrator taps a row, **Then** the
   page goes to that figure, Betrieb row or setting, and a figure or Betrieb row
   opens.
3. **Given** a figure at Kritisch, one at Warnung, one at Hinweis, another team
   silent and no device, **When** the page opens, **Then** the head shows "1
   kritisch", "1 Warnung", "1 Hinweis"; the two state hints are listed but not
   counted.
4. **Given** no mark and no state hint, **When** the page opens, **Then** it
   shows "Alles im Rahmen" with one line saying no value reached its early
   threshold, every team answered and nothing waits, with the time of the
   figures; the list is gone.
5. **Given** a CPU value is marked today, or a re-check, routing or Strava-calls
   day is marked today or yesterday, **When** the page opens, **Then** it is a
   row in the list at its level and counts in the head.
6. **Given** the page is open, **When** the administrator presses "Jetzt
   aktualisieren", **Then** the recording runs as today (feature 025 FR-040) and
   the list shows the new state.

---

### User Story 2 - Hear early when usage rises (Priority: P1)

Every figure gets a third, earlier level, Hinweis, from 25 % for now. It shows on
the page like the other levels and sends a push alert like them, so an
administrator learns that usage is rising long before it gets tight.

**Why this priority**: It is what the administrator asked for ("notify early
when levels are increased"), and it works without the new layout.

**Independent Test**: With synthetic usage and a synthetic push service, take a
daily Cloudflare figure across 25 %, then 80 %, then 95 % in one day. Check one
notification per level, the Hinweis mark on the page, and that a second check
the same day sends nothing.

**Acceptance Scenarios**:

1. **Given** a recorded figure reaches its early threshold, **When** the next
   check runs, **Then** the team's administrators with usage alerts on get one
   notification naming the figure and its percentage, marked as a Hinweis, which
   opens Admin › Nutzung.
2. **Given** the Hinweis was sent, **When** the figure reaches 80 % and then 95 %
   in the same period, **Then** one Warnung and one Kritisch notification follow,
   as today.
3. **Given** a figure jumps from below its early threshold straight past 80 %,
   **When** the check runs, **Then** only the highest level reached is
   notified, as for 80 % and 95 % today.
4. **Given** a level was notified, **When** further checks run in the same
   period, **Then** nothing more is sent for it: per UTC day for daily figures,
   once for connected riders and storage.
5. **Given** a Strava 15-minute figure reaches 25 %, 80 % or 95 %, **When** the
   check runs, **Then** the page marks it but no notification is sent (feature
   025 User Story 5 scenario 4 stays).
6. **Given** a figure is opened, **When** the administrator reads it, **Then** it
   says its levels, for example "Hinweis ab 25 %, Warnung ab 80 %, kritisch ab
   95 %.", and its bar shows a mark at each.
7. **Given** the alerts switch, **When** the administrator reads it, **Then** it
   says "Benachrichtigung bei Hinweis, Warnung und kritisch", and turning it off
   stops Hinweis notifications as it stops the others.

---

### User Story 3 - Read the figures at a glance (Priority: P2)

Below the list, Strava's and Cloudflare's figures are one compact list each: per
row the name, a bar with the three level marks, the numbers, the percentage and
its mark. Opening a row shows what the figure card shows today.

**Why this priority**: It replaces the long "Alle Teams" table and figure cards,
which make the page long, but the page is usable without it once Story 1 exists.

**Independent Test**: In fake mode, open the page at phone and desktop width,
check each row against the recorded values, open one row and check its levels
line, team split, history and "Alle Tage" link.

**Acceptance Scenarios**:

1. **Given** the page opens, **When** the administrator looks at Strava, **Then**
   the rows are, in this order: reads per day, all requests per day, reads per 15
   minutes, all requests per 15 minutes, connected riders; Cloudflare's rows are
   Worker requests, queue operations, rows read, rows written, storage. The order
   never changes with the values.
2. **Given** a row, **When** it is closed, **Then** it shows the name, the level
   mark if any, the bar with marks at the early threshold, 80 % and 95 %, "<used>
   von <limit>", one short line on whose figure it is (this team and another
   team, only this team, or the whole account), and the percentage.
3. **Given** a row is opened, **When** the administrator reads it, **Then** it
   shows the levels line, how the figure splits between this team and the other
   teams (without naming them), the time of the figure, the history graph with
   the limit line, and "Alle Tage", as the figure card does today.
4. **Given** a phone and a 15-minute figure at 0 %, **When** the page opens,
   **Then** that row is hidden and the note under Strava says the 15-minute
   values are hidden at 0 %; above 0 % the row shows.
5. **Given** a desktop width, **When** the page opens, **Then** both 15-minute
   rows show, whatever their value.
6. **Given** the Strava group, **When** the page opens, **Then** its head says the
   figures are today's (UTC); the Cloudflare group's head says the time of the
   figures; the notes under each group keep today's explanations (15-minute
   values aren't shared between teams; Cloudflare's figures are approximate and
   not split by team).

---

### User Story 4 - Operations in short rows (Priority: P2)

The sections without a single percentage become rows under "Betrieb": waiting
for the Strava budget, Strava-Aufrufe, Nachprüfung der Fahrten, Gateway-Routing,
CPU-Zeit der Worker. Each says its state in one line; its table and explanation
are inside the opened row.

**Why this priority**: These sections take most of today's page length; folding
them away keeps the page short without hiding anything.

**Independent Test**: In fake mode, open the page, check each Betrieb row's one
line against the data, open each row and check it holds today's table and
explanation.

**Acceptance Scenarios**:

1. **Given** the page opens, **When** the administrator looks at Betrieb, **Then**
   all five rows show, in the order above, even when a row has nothing to say.
2. **Given** a row, **When** it is closed, **Then** its one line says the
   current state: how many entries wait and when they'll be done or "Nichts
   wartet"; today's calls of this team and how many were held back; the re-check
   allowance, active riders and whether it ran; whether routing has figures yet;
   whether CPU has figures yet, with the 10 ms limit.
3. **Given** a row holds a mark today (or for day tables, today or yesterday),
   **When** it is closed, **Then** it shows the mark like a figure row.
4. **Given** a row is opened, **When** the administrator reads it, **Then** it
   shows today's section content unchanged: the tables, the picked day's
   breakdown for Strava calls, the explanations.
5. **Given** a link to a day of the Strava-calls table, **When** it is followed,
   **Then** the Strava-Aufrufe row opens on that day's breakdown, as today.

---

### User Story 5 - The page counts in the navigation (Priority: P3)

The Admin tab in the bottom navigation shows a red number when marks need a
look, like the Orga tab shows open requests, so an administrator sees it from
any page.

**Why this priority**: It extends the early warning beyond the usage page, but
the page and the alerts already work without it.

**Independent Test**: As an administrator in fake mode, set one figure at
Hinweis and one CPU value at Warnung; open any page and check the Admin tab
shows 2 and that the screen reader label says so; set them back and check the
number is gone. As a non-administrator, check there is no Admin tab and no
number.

**Acceptance Scenarios**:

1. **Given** marks counted in the head of "Das braucht deinen Blick", **When** an
   administrator opens any page, **Then** the Admin tab shows the same number,
   Hinweis included.
2. **Given** only state hints, **When** an administrator opens any page, **Then**
   the Admin tab shows no number.
3. **Given** the Admin pages' tab switch, **When** it shows, **Then** "Nutzung"
   carries the same number.
4. **Given** the number shows, **When** a screen reader reads the tab, **Then** it
   says how many things need a look, not only the number.

---

### Edge Cases

- **Two marks on one Betrieb row** (for example a routing day today and one
  yesterday): the row shows the highest level; the list holds one row per
  marked day, each counted.
- **A figure has no value yet** (no recording, Cloudflare unreachable): its row
  says so instead of a percentage and carries no mark; nothing in the list.
- **Another team doesn't answer**: its share is missing in every figure; the
  list says so once as a state hint; the figures' lines say "Anderes Team:
  keine Zahlen".
- **The early threshold is at or above 80 % for a group**: that group has no
  Hinweis level; its bar shows no early mark.
- **Over 100 %**: the percentage shows the real value, the bar stays full.
- **An administrator who isn't an organiser**: sees Admin and its number as
  today; the Orga number is unaffected.
- **Rows change between closed and opened**: an opened row stays open on
  "Jetzt aktualisieren".
- **Calm page with a mark on a day older than yesterday**: the page is calm; the
  day stays marked inside its opened Betrieb row.

## Requirements *(mandatory)*

### Functional Requirements

**The list at the top (User Story 1)**

- **FR-001**: The page MUST start with "Das braucht deinen Blick" whenever any
  mark or state hint exists, listing Kritisch, then Warnung, then Hinweis marks,
  then state hints. Within a level, rows follow the page's order.
- **FR-002**: The list MUST include every figure's mark, today's CPU marks of
  this team's Worker, the other teams' together and the gateway, and the marked
  days of the re-check, routing and Strava-calls tables of today and yesterday
  (UTC).
- **FR-003**: Each row MUST link to what it is about; following it MUST open
  that figure or Betrieb row. The no-device hint links to the device settings.
- **FR-004**: The head MUST count the marks by level ("n kritisch", "n Warnung",
  "n Hinweis"/"n Hinweise"), leaving out levels with none. State hints MUST NOT
  be counted.
- **FR-005**: With no mark and no state hint, the page MUST instead show "Alles
  im Rahmen" with one line and the time of the figures.
- **FR-006**: "Jetzt aktualisieren" MUST sit in the head of either state and
  work as feature 025 FR-040.

**The early level (User Story 2)**

- **FR-007**: Every figure MUST have the level Hinweis from its early threshold
  up to 80 %. Warnung (80 %) and Kritisch (95 %) stay unchanged.
- **FR-008**: Each recorded figure (not the 15-minute ones) MUST send a Hinweis
  notification like Warnung and Kritisch: at most one per figure, level and
  period, only the highest new level, no rider data, opening Admin › Nutzung,
  under the administrator's alerts switch (feature 025 FR-035 to FR-039).
- **FR-009**: The notification MUST say it is a Hinweis, name the figure and its
  percentage.
- **FR-010**: The early threshold MUST be set per group, in the code beside the
  limits, never on the page: Strava per day (reads, all requests), Strava per
  15 minutes (reads, all requests), connected riders, Cloudflare per day (Worker
  requests, queue operations, rows read, rows written), database storage. Every
  group starts at 25 %. Changing one goes through a pull request.
- **FR-011**: The alerts switch MUST read "Benachrichtigung bei Hinweis, Warnung
  und kritisch"; its explanation names the three levels.
- **FR-012**: CPU values and day tables MUST keep their own rules (feature 025
  FR-043, features 036, 046, 047); they have no Hinweis.

**Figures (User Story 3)**

- **FR-013**: Strava's and Cloudflare's figures MUST each be one grouped list in
  the fixed order of User Story 3 scenario 1; the "Alle Teams" table and the
  separate figure cards go.
- **FR-014**: A closed row MUST show name, mark, bar with marks at the early
  threshold, 80 % and 95 %, numbers, whose figure it is, and the percentage. A
  mark MUST hold its word, never colour alone.
- **FR-015**: An opened row MUST show the levels line, the team split without
  naming other teams (feature 026 FR-023), the time of the figure, the history
  with the limit line and "Alle Tage".
- **FR-016**: On a phone, a 15-minute row at 0 % MUST be hidden and the note
  under Strava MUST say so; on a desktop both rows always show.

**Betrieb (User Story 4)**

- **FR-017**: Waiting for the Strava budget, Strava-Aufrufe, Nachprüfung der
  Fahrten, Gateway-Routing and CPU-Zeit der Worker MUST each be one row under
  "Betrieb", always shown, with a one-line state and, when marked, the highest
  mark of today (and for day tables, of today and yesterday).
- **FR-018**: An opened Betrieb row MUST hold that section's current content
  unchanged; deep links to a Strava-calls day MUST still open its breakdown.
- **FR-019**: The alerts switch MUST be its own row under "Nutzungshinweise";
  when the administrator has notifications on no device, it says so under the
  switch and in the list.

**Navigation (User Story 5)**

- **FR-020**: For administrators, the Admin tab in the navigation and "Nutzung"
  in the Admin tab switch MUST show the count of FR-004 as a red number when it
  is above 0, with a label that says what it counts.
- **FR-021**: Computing the number MUST NOT call Strava or Cloudflare; it uses
  the recorded figures and the app's own counts, like the page (feature 025
  FR-027).

**Layout and general**

- **FR-022**: On a desktop the page MUST show two columns like Settings: Strava
  and Cloudflare left, Betrieb and Nutzungshinweise right, the list across the
  top. On a phone, one column: the list, Strava, Cloudflare, Betrieb,
  Nutzungshinweise.
- **FR-023**: The page MUST reuse Settings' grouped lists, rows and panels; the
  bar's marks are the only new piece.
- **FR-024**: All new and changed text MUST be in the catalogs in all ten
  languages, German as the source.
- **FR-025**: No page, notification or number shows another team's name or any
  rider data (feature 026 FR-023, Principle I).

### Key Entities

- **Early threshold**: a percentage per group of figures, set in code; 25 % for
  every group at first.
- **Level**: fine, Hinweis, Warnung, Kritisch, per figure; Warnung and Kritisch
  for CPU values and marked days.
- **Sent notification**: as today one per team, figure, level and period, now
  with Hinweis as a level too.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can tell from the first screen on a phone, without
  scrolling, whether anything needs a look and how much.
- **SC-002**: Every mark on the page appears in the list at the top and is one
  tap from its details.
- **SC-003**: A figure that crosses 25 % reaches administrators with alerts on
  within one hourly check, once per period.
- **SC-004**: The closed page on a phone is at most half as long as today's with
  the same data.
- **SC-005**: The number on the Admin tab always equals the count in the list's
  head.

## Assumptions

- Feature 025's figures, limits, recording, alert periods and switch stay; only
  their presentation and the added level change.
- The 15-minute figures keep sending no notification: the budget logic works
  near those limits by design during imports. They are marked on the page and
  counted like any figure.
- "Only figures count" (canvas decision) is read as: every mark counts (figures,
  CPU values, marked days); only state hints don't.
- Marked days older than yesterday don't need a look any more: they stay marked
  in their tables but leave the list, the count and the navigation number.
- Day-table marks keep sending no push alert, and a day keeps having no
  Kritisch, as their features define. The issue asked whether they should; this
  feature leaves them as they are. One way of marking across the page (one list,
  same words and colours) answers the issue's first point.
- The Admin tab has no count today; this feature adds one, in the same style as
  the Orga tab's. If it shows too often, the Hinweis may stop counting there
  later.
- Phone means narrower than Settings' two-column breakpoint.
- No consent or privacy notice change: no new data is read or kept.
