# Feature Specification: CPU Median Over the Season

**Feature Branch**: `049-cpu-median-graph`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "CPU time median over the season on Admin › Nutzung (usage tab), CPU time row. Cloudflare already reports the median CPU time next to the slowest 1 in 100 runs; record the daily median per owner (this team, the other teams, the gateway; highest across an owner's Workers, like the slowest runs' value) alongside the existing daily value. Show a graph covering the current season (1 Sep – 31 Aug): one point per week, each week's value the highest daily median of that week (max strategy); this team, the other teams and the gateway all in the same graph, as separate lines, with the 10 ms CPU limit for reference. Weeks without records are gaps, never zero. The 30-day table stays. History starts when recording starts (a one-time backfill task the maintainer runs on their computer, as far back as Cloudflare keeps data; must only need to run once). The stored data only gains a value, nothing existing changes. All admin text in the ten catalogs."

## Context and terms

Admin › Nutzung shows, in its CPU time row (Betrieb, feature 048), a table of the
last 30 days: per day and owner, the CPU time the slowest 1 in 100 runs reached
and the runs cut off (feature 025 User Story 6). That shows the outliers on a
given day. It doesn't show whether the Workers as a whole are getting heavier
over the season, as more riders, rides and pages come in. The typical run's CPU
time shows that, and Cloudflare reports it for every Worker and day next to the
figure we already record.

This feature records that typical value and draws it over the season. It changes
no mark, no alert and no existing figure.

- **Owner**: whose Worker a run belongs to: this team, the other teams together,
  or the gateway, as in the CPU table (feature 025 FR-042).
- **Median CPU time**: the CPU time half of an owner's runs on a day stayed under.
  An owner with several Workers gets the highest of their medians.
- **Slowest runs' CPU time**: the value recorded today, the CPU time the slowest
  1 in 100 runs reached.
- **Week value**: for an owner and a week, the highest median CPU time of the
  week's recorded days. It tells "how heavy did the typical run get at worst
  this week", not the median of all the week's runs.
- **Season**: 1 September to 31 August, the same for every team.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See whether the typical run is getting heavier (Priority: P1)

An administrator opens the CPU time row on Admin › Nutzung. Above the 30-day
table, one graph shows the current season week by week: a line for this team's
Worker, one for the other teams and one for the gateway, each at its week value.
They see at a glance whether any line climbs over the season and how far it is
from the 10 ms limit, and touching or hovering over a week gives that week's three
values.

**Why this priority**: It is the feature. The daily median alone, without the graph,
is a number nobody looks at.

**Independent Test**: With synthetic recorded days across several weeks of the
season for all three owners, open the CPU time row and check the graph's lines,
week values, gaps and the values shown for a week.

**Acceptance Scenarios**:

1. **Given** recorded median CPU times for this team, the other teams and the
   gateway over several weeks of the current season, **When** the administrator
   opens the CPU time row, **Then** one graph shows three lines over the whole
   season, one point per week, each at the highest daily median of that week.
2. **Given** a week where this team's medians were 1.1, 1.4 and 2.0 ms on its
   recorded days, **When** the graph is drawn, **Then** this team's point for that
   week is at 2.0 ms.
3. **Given** a week with no recorded day for the gateway, **When** the graph is
   drawn, **Then** the gateway's line has a gap there; it never drops to zero.
4. **Given** today is in November, **When** the graph is drawn, **Then** it still
   spans September to August, the weeks still to come empty, so the administrator
   sees where in the season they are.
5. **Given** the administrator hovers over or taps a week, **When** the graph shows
   its values, **Then** they read the week's dates and the three owners' week values
   in milliseconds, "no record" for an owner without one.
6. **Given** two other teams with medians of 1.2 and 1.8 ms on a day, **When** that
   day is recorded, **Then** "other teams" holds 1.8 ms for that day, without either
   team's name.

---

### User Story 2 - The table shows the median next to the slowest runs (Priority: P2)

The 30-day table stays. Each cell now shows the day's median CPU time beside the
slowest runs' CPU time and the cut-off runs, so the exact daily figures behind the
graph are readable, also with a screen reader.

**Why this priority**: The graph is a picture; the table carries the numbers. It's
also the readable fallback for the graph.

