# Feature Specification: Longer pause for Hamburg

**Feature Branch**: `040-longer-pause`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Hamburg rules change: a ride's pause (elapsed minus moving time) may be up to twice its moving time instead of up to its moving time (new rules version with an effective date, like version 3 did for ½ → 1). Applies to Hamburg only; Europe keeps its own rules. Riders' rules handout (rynke-punkte.md) must say the new limit."

## Background

Today a Hamburg ride doesn't count when its pause (total time minus moving
time) is longer than its moving time (rules version 3). An aggregate look at
the season so far (2026-09-01 to 2026-11-17, no names or ride IDs recorded
here):

- 545 rides, 21 don't count for the pause, all of them under 50 km, 14 under
  20 km.
- Long rides pause the most in minutes (median 81 min over 100 km) but never
  fail: they bring enough moving time.
- The failures fall into three groups: a recording that kept running for hours
  (pause 3–17× the moving time), a short ride with one long stop (1.3–4.7×),
  and close misses (1.0–1.1×).

With a limit of twice the moving time, 8 of the 21 pass the pause rule; 7 of
them count (one stays excluded as an e-bike ride). That adds 6 Training Rynke
across 4 riders, crosses no elevation step and makes nobody newly qualified.
Forgotten-running recordings still don't count.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A ride with a long stop counts (Priority: P1)

A Hamburg rider rides 20 km to a café, sits there an hour and rides home, all
in one recording: 45 min moving, 70 min pause. Today the ride counts nothing;
with the new rule it counts like any other ride.

**Why this priority**: It is the change itself.

**Independent Test**: Evaluate a Hamburg ride with pause between one and two
times its moving time and see it count.

**Acceptance Scenarios**:

1. **Given** a Hamburg ride with 45 min moving and 70 min pause, **When** it
   is evaluated under the new rules, **Then** it counts and earns its distance
   and elevation Rynke.
2. **Given** a Hamburg ride with 45 min moving and exactly 90 min pause,
   **When** it is evaluated, **Then** it counts (the limit is inclusive, as
   today).
3. **Given** a Hamburg ride with 45 min moving and 91 min pause, **When** it is
   evaluated, **Then** it doesn't count, with the pause reason.
4. **Given** a ride from before the change that failed only for its pause and
   is within the new limit, **When** the new rules take effect, **Then** it
   counts and the rider's balance includes it.

---

### User Story 2 - Riders read the new limit (Priority: P2)

A rider whose ride doesn't count for its pause sees a reason that names the
new limit, and the Hamburg rules handout says the same.

**Why this priority**: The rule only works if riders can follow it.

**Independent Test**: Open a Hamburg ride that fails for its pause and read
the reason; read the pause section of the handout.

**Acceptance Scenarios**:

1. **Given** a Hamburg ride failing for its pause, **When** the rider opens
   it, **Then** the reason says the pause may be at most twice the moving time,
   in the rider's language.
2. **Given** the Hamburg handout, **When** a rider reads the pause section,
   **Then** the text and every example match the new limit.

### Edge Cases

- A ride with no moving time still never counts (no change).
- A ride whose total time is unknown is judged as today (no change).
- A ride that now passes the pause rule but fails another rule (e-bike, speed,
  manual, …) still doesn't count, with the other reasons.
- A ride that now counts may overlap another counting ride; the overlap rule
  applies as usual.
- Team Europe's riders see no change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For Team Hamburg, a ride MUST NOT count for its pause only when
  its pause is longer than twice its moving time.
- **FR-002**: The change MUST be a new Hamburg rules version; every other rule
  value stays as in the current version.
- **FR-003**: The new version MUST apply to the whole season, like version 3
  did: every stored Hamburg ride is evaluated again under it, and balances,
  rankings and qualification follow.
- **FR-004**: Team Europe's rules MUST NOT change.
- **FR-005**: The pause reason a rider sees MUST state the new limit, in all
  ten languages.
- **FR-006**: The Hamburg handout (`docs/rynke-punkte.md`) MUST describe the
  new limit, with its examples recomputed (e.g. "100 km, 4 h moving, 5 h
  pause" now counts).
- **FR-007**: No rider is asked for consent again: the change reads no new
  data.

### Key Entities

- **Hamburg rules version**: the rule values that judge a ride, here the
  allowed pause relative to moving time (from 1× to 2×).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the change, every Hamburg ride from this season whose only
  reason was the pause and whose pause is at most twice its moving time counts
  (7 rides at the time of writing).
- **SC-002**: Every Hamburg ride with pause above twice its moving time still
  doesn't count (13 rides at the time of writing).
- **SC-003**: Team Europe's results are unchanged.
- **SC-004**: The pause reason and the handout name the same limit.

## Assumptions

- The new version takes effect on the day it is released; the exact date is
  set when it ships.
- "Pause" keeps its meaning: total recorded time minus moving time.
- The figures in Background are a snapshot; they'll move as the season goes on.
