# Feature Specification: Badges and Achievements

**Feature Branch**: `013-badges-achievements`

**Created**: 2026-10-08

**Status**: Draft

**Input**: GitHub issue #51 "Make app more fun": "add badges/achievements (new tab)".
Reworked by the project owner on 2026-10-11: "Badges are a section on the personal
page. There could also be team badges (more than x riders on a training, more than
x Rynke). I also want badges for running activities on Strava. They don't count
towards Rynke, they just give badges. Count every full kilometre of running per
activity. Show progress until the next badge. Badges shall be a surprise: don't
show what the other badges of a category are, just show the progress until the
next one."

## Clarifications

### Session 2026-10-11

- Q: A new tab, or part of an existing page? → A: A section on the rider's own
  page ("Du"), not a fifth tab. Supersedes the draft's FR-001.
- Q: Are badges only personal? → A: No. Besides the rider's own badges there are
  team badges the whole team earns together, such as a team training with many
  riders or the team reaching a number of Rynke.
- Q: Do runs count? → A: Runs give badges of their own and never Rynke. Each run
  counts its full kilometres, rounded down per run (a 7.8 km run counts 7 km).
  (Rounding superseded, see below.)
- Q: Does the rider see the badges still to earn? → A: No, they are a surprise.
  Per category the rider sees only how far they are from the next badge, never its
  name, picture or the badges after it. Supersedes the draft's "earned and locked"
  list (old FR-002).
- Q: Where do team badges show? → A: In their own group, apart from the rider's
  own badges ("Team-Abzeichen", see below).
- Q: What is a team badge? → A: A badge the whole team works on together: amounts
  the team collects together and participation in team activities. A team badge
  is never one rider's achievement.
- Q: Which runs count? → A: Outdoor runs only. Virtual runs and treadmill runs count
  nothing.
- Q: What is "Team Rynke" as a badge category? → A: Dropped: the name clashed with
  feature 003's Team Rynke (the Rynke kind earned at team events). The team's
  amount category is "Training Rynke together" (FR-011).
- Q (raised by the project owner): Are run kilometres still rounded down per run?
  → A: No. The running category counts the overall kilometres of all runs; no
  metre is lost (runs of 7.8 km and 4.6 km make 12.4 km).
- Q (raised by the project owner): Is there a badge for qualifying for the tour?
  → A: No. Who goes on the tour is a decision people make, not a badge. The Tour
  category is dropped.
- Q (raised by the project owner): Is there a badge for the longest ride? → A: No,
  the category is dropped.
- Q (raised by the project owner): Which running badges? → A: Two categories: the
  longest single run, up to marathon distance as the highest badge, and the
  overall kilometres of all runs.