**Independent Test**: With synthetic recorded days, open the CPU time row and check
each cell's three figures, and that a day recorded before this feature shows its
other figures without a median.

**Acceptance Scenarios**:

1. **Given** a recorded day with a median of 1.4 ms, slowest runs at 7.8 ms and 0 of
   1,234 runs cut off, **When** the table is shown, **Then** the cell reads the
   median, the slowest runs' value and the cut-off runs.
2. **Given** a day recorded before this feature, **When** the table is shown,
   **Then** its cell shows the slowest runs' value and cut-off runs as today, with
   no median and no zero in its place.

---

### User Story 3 - Fill the earlier part of the season once (Priority: P3)

When the feature goes live, the season is already under way and no median has
been recorded. The maintainer runs a one-time fill task on their own computer,
once per team, after the release. It asks Cloudflare for the season's earlier
medians, as far back as Cloudflare still answers, and adds them to that team's
recorded days, so the graph doesn't start empty. The app itself gets no fill
logic.

**Why this priority**: Without it the graph fills from the release on, which is
enough for the following seasons. It only helps the first one.

**Independent Test**: Against the local database with recorded days lacking a
median and a synthetic Cloudflare answer, run the task and check the medians are
filled in, nothing else changes, and a second run changes nothing.

**Acceptance Scenarios**:

1. **Given** recorded days of the current season without a median, and Cloudflare
   still holds some of them, **When** the maintainer runs the task for a team,
   **Then** those days gain their median; their other figures stay as recorded.
2. **Given** a day of the season that Cloudflare no longer holds, **When** the task
   has run, **Then** that day stays without a median and the graph shows a gap.
3. **Given** the task has already run, **When** it runs again, **Then** it changes
   nothing: a median already recorded, by the task or the hourly recording, is never
   overwritten. Running it twice is harmless, so it needs no guard against it.
4. **Given** the task is started without saying which team and whether the local or
   the production database, **When** it starts, **Then** it refuses and says what's
   missing. Without the production choice it touches only the local database.
5. **Given** the task runs, **When** it is done, **Then** it reports per owner how
   many days gained a median and the first and last day Cloudflare answered for.

### Edge Cases

- **Start of the season**: on 1 September the graph is a new, empty season; the
  previous season isn't carried over. Its days stay stored as long as history is
  kept (13 months) but aren't drawn.
- **Week boundaries**: weeks run Monday to Sunday by UTC day. The season's first and
  last weeks are cut at 1 September and 31 August and hold only their days in the
  season.
- **The week under way**: its value is the highest median of its days so far, and
  can rise until the week ends.
- **Today and yesterday change**: today's median is replaced on each recording and
  yesterday's corrected, like the other CPU figures; the week value follows.
- **No median recorded yet in the season**: the graph area says so in one line
  instead of drawing empty lines; the table shows as before.
- **Low values**: medians are usually a small share of the 10 ms limit. The graph is
  scaled to its values so changes stay visible; the limit is drawn as a line only
  when the scale reaches it, and is otherwise named in the line under the graph.
- **A Worker of no team** (such as a sandbox) is left out, as for the other CPU
  figures.
- **Cloudflare unavailable**: no median is recorded for that run; the graph shows
  what is recorded and the existing "unavailable" notice of the CPU row applies.

## Requirements *(mandatory)*

### Functional Requirements

**Recording**

- **FR-001**: The hourly recording MUST keep, per UTC day and owner, the median CPU
  time of that owner's runs, next to the slowest runs' CPU time, runs and cut-off
  runs of feature 025 FR-041. For an owner with several Workers it MUST keep the
  highest median of them. Today's value is replaced on each recording, yesterday's
  corrected.
- **FR-002**: Days recorded before this feature MUST keep all their figures and
  have no median, never a zero. The version deployed before this feature MUST keep
  working while the new one is rolled out.
- **FR-003**: The median MUST come from the same request as the other CPU figures,
  so its failure never touches the other Cloudflare figures (feature 025 FR-045).
- **FR-004**: The median MUST be kept as long as the other usage history (13
  months) and removed with it.

**Graph**

- **FR-005**: The CPU time row MUST show, above the 30-day table, one graph of the
  current season with one line each for this team, the other teams together and the
  gateway.
- **FR-006**: Each line MUST have one point per week (Monday to Sunday, UTC), at the
  highest median of that owner's recorded days in the week. The other teams' value
  for a day is the highest of their medians, shown without their names (feature 026
  FR-023).
