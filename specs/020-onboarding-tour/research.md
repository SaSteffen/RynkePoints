# Research: Onboarding Tour That Explains the Rules

## R1. Steps chosen per viewer (FR-001, FR-002)

**Decision**: `TOURS` lists every step; a step only for riders who aren't
organisers is marked `riderOnly`, and `tourSteps(tour, viewer)` filters it out
for organisers. Hints, counts, "Weiter" links and the Settings link all go
through `tourSteps`.

**Rationale**: the same rule as the navigation's `riderOnly` Termine tab
(019 research R8), so the tour never points at a tab the viewer doesn't have.

**Alternatives**: a separate rider tour for organisers — duplicates every
other step and the texts' order.

## R2. Addressing a step, and pointing at an element (FR-003, FR-004)

**Decision**: `?tour=<id>&step=<n>` (1-based). The step shows when it belongs
to the page; otherwise the page's first step of that tour shows, which also
covers the release's old `?tour=rider` links. A step with a `target` links with
`#<target>`, the element carries that `id`, and the card carries
`data-target="<target>"`; the stylesheet outlines
`body:has(.tour[data-target=X]) #X` and gives the targets a scroll margin under
the top bar. A step with a target doesn't highlight the navigation item.

**Rationale**: server-rendered like the rest of the tour, no page script; the
fragment is the browser's own way to bring an element into view, and `:has()`
is already how the tour hides the app prompt.

**Alternatives**: `:target` alone — loses the highlight when the fragment is
gone (shared link, reload without it); a script — the tour has none today.

## R3. The example rider (FR-005, FR-006)

**Decision**: `exampleRiderView(window, today)` in `src/http/tour-example.ts`
returns a `RiderViewRead`, the shape Du and Fahrten already read from D1, built
by running seven synthetic rides through `evaluateRides`, two attended events
through `evaluateAttendance`, and both through `tally`, all with
`CURRENT_RULES`. With the current rules it shows 43 of 250 Training Rynke, 6 of
25 Team Rynke, 40 of 167 "draußen", 920 of 1,000 m to the next elevation step,
a 7.4 km ride that counts with 0 Training Rynke, and a 42 km ride that doesn't
count: 2 h 10 min of pause for 1 h 40 min of riding, a café stop the rules
don't allow (rules version 3: no more pause than riding). Its card keeps the
"Warum?" open, as every ride that doesn't count does, and the Fahrten step
points at the whole card.

The rides: 85 km/900 m, 7.4 km/40 m, 42 km/180 m with the long pause, 35 km/300 m
virtual, 48 km/420 m gravel, 28 km/650 m MTB, 62 km/610 m; the events: one team
training, one technique training.

**Rationale**: the pages' own view model and renderers stay unchanged, and the
numbers can't contradict the rules because the rules compute them. `dev/`'s
samples are off limits to `src/` (feature 006 FR-009).

**Alternatives**: hand-written balance numbers — would drift from the rules on
the next rules version; reusing `dev/fake-strava/samples.ts` — forbidden.

## R4. The example's dates

**Decision**: counted back 1–17 days from today, with today held inside the
counting window (the season start before it starts, the deadline after it
ends), and never before the season start. Rides start at distinct hours, so
even rides moved to the same day never overlap.

**Rationale**: every example ride and event counts by the window rule whenever
the tour is taken, and the dates look recent.

## R5. Keeping the example apart (FR-007)

**Decision**: the example is computed per request and only rendered. On an
example step the Overview reads no "seen Rynke", writes none and shows no
celebration; the ride cards render without the "Auf Strava ansehen" link (the
ids are invented and would point at strangers' activities); a note above the
data says it is an example. Outside the tour's Du and Fahrten steps nothing
changes.

## R6. Texts and rule values (FR-008, FR-009)

**Decision**: new messages `tour.example`, `tour.rider.elevation`,
`tour.rider.teamRynke`, `tour.rider.outdoor`, `tour.rider.shortRide`,
`tour.rider.events` in `de` and `en` (see [contracts/messages.md](contracts/messages.md)).
Every hint is given the same parameters from `CURRENT_RULES`: the distance and
elevation steps and their Rynke, the three team-event Team amounts, the Team
and Training thresholds, the virtual share and the Training Rynke needed
without virtual rides.

**On "too short"**: there is no minimum length in the rules (feature 003
FR-004): every full 10 km earn a Training Rynke, so a shorter ride counts with
0 distance Rynke and its elevation still counts. The hint says exactly that
rather than calling the ride "not counting".

## R7. The peloton step (owner's review)

**Decision**: a second Team step pointing at feature 016's peloton figure
(`id="tour-peloton"`), on the real page: the team's own totals, no names, the
viewer's coin marked. The figure shows only on Training and only with the
viewer on the leaderboard; without it, the hint shows with nothing outlined.

**Rationale**: the peloton is nameless by design (016), so the real one is fine
to show; an example team on Team would also need an example leaderboard and team
chart for one figure.

## R8. The example team (FR-012 – FR-015)

**Decision**: `exampleTeam(window, today)` in `src/http/tour-example.ts` returns
what the Orga pages read: six riders (`TeamRider`, balances from `tally` with
`CURRENT_RULES`), their listing, two open requests, and three events with intent
counts and the organiser's own attendance. Each rider's Training and Team Rynke
are a share of today's even pace (`evenPace`), so the groups hold on any day:
three behind (one only on Team, one with mostly virtual rides), two ahead, one
qualified.
On the first day of the season the pace is 0 and nobody is behind. The events
are dated from today: one in five days with four intents, one three days ago
with both requests and without the organiser, one ten days ago with them.

The overview reads it through `overviewBody`, the events page through the same
rendering as the real list (`EventsRead`, now read by `readEvents` or taken from
the example); the new-event form stays the real one.

**Rationale**: the rider tour's reason (R3): the pages and their figures come
from the real code, and a new organiser at the season start has no requests or
events to look at.

**Alternatives**: the real team — empty at the start, and the tour would point
at real riders' data; a separate tour page — duplicates the pages it explains.

## R9. Keeping the example team inert (FR-014)

**Decision**: the example's overview, open requests and event lists carry the
`inert` attribute: no button, tile or link in them can be used or focused. The
note above says so. The new-event form, outside the example, works.

**Rationale**: the example's ids are invented; a tap on "Eintragen" or a name
would send them to the real handlers. `inert` takes the whole subtree out in one
attribute, in every browser the app supports.

**Alternatives**: rendering without forms and links — a second variant of every
renderer; leaving it usable — the handlers would refuse the ids, but only after
a confusing round trip.

## R10. Where the Orga steps point

**Decision**: at elements that show once on every width: the group tiles
(`tour-groups`), the pace line above the riders (`tour-pace`), the open
requests (`tour-requests`), the new-event form (`tour-new-event`), the upcoming
and the past example event (`tour-later-event`, `tour-past-event`). Not at a
rider: the overview shows riders as cards on phones and as a table on wide
screens, so one `id` can't mark both; the pace step's text names the tap on a
name instead. The targets are listed once in `src/http/tour-targets.ts`, which
the stylesheet reads for the outline and the scroll margin.