- Q (raised by the project owner): What does the team's Rynke category count? →
  A: Training Rynke, collected by the whole team together ("Training Rynke
  together"), with more thresholds than the first draft.
- Q (raised by the project owner): Do team totals of kilometres, elevation and
  running kilometres need a new consent version? → A: No. They are sums over the
  whole team that show no single rider's figures, covered by the consent to show
  points to the team. They are part of this feature.
- Q (raised by the project owner): How are badges drawn? → A: Placeholders first,
  real pictures later. A fixed badge frame (one for personal, one for team badges)
  with Rynke from the coin as the reference; each badge's picture is generated
  with Gemini from a prompt plus that reference, then traced like the rider-state
  illustrations.
- Q (raised by the project owner): How large are badges shown? → A: A category's
  highest earned badge is shown larger than its earlier ones; pointing at any
  earned badge shows it large (FR-002a, FR-002b).
- Q (raised by the project owner): How is the milestone shown as text? → A: On a
  ribbon across the lower edge of the badge, in the ring's colour; the ribbon is
  part of the frame, its text comes from the page (translated, crisp, readable by
  screen readers), never from the image. Small gallery badges have no ribbon; the
  value is written below them.
- Q (raised by the project owner): How does the section look on a phone, with many
  badges? → A: As in the drafts `drafts/abzeichen-mobile.png` and
  `drafts/abzeichen-desktop.png`: per group the newest badge of each category as
  a card, every earned badge in a collapsible gallery below, categories without
  a badge as slim progress bars. The pictures are fun, so all of them stay one
  tap away.
- Q (raised by the project owner): What is the section called? → A: "Abzeichen"
  in German ("Meine Abzeichen", "Alle meine Abzeichen", "Team-Abzeichen",
  "Alle Team-Abzeichen"); the progress line reads "Noch
  1.500 km", and one line under the heading explains the surprise once.
- Q (raised by the project owner): Which colour do the progress bars have? → A:
  Personal categories yellow, team categories the team blue of their frame.
- Q (raised by the project owner): Are badge names translated? → A: No. Names are
  German only, in every app language, kept in one German-only list like the Team
  page's quotes; the rest of the section's text is translated as usual.
- Q (raised by the project owner): Is there a badge for technique training? → A:
  Yes, a personal category with two badges: one for attending one of the season's
  two planned technique trainings, one for attending both.

### Session 2026-10-12

- Q (raised by the project owner): Is there a badge for the longest ride after
  all? → A: Yes. A personal category "Ride length": the longest single counting
  ride of the season, up to 300 km. Supersedes the 2026-10-11 answer that dropped
  it.
- Q (raised by the project owner): Do virtual rides get badges of their own? → A:
  Yes. A personal category "Virtual rides": the season total of kilometres of
  virtual rides (feature 003 FR-013a). Those kilometres still count in Distance.
- Q (raised by the project owner): Do swims give badges? → A: Yes, like runs: two
  personal categories, the longest single swim and the season total of swim
  kilometres. Pool and open-water swims both count; manual swims count nothing.
  Swims never earn Rynke. There is no team category for swimming. Supersedes the
  edge case that excluded swims.
- Q (raised by the project owner): Is there a badge for riding in challenging
  conditions? → A: Yes, as four personal winter categories, one per month
  (November, December, January, February), each with badges for 1, 5 and 10
  days. Strava gives no weather data, so the calendar month stands in for the
  conditions.
- Q: Do the winter categories count rides or days? → A: Days with at least one
  outdoor counting ride, so splitting a ride earns nothing extra.
- Q: Are winter cards shown outside their month? → A: Yes, all four cards show
  all season, like every other category.
- Q: Is there a "Swimming together" team category? → A: No.

### Session 2026-10-12 (surprise badges)

- Q (raised by the project owner): Are there badges whose rule is a secret? →
  A: Yes, "Überraschungen" (surprise badges): one personal category of six
  single badges. Riders know they exist from the outlines, but the category's
  sentence and every unearned badge say only "?". Once earned, a badge says why
  it was earned. They are meant to be extra fun.
- Q (raised by the project owner): Which surprise badges? → A: New Year (an
  activity on 1 January), Christmas Eve (on 24 December), Christmas (on 25 or
  26 December), night owl (a ride started after 21:30), early bird (a ride
  started before 6:00) and rest day (a day off after at least a full week with
  an activity every day). The rest day badge shows the figure on a couch,
  wrapped in a warm cream and black striped blanket, with a cup of cocoa.
- Q: Which activities count for the holiday and rest-day badges? → A: Every
  activity the badges already count: counting rides of any kind (virtual
  included), outdoor runs and swims. Night owl and early bird count counting
  rides only, as asked.
- Q: Where exactly are the time limits? → A: By the activity's local start
  time: night owl from 21:30 on (21:30 counts), early bird before 6:00 (5:59
  counts, 6:00 doesn't). A ride starting at 0:30 is an early bird.
- Q: When is a rest day known? → A: With the rider's next activity after it:
  the day is a rest day when the seven days before it each had an activity, it
  had none, and a later activity shows the day is over. The badge is dated with
  the rest day.

### Session 2026-10-12 (clock and pictures)

- Q (raised by the project owner): Can a badge be earned for a date in the
  future? → A: No. Nothing dated after today's date in Berlin counts towards
  any badge or bar; a rest day or a team day off is earned only once its day
  is over in Berlin (FR-030a).
- Q (raised by the project owner): Is the personal rest day extra fun too? →
  A: No, it is calm: the figure on a light sofa with the striped blanket and
  cocoa. Sofas are light sage green, since black clashed with the ribbon.

### Session 2026-10-12 (team surprise badges)

- Q (raised by the project owner): Are there surprise badges for the team? →
  A: Yes, "Team-Überraschungen", shown like the personal ones ("?" until
  earned): a day nobody in the team is active, a day everyone is active, and
  four more the owner took from Claude's proposals: team activities started in
  every hour of one day ("Rund um die Uhr"), someone active every day for 30
  days in a row ("Staffelstab"), at least five riders active on 31 December
  ("Silvesterrunde"), and ten or more riders active on the same Sunday without
  a team event ("Sonntagsausflug"). Extra fun pictures, as for the personal
  ones.
- Q: Who is "everyone"? → A: Every listed rider (feature 014) who had already
  connected on that day, at least two; a rider who joins later doesn't take
  the badge back.
- Q (raised by the project owner): Which activities count for the team? → A:
  Counting rides, outdoor runs and swims of listed riders, swims just like
  runs. Only whether and when someone was active counts, never a swim's
  figures (FR-025, FR-016a).
- Q: When is a team day off known? → A: Like the rest day: with the team's
  next activity after it, and only between the team's first activity of the
  season and that next one.

### Session 2026-10-14 (part F: cycling traditions)

- Q (raised by the project owner): Can there be a Festive 500 badge? → A: Yes,
  as a personal surprise badge, after Rapha's year-end challenge: at least
  500 km of counting rides dated 24 to 31 December. Indoor and virtual rides
  count, as in the challenge's current rules.
- Q (raised by the project owner): Which other traditions become surprise
  badges? → A: All of Claude's proposals that no badge covers yet, none of
  them gender-specific: Etappenfahrer (three days in a row with at least
  100 km each), Dreikampf (a ride, a run and a swim on one day), Kreiszahl
  (one ride of at least 31.4 km on Pi Day, 14 March), Sonnenwende (outdoor
  rides on both solstices of the season), Osterhase (an activity on Easter
  Sunday or Monday) and Everesting (8,848 m of climbing in one calendar
  month), plus a team badge, Festive Team (every listed rider rides between
  24 and 31 December). Brevet distances and Gran Fondo are already
  `ride_length`; weather badges need data Strava doesn't give.
- Q: Which rides count? → A: Counting rides of any kind for every new badge
  (virtual included, like Distance and Elevation), except Sonnenwende, which
  counts outdoor rides only, like the winter months.
- Q: Does Etappenfahrer need one ride of 100 km a day? → A: No, the day's
  counting rides added up; it is dated with the third day.
- Q: How is Everesting different from the real thing? → A: Real Everesting
  is 8,848 m in one ride on one hill; the badge asks for the same height in
  one calendar month of counting rides, dated the day the month's total
  reaches it.
- Q: Who counts for Festive Team? → A: Every listed rider who had connected
  by 24 December, at least two, with a counting ride dated 24 to 31 December;
  dated the day the last of them rides. A rider connecting later doesn't
  take it back.
- Q (raised by the project owner): How are the surprise pictures made fun?
  → A: Each scene carries its own gag, a little over the top. The shared
  "surprise" snippet ("make it EXTRA fun …") is removed from every surprise
  scene, parts D to F, since a generic fun sentence made the pictures less
  fun (FR-015c).

### Session 2026-10-17 (part I: page width and switch)

- Q (raised by the project owner): Why only two cards per row on a wide
  screen or a phone held sideways? → A: The page fills the screen's width on
  every device; the cards fill it, at least two per row (Claude Design draft
  "RynkePoints Badges Switch",
  https://claude.ai/artifact/KmHELuT8yfg1X6K887Dj28).
- Q (raised by the project owner): How does a rider get to the team's badges
  and to all badges quickly? → A: A switch that stays at the top: "Deine" and
  "Team" lead to their group and show which group is on the screen while
  scrolling either way; "Neueste" and "Alle" filter both groups between the
  cards and the gallery. Categories without a badge stay in "Neueste" as
  outlines, so riders see they exist.
- Q (raised by the project owner): Where does the page open when a badge is
  new? → A: On the card of the new badge (the case where the app opens on the
  badges page, issue #150); the rider's own before the team's.

### Session 2026-10-20 (part J: Winterschlaf beendet)

- Q (raised by the project owner): Can there be a surprise badge for coming
  out of hibernation? → A: Yes, "Winterschlaf beendet": the first outdoor
  ride in the new year, not the first ride of the season (in September).
- Q: Which rides count? → A: Outdoor (not virtual) counting rides only, like
  Sonnenwende and the winter months; runs and swims don't.
- Q: Which new year? → A: The calendar year after the season start's, so
  1 January or later in a season from September; it is dated with that
  ride. A season starting on 1 January has no new year in it.

### Session 2026-10-26 (part K: 15 km and Pi-Run)

- Q (raised by the project owner): More run-length steps, 15 km and a Pi run?
  → A: Two more steps on the run-length ladder: 15 km, and "Pi-Run" at
  31.4 km (π × 10, the same distance as Kreiszahl), named in German and
  English alike. 30 km was considered and dropped: it would sit right next to
  the Pi-Run.
- Q: Does the Pi-Run clash with Kreiszahl (Pi Day)? → A: No. Kreiszahl stays
  a surprise badge for a ride on 14 March; the Pi-Run is a run on any date.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my badges on my page (Priority: P1)

A rider opens their own page and finds the "Abzeichen" section
([mobile](drafts/abzeichen-mobile.png), [desktop](drafts/abzeichen-desktop.png)).
"Meine Abzeichen" shows one card per category with its newest badge,
the milestone on the badge's ribbon and a progress bar towards the next badge
("Noch 1.500 km"), without naming that badge or showing its picture. Below, a
collapsible gallery holds every badge they have earned, to look at again; any
badge opens large with its name, what it was for and the date.

**Why this priority**: The section is the feature; without it no badge is visible,
and the progress towards the next surprise is what brings riders back.

**Independent Test**: Open the rider page for sample riders (`pnpm dev`) with no
badges, a few badges and every badge of a category.

**Acceptance Scenarios**:

1. **Given** a rider whose rides add up to their first 100 km, **When** they open
   their page, **Then** the distance card shows that badge with "100 km" on its
   ribbon, and opening it shows the date of the ride that reached 100 km.
2. **Given** a rider with 412 km in the distance category whose next badge is at
   500 km, **When** they open their page, **Then** the distance category shows
   progress 412 of 500 km and "Noch 88 km", and nothing about what the badge is
   or which badges follow.
3. **Given** a rider who has earned the last badge of a category, **When** they open
   their page, **Then** that category's card shows no progress bar and no hint that
   it was the last.
4. **Given** a rider with no badge yet, **When** they open their page, **Then** the
   section shows an encouraging empty state and every category as a card with a
   dotted outline and its progress.
5. **Given** a rider still in feature 015's waiting state, **When** they open their
   page, **Then** no Abzeichen section is shown until their first data arrives.
6. **Given** a rider with the 100 and 500 km distance badges, **When** they open
   their page, **Then** the distance card shows the 500 km badge; **When** they
   open "Alle meine Abzeichen", **Then** both badges are there under "Distanz",
   newest first, with "500 km" and "100 km" below them.
7. **Given** any earned badge, card or gallery, **When** the rider hovers over it,
   focuses it with the keyboard or taps it, **Then** it shows large with its
   ribbon, name, what it was for and its date; **When** they move away or tap
   again, **Then** it closes.
8. **Given** cards for a distance badge earned in May and a running badge earned in
   June, **When** the rider opens their page, **Then** the running card comes
   first.

---

### User Story 2 - Earning a badge (Priority: P1)

When a ride, a run, a team event or an organiser correction earns a badge, the
rider learns about it: a short celebration on their next visit, and in feature
010's notification if notifications are on.

**Why this priority**: The surprise of a new badge is what makes it fun, and badges
that are awarded twice or never taken back would make them meaningless.

**Independent Test**: Give a sample rider a ride that crosses a badge threshold,
evaluate it twice, then make it stop counting.

**Acceptance Scenarios**:

1. **Given** a ride that earns a badge, **When** it is evaluated, **Then** the badge
   is stored once with the ride's date, also when the ride is evaluated again.
2. **Given** a newly earned badge, **When** the rider next opens their page, **Then**
   the badge is revealed once with a celebration at the top of the page, next to
   feature 012's coin celebration (honouring reduced motion), and not again on
   later visits.
3. **Given** a rider with notifications on, **When** an evaluation earns them a
   badge, **Then** the notification they get for that evaluation names the new badge.
4. **Given** a ride that earned a badge stops counting (deleted, made private
   without read-all consent, or excluded by a rule), **When** it is evaluated again,
   **Then** the badge is taken back if the rider no longer meets it, without a
   notification.

---

### User Story 3 - Running badges (Priority: P2)

A rider who also runs gets running badges in two categories: the length of their
longest single run, up to marathon distance, and the overall kilometres of all
their runs. Runs never appear among their rides and never change their Rynke.

**Why this priority**: Many riders run in the off-season; badges reward that
without bending the Rynke rules.

**Independent Test**: Give a sample rider runs of 7.8 km and 4.6 km and a ride;
check the running category counts 12.4 km and the Rynke and ride list are
unchanged.

**Acceptance Scenarios**:

1. **Given** runs of 7.8 km and 4.6 km, **When** they are evaluated, **Then** the
   running category counts 12.4 km, shown as 12 km.
1a. **Given** runs of 9.6 km and then 0.5 km, **When** the second is evaluated,
   **Then** the overall-running badge for 10 km is earned with the second run's
   date.
1b. **Given** a first run of 10.4 km, **When** it is evaluated, **Then** the
   run-length badges for 5 km and 10 km and the overall-running badge for 10 km
   are earned with its date.
1c. **Given** a rider whose longest run is 21.3 km, **When** they open their page,
   **Then** the run-length category shows the progress towards marathon distance
   (42.2 km), as long as the marathon badge is not earned.
2. **Given** a run, **When** it is evaluated, **Then** the rider's Training Rynke,
   Team Rynke, ride list and team leaderboard are exactly as without it; only the
   running categories (the rider's own and "Running together") change.
3. **Given** a rider who connected before this feature, **When** it is released,
   **Then** their runs since the season start are picked up without the rider doing
   anything.
4. **Given** a run entered manually on Strava, **When** it is evaluated, **Then** it
   counts no kilometres.
5. **Given** a virtual run or a run Strava marks as on a treadmill, **When** it is
   evaluated, **Then** it counts no kilometres.

---

### User Story 4 - Team badges (Priority: P2)

Every rider also sees the team's badges under "Team-Abzeichen" on the Team page,
laid out like their own: newest per category, the gallery collapsed below, in the team blue. The whole team
works on them together, through amounts it collects together (the team's Rynke
reaching 5,000) and through taking part in team activities (10 riders at one team
training, 100 attendances at team events over the season). Like personal badges,
team badges are a surprise; the team categories show only the progress towards the
next one.

**Why this priority**: Team Rynkeby is a team; shared goals make riders pull others
along. It builds on the personal badges.

**Independent Test**: Record attendance of 10 sample riders at one team training and
check every rider's page shows the team badge with the training's date.

**Acceptance Scenarios**:

1. **Given** an organiser records the 10th rider at a team training, **When** the
   attendance is evaluated, **Then** the team badge "10 riders at one training" is
   earned with that training's date and every rider sees it under
   "Team-Abzeichen".
2. **Given** the team has collected 4,210 Training Rynke together and the next team
   badge is at 5,000, **When** a rider opens their page, **Then** the "Training
   Rynke together"
   category shows "noch 790" and nothing about the badge itself.
3. **Given** riders have attended team events 92 times this season and the next
   team badge is at 100, **When** a rider opens their page, **Then** the
   attendance category shows "noch 8".
4. **Given** riders without a current consent, **When** team badges are worked out,
   **Then** those riders count towards nothing (feature 004 FR-021).
5. **Given** a team badge earned before a rider connected, **When** that rider opens
   their page, **Then** they see it as the team's badge with its original date, and
   it is not celebrated as if they had just earned it.

---

### User Story 5 - Long rides, virtual rides, swims and winter riding (Priority: P3)

A rider gets badges for their longest ride of the season, for the kilometres they
ride on a trainer, for swimming, and for riding outdoors through the winter
months, one category per month from November to February.

**Why this priority**: These reward what Rynke don't: the one big day out, the
indoor work and the swims of the off-season, and the stubbornness to ride
outdoors in winter. They build on the personal badges and the runs' storage.

**Independent Test**: Give a sample rider an outdoor ride of 104 km in December,
two outdoor rides on one January day, a virtual ride and two swims; check each
category's value and that Rynke and ride list are unchanged by the swims.

**Acceptance Scenarios**:

1. **Given** a rider whose longest counting ride is 104 km, **When** they open
   their page, **Then** the ride-length category has the 50 and 100 km badges,
   dated with the rides that first reached them, and shows progress towards
   the next.
2. **Given** a ride of 312 km, **When** it is evaluated, **Then** every
   ride-length badge up to 300 km is earned with its date.
3. **Given** virtual rides of 30 km and 25 km, **When** they are evaluated,
   **Then** the virtual-rides category counts 55 km and earns the 50 km badge,
   and Distance counts both rides as before.
4. **Given** swims of 1.2 km in a pool and 0.8 km in open water, **When** they
   are evaluated, **Then** the swimming category counts 2.0 km and the
   swim-length category 1.2 km; Rynke, ride list and every team category are
   unchanged.
5. **Given** a swim entered manually on Strava, **When** it is evaluated,
   **Then** it counts nothing.
6. **Given** two outdoor rides on 10 January and one on 11 January, **When**
   they are evaluated, **Then** the January category counts 2 days.
7. **Given** a virtual ride or a ride with Strava's trainer flag on a December
   day, **When** it is evaluated, **Then** the December category does not count
   that day.
8. **Given** a ride starting 30 November at 23:30 local time, **When** it is
   evaluated, **Then** it counts for November.
9. **Given** it is March and a rider has 3 days in February, **When** they open
   their page, **Then** the February card shows its 1-day badge and no
   progress bar.

---

### User Story 6 - Surprise badges (Priority: P3)

A rider sees a category "Überraschungen" with six empty outlines and only "?"
where the other categories explain how they count. Riding on New Year's Day,
Christmas Eve or the Christmas holidays, very late or very early, or resting
after a full week of daily training reveals a badge with an extra funny
picture, and only then the text says why it was earned.

**Why this priority**: The surprise is the fun: riders talk about what the
outlines could be, and a badge for a holiday ride or a well-earned rest day
rewards things no ladder does.

**Independent Test**: Give a sample rider a ride starting at 22:00 on 24
December and seven days of activities followed by a day off and another
activity; check the night owl, Christmas Eve and rest day badges, and that a
rider without them sees only "?".

**Acceptance Scenarios**:

1. **Given** a rider without surprise badges, **When** they open their page,
   **Then** the "Überraschungen" card shows a dotted outline with "?" as its
   sentence and no progress bar, and the gallery shows thirteen empty outlines
   (FR-017).
2. **Given** a counting ride, an outdoor run or a swim on 1 January, **When**
   it is evaluated, **Then** the New Year badge is earned with that date, and
   its large view says it was earned for being active on New Year's Day.
3. **Given** an activity on 24 December, **When** it is evaluated, **Then** the
   Christmas Eve badge is earned; **given** one on 25 or 26 December, the
   Christmas badge is earned.
4. **Given** a counting ride starting at 21:30 local time, **When** it is
   evaluated, **Then** the night owl badge is earned; a ride starting at 21:29
   earns nothing.
5. **Given** a counting ride starting at 5:59 local time, **When** it is
   evaluated, **Then** the early bird badge is earned; one starting at 6:00
   earns nothing. A run at 5:00 earns nothing (rides only).
6. **Given** activities on seven days in a row, none on the eighth day and one
   on the ninth, **When** the ninth day's activity is evaluated, **Then** the
   rest day badge is earned, dated the eighth day.
7. **Given** activities on six days in a row and none on the seventh, **When**
   a later activity is evaluated, **Then** no rest day badge is earned.
8. **Given** a rider with the night owl badge, **When** they open their page,
   **Then** the "Überraschungen" card shows their newest surprise badge, the
   card's sentence is still "?", and nothing on the page names or pictures a
   surprise badge they haven't earned.

---

### User Story 7 - Team surprise badges (Priority: P3)

Under "Team-Abzeichen" every rider sees "Team-Überraschungen" with six empty
outlines and "?". When the whole team rests on the same day, all turn out on
the same day, or the team covers every hour of a day, keeps a 30-day relay
going, rides together on New Year's Eve or a big Sunday, a team badge appears,
and only then says why.

**Why this priority**: The team gets the same fun as the rider, from things
nobody can do alone; no rider is named.

**Independent Test**: Give the listed sample riders a day without activities
between active days, and a day on which each of them rides; check both team
surprise badges and that no rider is named.

**Acceptance Scenarios**:

1. **Given** no team surprise badge, **When** a rider opens their page,
   **Then** "Team-Überraschungen" shows "?" and an outline, seven outlines (FR-017a) in the
   gallery, no bar.
2. **Given** listed riders active on 3 and 5 May and none on 4 May, **When**
   the 5 May activity is evaluated, **Then** the day-off badge is earned, dated
   4 May.
3. **Given** every listed rider connected by 6 May is active on 6 May, **Then**
   the all-out badge is earned, dated 6 May; a rider connecting on 8 May
   doesn't take it back.
4. **Given** counting rides and runs of listed riders starting in each of the
   24 hours of one local date, **Then** the round-the-clock badge is earned.
5. **Given** 30 dates in a row with at least one listed rider active, **Then**
   the relay badge is earned with the 30th date.
6. **Given** five listed riders active on 31 December, **Then** the New Year's
   Eve badge is earned; four are not enough.
7. **Given** ten listed riders active on a Sunday without a team event,
   **Then** the Sunday outing badge is earned; with a team event that day, not.
8. **Given** a swim by a listed rider on an otherwise empty day, **Then** that
   day is no team day off, and the swim counts for the other team surprises
   like a run.

---

### User Story 8 - Surprise badges from cycling traditions (Priority: P3)

The surprise categories grow by badges from cycling's own traditions: the
Festive 500 between Christmas Eve and New Year's Eve, stage days like on the
tour to Paris, a triathlon day, Pi Day, both solstices, Easter and a month
of Everesting, and for the team a Christmas week everyone rides. They behave
like the existing surprises: "?" until earned, then why.

**Why this priority**: Riders who know these traditions recognise them once
earned, and the rest get something to talk about; it extends the fun of
User Stories 6 and 7 without a new category.

**Independent Test**: Give a sample rider 520 km of rides between 24 and 31
December and a ride, a run and a swim on one day; check the Festive 500 and
Dreikampf badges, and that a rider without them sees only "?" and thirteen
outlines.

**Acceptance Scenarios**:

1. **Given** counting rides of 480 km dated 24 to 30 December and a 25 km
   ride on 31 December, **When** the last ride is evaluated, **Then** the
   Festive 500 badge is earned, dated 31 December; 499 km earn nothing, and
   a ride on 23 December or 1 January adds nothing.
2. **Given** a 300 km Zwift ride and outdoor rides of 200 km in that week,
   **Then** the Festive 500 badge is earned (indoor counts).
3. **Given** 100 km of counting rides on each of 2, 3 and 4 May, the 3 May in
   two rides, **Then** the Etappenfahrer badge is earned, dated 4 May; 99 km
   on 3 May breaks the run.
4. **Given** a counting ride, an outdoor run and a swim with the same local
   date, **Then** the Dreikampf badge is earned; with only two of them, not.
5. **Given** one counting ride of 31.4 km on 14 March, **Then** the Kreiszahl
   badge is earned; two rides of 20 km that day are not enough.
6. **Given** an outdoor ride on 21 December and another on 21 June, **Then**
   the Sonnenwende badge is earned, dated 21 June; a Zwift ride on either day
   doesn't count.
7. **Given** an activity on Easter Sunday 28 March 2027 or Easter Monday 29
   March 2027, **Then** the Osterhase badge is earned; Good Friday earns
   nothing.
8. **Given** counting rides with 8,848 m of climbing in March, **Then** the
   Everesting badge is earned on the day March's total reaches it; 6,000 m in
   March and 6,000 m in April earn nothing.
9. **Given** every listed rider connected by 24 December, at least two, rides
   between 24 and 31 December, **Then** the Festive Team badge is earned,
   dated the day the last of them rides; if one of them doesn't ride, not.

### User Story 9 - Winterschlaf beendet (Priority: P3)

After the dark months, the first ride outside in the new year is a small
event of its own: the rider's hibernation is over. A personal surprise
badge marks it, "?" until earned like the others.

**Why this priority**: A cheerful nudge to get back on the bike outdoors in
January; it extends User Story 6 without a new category.

**Independent Test**: In a season from September, give a rider outdoor rides
in September and December and one on 17 January; check the badge is earned
on 17 January, and that a rider with only Zwift rides in January sees "?".

**Acceptance Scenarios**:

1. **Given** a season from 1 September 2026 and outdoor rides on 5 September
   2026, 31 December 2026 and 17 January 2027, **Then** Winterschlaf beendet
   is earned, dated 17 January 2027.
2. **Given** only a virtual ride, a run and a swim in January 2027, **Then**
   nothing is earned; an outdoor ride on 1 March 2027 then earns it, dated
   1 March.

### Edge Cases

- Recalculations after a rule change (feature 003) award or take back badges
  without notifying and without a celebration.
- A badge taken back and earned again is celebrated again only if it is earned on
  a later date than before.
- A rider who leaves loses their badges with their other data (Principle I); team
  badges are worked out again without them and may be taken back.
- One activity crossing two thresholds of a category (a first run of 22 km passes
  5 km, 10 km and half-marathon length) earns all of them, with the same date.
- The past-season import and feature 008's re-read award badges silently: a new
  rider's first visit shows their earned badges without one celebration per badge,
  only a single reveal of all of them.
- A run and a ride overlapping in time do not affect each other: runs are not part
  of feature 003's overlap rule (FR-005d).
- A swim, like a run, does not affect rides overlapping it in time (FR-024).
- A ride that stops counting can lower the longest ride, take back a winter day
  or lower the virtual kilometres, and its badges are taken back like any other
  (US2).
- A winter month whose days are corrected after the month is over (a ride deleted
  in March) still changes that month's category; the card shows no progress bar
  either way (FR-004a).
- Activities of other sports (walk, hike, e-bike rides) give no badges.
- Two rides on one day count as one activity day for the rest day; a ride
  across midnight belongs to the day it started.
- A surprise badge taken back (its only activity deleted) shows "?" again.
- The rest day needs the seven days directly before it; a longer streak earns
  the badge once, dated with its first rest day.
- A rider whose Festive 500 rides cross 500 km and a later one is deleted
  loses the badge again; Festive 500 and Festive Team are worked out from the
  dates alone, so a new season starting on 1 September always holds one
  whole 24 to 31 December.
- Easter is computed per year (Gregorian calendar); the season holds exactly
  one Easter and both solstices.
- Etappenfahrer's three days and Everesting's month may overlap the season
  start: only days inside the counting window count.
- Personal badges are the rider's own; other riders never see them (feature 004's
  visibility rules), unless a later feature decides otherwise.

## Requirements *(mandatory)*

### Functional Requirements

**Section and display**

The drafts [drafts/abzeichen-mobile.png](drafts/abzeichen-mobile.png) (360 px)
and [drafts/abzeichen-desktop.png](drafts/abzeichen-desktop.png) (1100 px) show
the layout these requirements describe; their pictures are placeholders and
their badge names examples.

- **FR-001**: The rider's own page ("Du") MUST get an "Abzeichen" section below
  the Rynke figures, mobile first. The app shell keeps its tabs; there is no
  Abzeichen tab. One line under the heading explains the surprise once ("Wie weit
  es noch bis zum nächsten Abzeichen ist – welches es wird, bleibt geheim.").
- **FR-002**: The section MUST show the rider's own badges first, then the team's,
  each group in two parts:
  - **cards**: one card per category of the group ("Meine Abzeichen",
    "Team-Abzeichen"): category name, the sentence on how it counts, the
    category's highest earned badge with its ribbon (FR-040b), and the progress
    towards the next badge (FR-003). Cards are ordered by the date that badge
    was earned, newest first. After them, a card for each category without a
    badge yet, in catalog order: name, sentence, an empty dotted outline in the
    badge's place and the progress bar.
  - **all**: a gallery of every earned badge of the group ("Alle
    meine Abzeichen (14)", "Alle Team-Abzeichen (5)", with the count), shown
    instead of the cards by the filter (FR-002c),
    grouped by category, newest first within a category, with the
    milestone written below each badge. Three per row on a phone. Every
    category of the group is in it, also one without a badge yet: after a
    category's earned badges, each badge of that category still to earn is an
    empty dotted outline of the same size, without name, picture or text
    (issue #109); a group without a badge shows outlines only.
- **FR-002a**: Badge sizes: on a card as wide as the card allows, up to
  200 px, with its ribbon; 96 px in the
  gallery, without a ribbon. The page fills the screen's width on every
  device; the cards fill it, at least two per row (part I);
  below 600 px a card with a badge leaves out the sentence on how its category
  counts; a card without one keeps it.
- **FR-002c** (part I): A switch MUST stay at the top of the page, under the
  top bar: "Deine" and "Team" lead to their group and mark the group on the
  screen while the rider scrolls either way; "Neueste" (the cards, the
  default) and "Alle" (the galleries) filter both groups at once. A page with
  a new badge MUST open scrolled to that badge's card, the rider's own before
  the team's.
- **FR-002b**: Pointing at an earned badge, on a card or in the gallery, MUST
  show it at 280 px with its ribbon, name, what it was for and the date earned:
  on hover with a mouse, on keyboard focus, and on tap on a touch screen
  (another tap, tapping elsewhere or its close button in the top right corner
  closes it; opened by hover it floats beside the mouse, follows it, closes
  when the mouse leaves the badge and shows no close button). It MUST stay
  within the screen at 360 px width.
- **FR-002c**: Progress bars MUST be yellow for personal categories and the team
  blue of the team frame for team categories.
- **FR-003**: For each category not yet complete, the group
  MUST show the progress towards the next badge only: a bar for the current value
  against the value needed, and what is still missing in that category's unit
  ("Noch 1.500 km", "Noch 5 Fahrer", "Noch 4 Tage"). It MUST NOT show the
  next badge's name or picture, nor any badge after it. Only the gallery's empty
  outlines (FR-002) tell how many badges a category has.
- **FR-004**: A category whose last badge is earned MUST keep its card, without a
  progress bar and without a sign that it is complete.
- **FR-004a**: A winter category (FR-010) whose month of the season is over,
  by today's Berlin date, MUST keep its card without a progress bar, whether or not its badges are
  earned; with no badge, the card keeps its dotted outline. Its badges still to
  earn stay as empty outlines in the gallery. Before and during its month the
  card shows its progress like any other category.
- **FR-005**: The section MUST NOT show while feature 015's waiting state is shown.

**Categories (first set)**

- **FR-010**: Personal categories MUST be:
  - Distance: the season total of kilometres of rides that count for Training Rynke
    (feature 003).
  - Elevation: the season total of elevation gain of counting rides.
  - Team events attended: the number of team events of any kind the rider
    attended.
  - Technique training: the number of technique trainings (feature 003 FR-006)
    the rider attended; one badge for the first, one for both planned trainings.
  - Training Rynke: the rider's Training Rynke total.
  - Run length: the longest single run of the season (FR-020). Its steps
    include 15 km and the Pi-Run (31.4 km, part K); its highest badge is
    marathon distance (42.195 km).
  - Running: the season total of kilometres of runs (FR-020).
  - Ride length: the longest single counting ride of the season, virtual rides
    included. Its highest badge is 300 km.
  - Virtual rides: the season total of kilometres of counting virtual rides
    (feature 003 FR-013a: Strava's virtual-ride sport type or the trainer flag).
    These kilometres count in Distance as well.
  - Swim length: the longest single swim of the season (FR-024).
  - Swimming: the season total of kilometres of swims (FR-024).
  - Winter November, Winter December, Winter January, Winter February: four
    categories, one per month, each counting the days of that month with at
    least one outdoor counting ride. An outdoor ride is a counting ride that is
    not a virtual ride (FR-013a). A ride belongs to the day and month of its
    local start date, as every badge date (FR-013). Several rides on one day
    make one day.
- **FR-011**: Team categories are worked on by the whole team together and MUST be:
  - Amounts collected together:
    - Training Rynke together: all Training Rynke the consenting riders collected
      this season, the team total feature 016 already shows.
    - Distance together: the kilometres of all counting rides of consenting riders.
    - Elevation together: the elevation gain of all counting rides of consenting
      riders.
    - Running together: the kilometres of all runs of consenting riders (FR-020).
    - Swims have no team category.
  - Participation in team activities:
    - Big training: the most riders at a single team event of the season.
    - Attendances: how often riders attended team events this season, summed over
      all events: a team training with 12 riders and a training-weekend day with
      18 riders make 30 attendances. Where Big training rewards one well-attended
      event, Attendances rewards the team turning up again and again.
- **FR-014**: Team badges MUST show under "Team-Abzeichen" only, never among a
  rider's own badges, and MUST NOT be credited to a single rider.
**Team surprise badges (2026-10-12)**

- **FR-016**: A team category "Team-Überraschungen" MUST hold six single
  badges (seven with FR-017a), shown as FR-015b shows the personal ones ("?"
  until earned, then why; the newest on the card; never a bar), worked out from the listed riders'
  counting rides, outdoor runs and swims by local start date and time
  (FR-032):
  - Day off: a date with no activity between the team's first activity of the
    season and a later one;
  - All out: a date on which every listed rider connected by then, at least
    two, is active;
  - Round the clock: a date with activities starting in each of its 24 hours;
  - Relay: 30 dates in a row each with at least one active rider (dated the
    30th);
  - New Year's Eve: at least five riders active on 31 December;
  - Sunday outing: at least ten riders active on a Sunday without a team
    event.
- **FR-016a**: Team surprise badges MUST NOT reveal which riders were or
  weren't active; only the date and the badge show. The consent text's team
  part names that the days and hours of rides, runs and swims count for them
  without names; like FR-023, no new consent version.

**Surprise badges (2026-10-12)**

- **FR-015**: A personal category "Überraschungen" MUST hold six single badges
  (thirteen with FR-017), each earned once per season by its own rule
  (FR-015a). It has no ladder and no progress bar.
- **FR-015a**: The surprise badges and their rules, by the activity's local
  start date and time (counting rides of any kind, outdoor runs and swims,
  unless named otherwise):
  - New Year: an activity on 1 January;
  - Christmas Eve: an activity on 24 December;
  - Christmas: an activity on 25 or 26 December;
  - Night owl: a counting ride starting at 21:30 or later;
  - Early bird: a counting ride starting before 6:00;
  - Rest day: a day without any activity directly after seven days in a row
    each with at least one, once a later activity shows the day is over;
    dated with the rest day.
- **FR-015b**: Wherever another category shows its sentence on how it counts
  (card and gallery), "Überraschungen" MUST show only "?". An earned surprise
  badge's large view MUST say why it was earned; an unearned one is an empty
  outline only (FR-002, SC-003). The card shows the newest earned surprise
  badge, with its name on the ribbon.
- **FR-015c**: Surprise badges MUST be drawn extra fun: each picture a gag of
  its own, a little over the top, written into its own art scene in
  `art/badges/badges.json`, never a shared generic "make it fun" sentence;
  except the personal rest day, which is calm.

**Surprise badges from cycling traditions (2026-10-14, part F)**

- **FR-017**: "Überraschungen" MUST hold seven more single badges, thirteen in
  all, each earned once per season by its rule, by the activity's local start
  date (counting rides of any kind, virtual included, unless named
  otherwise):
  - Festive 500: at least 500 km of counting rides dated 24 to 31 December,
    dated the day the sum reaches 500 km;
  - Etappenfahrer: three dates in a row, each with at least 100 km of
    counting rides added up, dated the third;
  - Dreikampf: a counting ride, an outdoor run and a swim on the same date;
  - Kreiszahl: one counting ride of at least 31.4 km on 14 March;
  - Sonnenwende: an outdoor (not virtual) counting ride on 21 December and
    another on 21 June of the same season, dated 21 June;
  - Osterhase: an activity (counting ride, outdoor run or swim) on Easter
    Sunday or Easter Monday (Gregorian Easter of that year);
  - Everesting: at least 8,848 m of climbing from counting rides within one
    calendar month, dated the day the month's sum reaches it.
- **FR-017a**: "Team-Überraschungen" MUST hold one more single badge, seven
  in all: Festive Team, every listed rider connected by 24 December, at least
  two, with a counting ride dated 24 to 31 December, dated the day the last
  of them rides; a rider connecting later doesn't take it back. Like FR-016a
  it MUST NOT reveal who rode or didn't; it reads only whether a rider was
  active on a date, which the consent text's team part already names, so no
  new consent version.
- **FR-017b**: The new badges MUST be shown, taken back and celebrated like
  the other surprise badges (FR-015b, FR-015c, US2): "?" until earned, why
  once earned, extra fun pictures. The catalog version is raised so riders'
  badges are worked out again under FR-031's silent rules: badges earned in
  the past by the new rules appear without a celebration.

**Winterschlaf beendet (2026-10-20, part J)**

- **FR-018**: "Überraschungen" MUST hold one more single badge, fourteen in
  all: Winterschlaf beendet, the first outdoor (not virtual) counting ride
  dated in a later calendar year than the season start, dated with that
  ride. It is shown, taken back and celebrated like FR-017b, and the catalog
  version is raised the same way.

- **FR-012**: Each category except the two surprise categories (FR-015,
  FR-016) MUST be a ladder
  of thresholds; the first set is in Assumptions. Changing the ladders is a release, after which badges are worked out
  again under FR-031's silent rules.
- **FR-013**: A badge's date earned MUST be the date of the activity, team event or
  correction that first made the value reach its threshold.

**Runs**

- **FR-020**: Outdoor runs (Strava sport types Run and TrailRun) from the season
  start MUST be kept with the minimum needed for badges: date and distance. Runs
  count their whole distance, added up over the season with no rounding per run.
  Runs entered manually count nothing and MUST NOT be kept.
- **FR-020a**: Virtual runs (VirtualRun) and runs Strava marks as indoor (treadmill)
  MUST count nothing and MUST NOT be kept. A run changed on Strava from indoor to
  outdoor, or back, MUST be added or removed on its next update.
- **FR-021**: Runs MUST NOT earn Rynke, appear in the ride list or take part in
  feature 003's ride rules (overlap, pause, speed). Other riders MUST NOT see any
  single run or a rider's running figures; runs reach them only inside the team
  sum "Running together" (FR-011).
- **FR-022**: Runs and swims since the season start of riders who connected
  before they were added MUST be picked up once after release, within the Strava
  request budget (Principle II), like feature 008's one-time re-read.
- **FR-023**: The consent text MUST name that runs and swims are read and kept for
  badges, and that ride and run kilometres and elevation count towards team sums. Per the
  project owner's decision (Clarifications), keeping data the app already receives
  and showing it to the team only as sums over all riders needs no new consent
  version (constitution Principle I).

**Swims**

- **FR-024**: Swims (Strava sport type Swim) from the season start MUST be kept
  with the minimum needed for badges: date and distance, like runs (FR-020).
  Pool and open-water swims both count their whole distance, added up over the
  season with no rounding per swim. Swims entered manually count nothing and
  MUST NOT be kept.
- **FR-025**: Swims MUST NOT earn Rynke, appear in the ride list or take part in
  feature 003's ride rules. Other riders MUST NOT see any single swim or a
  rider's swimming figures; swims count towards no team category except the
  team surprises, where only the date and hour of a swim count, like a run's
  (FR-016).

**Evaluation**

- **FR-030**: Badges MUST be a pure function of what features 001 and 003 store
  (rides, runs, swims, team events, attendance, corrections) and be worked out again on
  every evaluation; evaluating the same data twice MUST NOT change anything
  (Principle II).
- **FR-031**: Newly earned personal badges MUST be revealed once per rider with a
  celebration, and named in feature 010's notification for that evaluation. Badges
  earned through an import, the one-time re-read or a rule recalculation MUST NOT
  notify and MUST be revealed together in one reveal.
- **FR-032**: Team badges MUST be worked out from consenting riders only and MUST
  NOT reveal which riders contributed. A team badge earned after a rider connected
  MUST be revealed once to that rider. *(Amended by issue #125: a newly earned
  team badge MUST notify each listed rider it is new to, once per season, through
  feature 010's notification; see research R17.)*

- **FR-030a**: No badge and no progress bar MUST count anything dated after
  today's date in Berlin. A rest day (FR-015a) or team day off (FR-016) MUST
  be earned only once that day is over in Berlin, shown by a later activity
  dated today or earlier.

**Look and language**

- **FR-040**: Every badge MUST be drawn as the badge frame (personal or team) with
  its own picture in the frame's window, in the Rynke coin style (feature 012),
  working in light and dark mode; the progress bars use feature 011's design
  tokens.
- **FR-040a**: A badge without a picture of its own MUST show the frame with the
  coin's Rynke as a placeholder. Adding or replacing a picture MUST NOT change
  any badge's rules, ids or earned state.
- **FR-040b**: The frame MUST be able to carry a ribbon across its lower edge, in
  the ring's colour (black with yellow text for personal, team blue with dark
  text for team badges), with notched tails over the petals. The ribbon shape is
  part of the frame; the milestone on it ("1.000 km", "Halbmarathon") is page
  text from the catalogs, never part of the image. Pictures MUST keep the strip
  the ribbon covers free of anything important.
- **FR-041**: Badge names ("Wochenend-Krieger") MUST be German only and stay
  German in every app language: one list keyed by badge id, kept beside the
  catalogs in `src/i18n/messages/`, like feature 016's German-only quotes
  (`quotes.de.ts`). Everything else the section says (what each badge was for,
  the milestone on the ribbon, units, headings, the empty state) MUST come from
  the i18n catalogs in every language (FR-028).
- **FR-042**: The section MUST work at 360 px width and be readable with a screen
  reader: progress bars carry their values as text.

### Key Entities

- **Badge category**: a fixed definition: id, group (personal or team), unit, how
  its value is worked out, and its ladder of thresholds.
- **Badge**: one level of a category: category, threshold, German name, picture.
- **Earned badge**: rider (or the team), badge, date earned, and whether it has been
  revealed to the rider.
- **Run**: rider, Strava activity, date, distance, manual or not. Never linked to
  Rynke.
- **Swim**: rider, Strava activity, date, distance, manual or not. Never linked
  to Rynke.
- **Surprise badge**: a single badge of "Überraschungen" with its own rule, no
  threshold shown and no progress.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider sees a newly earned badge on their next visit after the
  activity is evaluated.
- **SC-002**: Evaluating the same activity twice never awards or celebrates a badge
  twice.
- **SC-003**: No badge that is still to be earned can be identified from the page:
  its name and picture appear nowhere in what the rider page sends to the browser.
  For a surprise badge not even its rule: the page shows only "?".
- **SC-004**: Adding any number of runs leaves every rider's Rynke, ride list, team
  leaderboard and every team badge except "Running together" unchanged; adding
  any number of swims leaves them all unchanged except the team surprises
  (FR-016).
- **SC-005**: The Abzeichen section works at 360 px width in both colour modes,
  without horizontal scrolling however many badges a rider has.

## Assumptions

- Features 003 (rides, team events, corrections), 004 (consent and visibility),
  010 (notifications), 011 (app shell), 012 (coin style and celebration) and 015
  (waiting state) exist.
- First ladders, to be confirmed with the organisers before release (thresholds
  only; names and pictures are written during planning):

  | Category                       | Unit        | Thresholds                                              |
  |--------------------------------|-------------|---------------------------------------------------------|
  | Distance                       | km          | 100, 500, 1,000, 2,500, 5,000                           |
  | Elevation                      | m           | 1,000, 5,000, 10,000, 25,000                            |
  | Team events attended           | events      | 1, 5, 10, 20                                            |
  | Technique training             | trainings   | 1, 2 (both planned)                                     |
  | Training Rynke                 | Rynke       | 1, 25, 50, 100, 150, 200, 250, 300, 400, 500            |
  | Run length                     | km          | 5, 10, 15, half marathon (21.0975), Pi-Run (31.4), marathon (42.195) |
  | Running                        | km          | 10, 25, 50, 100, 250, 500                               |
  | Ride length                    | km          | 50, 100, 150, 200, 250, 300                             |
  | Virtual rides                  | km          | 50, 100, 250, 500, 1,000                                |
  | Swim length                    | km          | 0.5, 1, 1.9, 3.8                                        |
  | Swimming                       | km          | 5, 10, 25, 50, 100                                      |
  | Winter November                | days        | 1, 5, 10                                                |
  | Winter December                | days        | 1, 5, 10                                                |
  | Winter January                 | days        | 1, 5, 10                                                |
  | Winter February                | days        | 1, 5, 10                                                |
  | Überraschungen                 | —           | 13 single badges (FR-015a, FR-017), no ladder           |
  | Team-Überraschungen (team)     | —           | 7 single badges (FR-016, FR-017a), no ladder            |
  | Training Rynke together (team) | Rynke       | 500, 1,000, 2,500, 5,000, 7,500, 10,000, 15,000, 20,000 |
  | Distance together (team)       | km          | 1,000, 5,000, 10,000, 25,000, 50,000, 100,000           |
  | Elevation together (team)      | m           | 10,000, 50,000, 100,000, 250,000, 500,000               |
  | Running together (team)        | km          | 100, 500, 1,000, 2,500, 5,000                           |
  | Big training (team)            | riders      | 5, 10, 15, 20, 30                                       |
  | Attendances (team)             | attendances | 25, 50, 100, 200, 400                                   |

- Team sums show no single rider's figures. While very few riders run, "Running
  together" is close to those riders' own totals; this is accepted, since riders
  see no names or per-rider shares.
- The season has two planned technique trainings; should organisers plan more, the
  ladder changes with a release (FR-012).
- Badge pictures are made outside the app, with an image generator and the art
  pipeline in `art/badges/` (frames, prompts, generation script); the first
  release may ship with placeholders only.
- Badges belong to one season, like Rynke; a new season starts every category at
  zero.
- The team badges live on each rider's own page below the rider's own; the Team
  tab stays as feature 016 defines it.
- Run length, Swim length and Swimming progress and thresholds are shown with one
  decimal (21.1 km, 42.2 km, 1.9 km); other distance-type progress is shown in
  whole units.
- With the season starting on 1 September and the tour in summer, each winter
  month falls into a season exactly once.
- Strava offers no weather data; the winter categories use the month as the
  stand-in for challenging conditions.
- With eight new personal categories the rider has 15 personal cards; all show
  all season (Clarifications 2026-10-12), so the cards' two-per-row layout
  (FR-002a) carries them.
- The rest day reads the rider's local start dates; Strava's activity list
  gives no information about days without activities, so a later activity is
  what shows a day was a rest day.
- With "Überraschungen" the rider has 16 personal cards; with
  "Team-Überraschungen" there are 7 team cards and 113 badges in all; part F's eight surprise
  badges make 121 (13 personal and 7 team surprises), with no new card.
- Distance-type progress is rounded down, so "noch 0 km" never
  appears for a badge not yet earned.