- **FR-007**: A week without a recorded median for an owner MUST be a gap in that
  owner's line, never zero. Weeks still to come MUST be empty, with the graph
  spanning the whole season.
- **FR-008**: The three lines MUST be told apart by more than colour (line style or
  a label at the line), with a legend naming each owner.
- **FR-009**: Hovering over or tapping a week MUST show the week's dates and each
  owner's week value in milliseconds, or that the owner has no record that week.
- **FR-010**: The graph MUST be scaled to its values with milliseconds on its axis.
  The 10 ms limit MUST be drawn as a line when the scale reaches it; otherwise the
  line under the graph MUST name it.
- **FR-011**: The graph MUST carry a text description for screen readers naming
  what it shows; the 30-day table remains the place for exact figures.
- **FR-012**: Before any median of the season is recorded, the graph area MUST say
  so in one line instead of an empty graph.
- **FR-013**: The graph MUST read well at phone width and desktop width without
  scrolling sideways.

**Table**

- **FR-014**: Each cell of the 30-day CPU table MUST show the day's median next to
  the slowest runs' CPU time and the cut-off runs; a day without a median shows the
  other two only.

**Fill (one-time task)**

- **FR-015**: A task the maintainer runs by hand MUST ask Cloudflare for the medians
  of the current season's days, per owner as FR-001 records them, and add them to a
  team's recorded days that have none. It MUST NOT change any other recorded figure,
  nor a median already recorded, and MUST NOT add days that weren't recorded. Days
  Cloudflare no longer holds stay without a median.
- **FR-016**: The task MUST be safe to run more than once: a second run changes
  nothing. It MUST need the team and the database (local or production) named
  explicitly, touch the production database only when told to, and report what it
  filled. Running it against production is a manual step of the maintainer, after
  the release that adds the median has been deployed.
- **FR-017**: The task MUST NOT be part of the app's bundle, the hourly recording or
  CI; nothing in the app depends on it having run.

**Unchanged**

- **FR-018**: Marks, alerts, the attention list and the count on the Admin tab MUST
  stay as they are: the median is never marked and never notifies.

**General**

- **FR-019**: All text MUST live in the catalogs, in every shipped language, German
  as the key source (feature 025 FR-025).
- **FR-020**: The graph and its values MUST be the same on every team; only who
  "this team" is differs.

### Key Entities

- **CPU day** (exists, feature 025): per UTC day and owner the runs, cut-off runs
  and slowest runs' CPU time; gains the median CPU time, empty for days recorded
  before.
- **Week value** (derived, not stored): per owner and week of the season, the
  highest median of its recorded days.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can tell from the CPU time row alone, without opening
  Cloudflare, whether the typical run of this team's Worker, the other teams' or the
  gateway got heavier over the season.
- **SC-002**: For every week of the season with recorded days, the graph's point for
  each owner equals the highest recorded daily median of that week, checked against
  the table's figures.
- **SC-003**: No week without a record is ever drawn as zero.
- **SC-004**: The page with a full season's graph opens within the Worker's CPU
  limit, like the page with the 13-month allowance histories.
- **SC-005**: No mark, alert or count on the page changes because of this feature.

## Assumptions

- Cloudflare's analytics report the median CPU time per Worker and day in the same
  answer as the slowest runs' value; its figures for busy hours are sampled, so
  medians are estimates, as the existing value is.
- How far back Cloudflare still answers is limited and not checked here; the fill
  task takes whatever it returns. The sooner after the release it runs, the more
  of the season it fills.
- The fill task runs on the maintainer's computer with their own Cloudflare access
  (reading analytics, writing the team's database); no credential is added to the
  repository. On a Worker's free plan it is likely weeks, not a whole
  season.
- The week value is the highest daily median, chosen on purpose (the user's "max
  strategy"): cautious, good for spotting drift, not a true weekly median.
- Only CPU time is drawn. Wall time (which includes waiting on Strava and the
  database) and the slowest runs' value aren't graphed; the slowest runs stay in the
  table.
- Only the current season is drawn; earlier seasons are out of scope.
- The graph sits inside the opened CPU time row of the redesigned usage tab (feature
  048); the row's one-line status stays as it is.
