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
by running six synthetic rides through `evaluateRides`, two attended events
through `evaluateAttendance`, and both through `tally`, all with
`CURRENT_RULES`. With the current rules it shows 43 of 250 Training Rynke, 6 of
25 Team Rynke, 40 of 167 "draußen", 920 of 1,000 m to the next elevation step,
and a 7.4 km ride that counts with 0 Training Rynke.

The rides: 85 km/900 m, 7.4 km/40 m, 35 km/300 m virtual, 48 km/420 m gravel,
28 km/650 m MTB, 62 km/610 m; the events: one team training, one technique
training.

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
