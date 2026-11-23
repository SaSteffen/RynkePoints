# Feature Specification: Gateway Routing

**Feature Branch**: `046-gateway-routing`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "lets tackle this one: issue #400", with the backlog prompt
`specs/backlog/gateway-routing.md`: "Specify how the Strava gateway (feature 026) sends each Strava
event only to the teams that hold that athlete, instead of to every team. [...] Missing an entry
must never lose an event: an athlete the gateway doesn't know still goes to every team. [...] Cover
guests (feature 041). [...] The check before withdrawing a person's Strava access [...] keeps
asking the teams, not the copy, and its answer still never names a team. This is the gateway's
first rider data, so it changes feature 026's promise that the gateway holds none. Say what it
keeps, where (EU, like the teams' databases), for how long, who can see it, and what the privacy
notice tells riders." Not before the move to Cloudflare's paid plan, which comes with the third
team.

## Context

All teams share one Strava app, and Strava sends all its events to one address: the gateway
(feature 026). The gateway passes every event on to every team. A team that doesn't know the
athlete drops it without a Strava request and without storing or logging the ID (feature 026
FR-010). With two teams that is one needless delivery per event. With eleven teams, every rider's
events go to ten teams' apps that have no business seeing them, even if they drop them at once.

This feature makes the gateway send each event only to the teams that hold that athlete. For that
it keeps a **copy** of which teams hold which athletes. Each team's own database stays the real
record; the copy only steers deliveries, and whenever it may be wrong, the gateway falls back to
sending to more teams, never fewer.

The goal is data minimisation, not cost: on Cloudflare's paid plan, which the third team needs
anyway, broadcasting costs cents. The feature goes live only after that move.

Since feature 044, a person rides for one team at a time, so most athletes are held by exactly one
team. Guests (feature 041) are the exception: an administrator of one team whom another team lists
by hand is held by both.

**Terms**:

- **Hold**: a team holds a person when its database has them, as a rider (connected or waiting to
  reconnect) or as a guest. A person on a team's block list only is not held.
- **Copy**: the gateway's list of athlete IDs, each with the teams that hold that athlete.
- **Report**: a team telling the gateway that it now holds a person, or no longer does.
- **Full list**: every athlete a team holds, sent by that team to the gateway, which replaces that
  team's part of the copy.
- **Routing team**: a team whose last full list reached the gateway recently enough (FR-007).
  Every other team is sent every event, as today.
- **The team question**: the question a team asks, through the gateway, whether another team holds
  a person (feature 041 FR-009, feature 044).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A rider's events reach only their team (Priority: P1)

A rider of one team uploads a ride. Strava tells the gateway, and the gateway passes the event on
to that team only. The other teams never see it. The ride shows up on the rider's team as fast as
today.

**Why this priority**: This is the feature: less of a rider's data passed to teams that don't hold
them.

**Independent Test**: In fake mode, with every team behind the local gateway, upload a ride for a
sample rider of one team and watch which teams receive the event.

**Acceptance Scenarios**:

1. **Given** a rider held by one team, all teams routing, **When** Strava sends an event about
   them, **Then** the gateway passes it to that team only.
2. **Given** a guest held by their own team and by the team they visit, **When** Strava sends an
   event about them, **Then** both teams receive it, and no other.
3. **Given** a person who deauthorizes the app at Strava, **When** Strava sends that event,
   **Then** every team that holds them receives it and deletes them as today.
4. **Given** an event the gateway passes on, **When** it reaches the team, **Then** it is acked,
   retried and processed as today; only the set of receiving teams changed.

---

### User Story 2 - A gap in the copy never loses an event (Priority: P1)

A person has just connected, and their team's report hasn't reached the gateway yet. Strava sends
an event about them. The gateway doesn't know the athlete, so it sends the event to every team, as
today, and the team that holds them processes it.

**Why this priority**: A lost event is a ride that doesn't count. The copy may only ever narrow
deliveries where it is sure.

**Independent Test**: In fake mode, empty the copy, or make a team's reports fail, and check that
every event still reaches the team that holds the athlete.

**Acceptance Scenarios**:

1. **Given** an athlete the copy doesn't list, **When** Strava sends an event about them, **Then**
   the gateway sends it to every team.
2. **Given** a team that isn't routing (it never sent a full list, or its last one is too old),
   **When** Strava sends any event, **Then** that team receives it, whatever the copy says.
3. **Given** a team whose report failed when a person connected, **When** the report is retried
   or the team's next full list arrives, **Then** the copy lists them, and until then the
   fallbacks above apply.
4. **Given** the copy can't be read when an event arrives, **When** the gateway passes it on,
   **Then** it sends it to every team.

---

### User Story 3 - The copy follows the teams (Priority: P2)

Teams keep the copy current without anyone doing anything by hand. A team reports a person when it
stores them and when it deletes them, and sends its full list once a day. A rider who switches
teams (feature 044), joins a second team as a guest, leaves, or is removed, is reflected in the copy
within a day at the latest, usually at once.

**Why this priority**: Routing is only as good as the copy. Without it, User Story 1 degrades to
today's broadcast, which is safe but defeats the purpose.

**Independent Test**: In fake mode, connect, switch, add a guest and disconnect sample riders, and
check the copy after each step and after the daily full lists.

**Acceptance Scenarios**:

1. **Given** a team stores a person (connect, switch to it, a guest signing in), **When** that is
   done, **Then** the team reports that it holds them.
2. **Given** a team deletes a person (leaving, deauthorization, removal by an administrator, letting
   them go after a switch), **When** that is done, **Then** the team reports
   that it no longer holds them.
3. **Given** the daily run, **When** it is done, **Then** each team sends its full list, and the
   gateway replaces that team's part of the copy with it.
4. **Given** a team that leaves the gateway's list of teams, **When** the gateway next runs,
   **Then** that team's part of the copy is gone.

---

### User Story 4 - Riders are told what the gateway keeps (Priority: P2)

A rider reads the privacy notice and learns that the gateway keeps their Strava ID with the team
that holds them, only to pass Strava's messages to that team, and for how long.

**Why this priority**: This is the gateway's first rider data. Feature 026 promised it would hold
none, and riders must be told before it starts.

**Independent Test**: Open the privacy notice on each team's site in each language.

**Acceptance Scenarios**:

1. **Given** the privacy notice, **When** a rider reads it, **Then** it says what the gateway keeps,
   why, where, for how long and who can see it (FR-014).
2. **Given** a rider who accepted the consent before this feature, **When** it goes live, **Then**
   they are not asked again.

### Edge Cases

- **An athlete listed under a team that no longer holds them** (they left, and the report failed):
  That team receives their events until its next full list and drops them, as every team does
  today. Never more than a day.
- **An athlete listed under one team while another also holds them** (a guest whose second team's
  report failed): The second team misses their events until the retried report or its next full
  list. Its daily ride re-check (feature 036) then stores the rides it missed, as it does after any
  lost event.
- **A rider who switches teams**: The team they leave reports them gone, the new team reports them
  held. Whichever arrives first, the event goes to the new team once its report is in; before
  that, an athlete with no teams left in the copy goes to every team.
- **The gateway can't store a report**: The team keeps the report and retries it with its own
  work queue. The person's connect, switch or leaving is never held up or refused for it.
- **A team's daily run fails for days**: After FR-007's limit the team stops routing and receives
  every event again, until a full list arrives.
- **A new team joins**: It isn't routing until its first full list, so it receives every event from
  the start and misses nothing.
- **Events for an athlete nobody holds** (they disconnected, and Strava still sends one last
  event): The copy doesn't list them, so the event goes to every team, which drop it as today.
- **The team question and the let-go request** (feature 041, feature 044): The gateway keeps asking
  every team, never the copy. Its answer still never names a team.
- **A single team, tests, local development and sandboxes**: The same rules apply. Local development
  runs the local gateway with its own copy; tests never touch a production copy.
- **Old and new versions side by side during a deployment**: A team that doesn't report yet sends
  no full list, so it isn't routing and receives every event. A gateway that doesn't take reports
  yet refuses them, and teams retry them later, without errors shown to riders.

## Requirements *(mandatory)*

### Functional Requirements

**Routing**

- **FR-001**: For each event, the gateway MUST send it to every team the copy lists for the event's
  athlete, plus every team that isn't routing. It MUST send it to every team when the copy lists
  none for that athlete, or can't be read.
- **FR-002**: The gateway MUST keep acknowledging Strava's events within 2 seconds and retry each
  team independently (feature 026 FR-009, Principle II). Choosing the teams MUST NOT delay the
  acknowledgement beyond that; if it would, the gateway sends to every team.
- **FR-003**: The team question and the let-go request (feature 041, feature 044) MUST keep asking
  the teams themselves and MUST NOT read the copy. Their answers MUST still never name a team.

**Keeping the copy current**

- **FR-004**: A team MUST report a person as held as soon as it has stored them, as a rider or a
  guest, and as no longer held as soon as it has deleted them, for any reason. A person kept only on
  a block list is not held.
- **FR-005**: A report that can't be delivered MUST be retried by the team until the gateway
  accepts it or a later full list makes it unnecessary. It MUST NOT hold up or refuse the rider's
  connect, switch or leaving.
- **FR-006**: Each team MUST send its full list to the gateway once a day. The gateway MUST replace
  that team's part of the copy with it, and nothing else.
- **FR-007**: A team MUST count as routing only while its last full list is at most 48 hours old.
  Otherwise, or before its first one, the gateway MUST send it every event.
- **FR-008**: A team MUST only be able to change its own part of the copy, authenticated as for the
  team question. Nothing in a report or full list from one team can add, change or remove another
  team's entries.
- **FR-009**: When a team leaves the gateway's list of teams, the gateway MUST delete that team's
  part of the copy.

**What the gateway keeps**

- **FR-010**: The copy MUST hold only athlete IDs and the IDs of the teams holding them, and when
  each team's last full list arrived. No names, activities, tokens, dates of joining, guest or rider
  status, or anything else about a person.
- **FR-011**: An entry MUST be deleted as soon as the team reports the person gone, and at the
  latest with that team's next full list. An athlete with no team left MUST leave the copy.
- **FR-012**: The copy MUST be stored in the EU, like the teams' databases. Only the maintainers with
  access to the gateway's Cloudflare account can read it; no page, admin view or answer of the
  gateway shows it.
- **FR-013**: The gateway MUST keep logging no rider or activity IDs (feature 026 FR-008 otherwise
  stands): its log lines name a team and a status, never an athlete. Feature 026 FR-008's "no
  database, no rider data" is replaced by FR-010 to FR-012.

**Privacy and text**

- **FR-014**: The privacy notice MUST say, before routing goes live, that the shared Strava gateway
  keeps the person's Strava ID together with the team or teams that hold them, only to pass
  Strava's messages to those teams; that it is stored in the EU; that it is deleted when they leave,
  at the latest a day later; and that only the maintainers can see it. It MUST name no other team.
- **FR-015**: This is not a consent change: the app reads nothing new from Strava and shows nothing
  new to anyone. Riders MUST NOT be asked again.
- **FR-016**: All rider-facing text this feature adds MUST be in the catalogs, in all ten languages.

**Development and rollout**

- **FR-017**: Local development MUST run the local gateway with routing and its own copy, so it
  mirrors production. Tests and local development MUST NOT read or write a production copy.
- **FR-018**: Routing MUST go live only after the move to Cloudflare's Workers paid plan. Until
  then, gateway and teams may carry the code, but no team is routing.
- **FR-019**: The maintainer documentation for the gateway MUST say how routing falls back, how to
  check which teams are routing, and how to empty the copy, which only brings back the broadcast.

### Key Entities

- **Copy entry**: an athlete ID and the teams that hold that athlete. Exists only while at least
  one team holds them.
- **Team's list date**: per team, when its last full list arrived. Decides whether the team is
  routing.
- **Report**: from one team, about one athlete: held or no longer held. Kept by the team until the
  gateway accepts it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With every team routing, an event about a person held by one team reaches exactly one
  team; about a guest, exactly the two teams that hold them.
- **SC-002**: No event about a held athlete fails to reach a team that holds them because of the
  copy: in tests that drop reports, empty the copy, make it unreadable or let a team's full list
  age past the limit, every event still reaches every team that holds its athlete.
- **SC-003**: A team's part of the copy matches its database within a day, and within a minute of
  a connect, switch or leaving whenever the gateway is reachable.
- **SC-004**: Strava's events are still acknowledged within 2 seconds, and rides show up on the
  rider's team as fast as before.
- **SC-005**: The privacy notice on every team's site, in all ten languages, describes the copy
  before any team routes.

## Assumptions

- Holding is what matters, not riding: a team that holds a person only as a guest, or only waiting
  to reconnect, still receives their events. That keeps today's behaviour for those people.
- The daily full list goes with each team's existing daily run; no new schedule per team is needed
  beyond it.
- 48 hours as the limit for a full list leaves room for one failed daily run without falling back.
- The feature reads no new data from Strava and shows nothing to anyone, so under the constitution
  it needs a privacy-notice update, not a consent revision.
- The paid plan comes with the third team (decided 2026-11-19). The copy fits the free plan too;
  waiting is the maintainer's decision, not a technical limit.
- Out of scope: answering the team question from the copy, showing the copy to anyone, routing
  anything other than Strava's webhook events (sign-ins already go to the right team), and using
  the copy for statistics.
