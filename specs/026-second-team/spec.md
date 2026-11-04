# Feature Specification: A Second Team

**Feature Branch**: `spec/admin-view-and-second-team` (written alongside feature 025, on request)

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Run the app for a second team from one codebase, as
separate spaces. Leaderboards and member data are never shared; only the Strava app is
shared. Each team has its own domain. Rules, season, art, phrases and features become
per-team settings. Danish and Swedish translations. A repeatable process to generate
content with AI and rate it." Also issue #236.

## Context

The app is built for one team. A second team wants to use it, and Strava's approval
makes one shared Strava app a hard requirement. Strava allows one webhook subscription
and one callback domain per app, and its limits and its capacity of 999 riders apply
to the app as a whole.

**Decided**: Each team has its own deployment, database and domain. A small **gateway**
handles what can exist only once per Strava app, and it holds no rider data. There is
one Cloudflare account for now, and the design must not rule out separate accounts later.

**Terms**: A **team** is one group of riders with its own space. The **founding team**
is the team using the app today. **Team data** is everything that differs between teams
and is kept as data, not as branches in code. A **content set** is a body of generated
text or art for one team, such as its motivational phrases.

Usage statistics, administrators and blocking are feature 025, for one team. Bringing
the teams' figures together is part of this feature (FR-039).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A rider joins their own team (Priority: P1)

A rider of the second team opens that team's domain, connects with Strava and lands back
on the same domain, in a space where everything they see belongs to their team.

**Why this priority**: It is the feature. Without it there is no second team.

**Independent Test**: With a fake Strava and two local teams, connect a synthetic rider
through each domain. Check each ends up on their own domain, and that no page, list,
total or chart of one team contains anything of the other.

**Acceptance Scenarios**:

1. **Given** a member of the second team's club, **When** they connect on that team's
   domain, **Then** Strava's approval returns them to that domain, connected.
2. **Given** a rider who isn't in that team's club, **When** they connect, **Then** they
   are refused as an outsider is today, and nothing is stored, even if they belong to the
   other team.
3. **Given** a connected rider, **When** they view any page, **Then** leaderboards, team
   totals, surprises and events include only their team.
4. **Given** a return from Strava with changed or invented team details, **When** it
   reaches the gateway, **Then** it goes nowhere other than a known team's domain, and
   the team's existing sign-in check refuses it.

---

### User Story 2 - Rides reach the right team (Priority: P1)

A rider uploads a ride, and it counts for their team only. The founding team notices
nothing of the change, and a problem at one team doesn't delay the other.

**Why this priority**: The founding team is in the middle of its season, so this must not
cost it a single ride.

**Independent Test**: Send synthetic Strava events for riders of both teams and unknown
riders, with one team unreachable. Check the other team processes its events, the missed
ones arrive later, repeats don't double-count, and no Strava request is made for riders a
team doesn't know.

**Acceptance Scenarios**:

1. **Given** a Strava event, **When** it arrives, **Then** it is acknowledged within 2
   seconds and passed on to every team (Principle II).
2. **Given** a team that doesn't know the rider, **When** it receives the event, **Then**
   it drops it without a Strava request and without storing or logging the IDs.
3. **Given** a team that can't be reached, **When** an event is passed on, **Then** it is
   retried, and the other team isn't held up.
4. **Given** the switch of the Strava subscription to the gateway, **When** it happens,
   **Then** rides uploaded during the gap are still counted afterwards.

---

### User Story 3 - A team has its own rules and season (Priority: P1)

The maintainer sets a team's Rynke values, season dates, clubs and switchable features as
team data, and the app follows them without any code naming a team.

**Why this priority**: The second team's rules will differ in their values, and the
founding team's results must not change.

**Independent Test**: Run the whole test suite against both teams' data. Recalculate the
founding team's synthetic season before and after the change and compare the results.

**Acceptance Scenarios**:

1. **Given** different Rynke values for each team, **When** the same ride is scored by
   each, **Then** each team applies its own values and its own rule history.
2. **Given** a team's rules change, **When** its Rynke are recalculated, **Then** the
   other team's figures are untouched.
3. **Given** a feature turned off for a team, **When** its riders use the app, **Then**
   no page, menu entry, text or notification for it appears, and no work is done for it.
4. **Given** a team's data is incomplete, **When** the checks run, **Then** they fail
   and name what is missing, before anything is deployed.

---

### User Story 4 - A team looks like itself (Priority: P2)

A second team's rider sees their team's name, icon, coin, badges and phrases, and nothing
that refers to the founding team or Hamburg.

**Why this priority**: The app works without this, but the second team wouldn't launch.

**Independent Test**: Search every page, image reference, notification and downloadable
file of the second team's synthetic deployment for the founding team's names and art.

**Acceptance Scenarios**:

1. **Given** the second team's deployment, **When** any page is opened or the app is
   installed, **Then** name, icon and start screen are that team's.
2. **Given** art that shows a Hamburg motif, such as the coin and at least one badge,
   **When** the second team's rider sees it, **Then** they see their team's version.
3. **Given** motivational phrases, **When** a second-team rider sees one, **Then** it is
   from their team's English set, whatever language the rest of the app is in.
4. **Given** the founding team, **When** this feature is deployed, **Then** its name,
   art, phrases and colours are unchanged.

---

### User Story 5 - Danish and Swedish (Priority: P2)

A rider reads the app, including what they consent to, in Danish or Swedish.

**Why this priority**: The second team's riders need it, but the English fallback lets
technical work go ahead without it.

**Independent Test**: Switch a synthetic rider through each of a team's languages and
check every page, and that a language not offered by the team can't be picked.

**Acceptance Scenarios**:

1. **Given** a team offering Danish, **When** a rider picks it, **Then** all rider-facing
   text is Danish, including consent, privacy, notifications and the Strava block.
2. **Given** a visitor stating no language the team offers, **When** they arrive, **Then**
   they see the team's default language.
3. **Given** a missing translation key, **When** the checks run, **Then** they fail.
4. **Given** consent or privacy text in a new language, **When** it is released, **Then**
   a native speaker has reviewed it.

---

### User Story 6 - Generate and rate content (Priority: P2)

The maintainer writes a brief, generates about three times as many candidates as needed,
and a chosen person approves or rejects each on a rating page. The approved ones become
the team's set.

**Why this priority**: The second team needs about 430 phrases, and the process will be
needed again. It proved itself on the German phrases in October 2026, but the tool isn't
in the repository.

**Independent Test**: Run a small synthetic set through every step: brief, candidates,
rating, more candidates for the shortfall, and writing the set into team data. Stop and
restart halfway, and check no vote is lost.

**Acceptance Scenarios**:

1. **Given** a brief, **When** candidates are generated, **Then** near-duplicates and
   candidates breaking the set's rules are removed before anyone rates them.
2. **Given** candidates, **When** the rater opens the link in their own browser, **Then**
   they can approve or reject each without having the repository, and votes are kept.
3. **Given** fewer approved than needed, **When** another round is generated, **Then** it
   follows the approved ones in style and never repeats rejected ones.
4. **Given** a finished rating, **When** the set is written, **Then** only approved items
   enter team data and the existing checks for that content pass.

---

### User Story 7 - One change, every team (Priority: P2)

The maintainer merges a change once, and it reaches every team. If one team's deployment
fails, the other still gets the change, and it is clear what failed.

**Why this priority**: One codebase only pays off if two deployments aren't two chores.

**Independent Test**: In a dry run of the deployment workflow, make one team's step fail.
Check the other team's step finishes and the failed one is reported.

**Acceptance Scenarios**:

1. **Given** a merge into `main`, **When** checks pass, **Then** each team's database
   changes and code are deployed in that order, and the gateway if it changed.
2. **Given** one team's deployment fails, **When** the run ends, **Then** the other team
   is deployed, and the failure is visible and can be re-run for that team alone.
3. **Given** the gateway and teams deploy at different moments, **When** a mix of old and
   new versions runs, **Then** no event or sign-in is lost.

---

### Edge Cases

- **A rider in both teams' clubs**: Strava's grant and refresh token cover the app, not a
  team. A new refresh token [invalidates the old one at
  once](https://developers.strava.com/docs/authentication/), and revoking ends access
  for both teams, so two connections would break each other. The rider is told at
  connect that they can take part in one team at a time (FR-012).
- **The shared capacity of 999 is reached**: Strava refuses the connection, and the rider
  sees the existing "team full" page, even if their own team is small.
- **Strava's approval screen** shows the one app's name and icon to both teams' riders, so
  these must not be specific to one team.
- **A rider moves to the other team**: They leave one and connect to the other. Nothing
  moves with them.
- **The gateway is down**: Strava's events and sign-ins fail until it is back. Strava
  retries events only for a limited time, so this must be visible (feature 025 doesn't
  cover it; see Assumptions).
- **A team's domain or club is misconfigured**: Checks catch a missing value. A wrong one
  shows up as refused riders, not as riders landing in the wrong team, because each
  deployment has only its own database.
- **Cloudflare's bot protection** challenges Strava's and the gateway's requests on the
  Free plan (it has already swallowed webhooks once), so it stays off on every domain that
  receives them.
- **Budget**: One team's import can use up the shared Strava budget, slowing the other.
  This is first come, first served until it causes trouble; feature 025 shows who used it.
- **A team leaves**: Its deployment and database are deleted, its riders' grants revoked,
  and the other team isn't touched.
- **Season data already scored**: Changing a team's season start later leaves stored Rynke
  stale (#19), so it is set correctly before that team launches.

## Requirements *(mandatory)*

### Functional Requirements

**Separate spaces**

- **FR-001**: Each team MUST have its own deployment, database, work queue, schedule,
  secrets and domain.
- **FR-002**: No rider's data MUST be readable from another team's deployment. The only
  thing teams may exchange is usage figures without rider data (feature 025).
- **FR-003**: The founding team's domain, sign-ins, riders and history MUST keep working
  through the change, without riders having to act, other than any consent feature 025
  requires.
- **FR-004**: Adding a further team MUST need only team data, resources and a line of
  deployment settings, not code that names a team.

**Own domain and signing in**

- **FR-005**: The second team MUST be served only from its own domain, which is required
  for launch. Sessions, consent and installed apps MUST be tied to that domain.
- **FR-006**: Since Strava accepts one callback domain, approval MUST return through the
  gateway on that domain, which passes it on to the team's own domain. The rider MUST end
  on the domain where they started.
- **FR-007**: The gateway MUST only pass riders on to a fixed list of team domains. The
  team MUST check the sign-in as today.
- **FR-008**: The gateway MUST hold no database, rider data or Strava client secret, and
  MUST NOT log rider or activity IDs or sign-in codes.

**Events**

- **FR-009**: The gateway MUST answer Strava's subscription check, acknowledge each event
  within 2 seconds and pass it on to every team, retrying each team independently
  (Principle II).
- **FR-010**: A team MUST drop events about unknown riders without a Strava request, and
  without storing or logging their IDs.
- **FR-011**: Moving the Strava subscription to the gateway MUST be a documented manual
  step with a plan for rides uploaded during the gap.

**Strava sharing**

- **FR-012**: A rider who is also in another team's club MUST be told when connecting
  that they can take part in only one team at a time, and that connecting to both breaks
  the connection. Other teams' club IDs are team data; no rider data is shared for this.
- **FR-013**: Each team MUST respect Strava's limits using the app-wide figures Strava
  reports, without a central budget service.
- **FR-014**: Strava's app name, icon and description MUST NOT be specific to one team.
- **FR-015**: Strava's capacity MUST be treated as shared by all teams.

**Usage across teams** (extends feature 025)

- **FR-039**: Each team's admin view MUST show every team's absolute count and share of
  each usage figure and its history, with shared and not attributed usage apart. It MUST
  also show the total of connected riders against the capacity. No rider data crosses
  teams for this, and a team that can't be reached MUST NOT break the view.
- **FR-040**: Cloudflare's figures MUST be split by team wherever Cloudflare allows, and a
  figure that can't be split says so. Gateway usage counts as shared.
- **FR-041**: Since allowances are shared, every team's administrators MUST get the alerts
  of feature 025, and days before a team joined stay unchanged in the history.

**Team data**

- **FR-016**: All differences between teams MUST live in one place per team as data. Code
  MUST NOT branch on a team's name.
- **FR-017**: Team data MUST cover: team name, icon and install details; clubs; season
  and qualification dates; Rynke values and rule history; event kinds; languages and
  default language; controller and contact; art; content sets; colours and themes; and
  switchable features.
- **FR-018**: These features MUST be switchable per team: badges, motivational phrases,
  the Training leaderboard, the season album and fun themes. Everything is on by default.
- **FR-019**: Rules MUST stay pure and recomputable from stored data and team data
  (Principle IV). The general concept, such as how a ride becomes Rynke from Strava data,
  is common to all teams; only values differ.
- **FR-020**: With the founding team's data, Rynke, badges and text MUST be identical to
  before this feature.
- **FR-021**: Automated checks MUST run against every team's data, and MUST fail when a
  team's required data is missing.
- **FR-022**: Rule explanations for riders, including `docs/rynke-punkte.md` and its PDF,
  MUST match each team's values.

**Content and art**

- **FR-023**: No page, image or text of a team MUST show another team's name, place or art.
- **FR-024**: Art specific to the founding team, at least the coin and badges with Hamburg
  motifs, MUST have a replacement or be left out for other teams.
- **FR-025**: The second team's phrases MUST be a set of its own in English, following
  the same rules as today: a phrase never names, ranks or compares riders.

**Languages**

- **FR-026**: The app MUST ship Danish and Swedish catalogs, complete like every other
  catalog, with badge names translated or set per team.
- **FR-027**: Each team MUST set which languages it offers and its default language,
  which applies when a visitor states no language it offers. The founding team stays
  German by default.
- **FR-028**: Consent and privacy text MUST exist per team and per language, and name that
  team's controller. A native speaker MUST review Danish and Swedish consent and privacy
  text before release.

**Generated content**

- **FR-029**: Each content set MUST have a brief in the repository: tone, motifs, things to
  avoid and the target count.
- **FR-030**: The process MUST generate more candidates than needed (about three times),
  and remove near-duplicates and rule breakers before rating.
- **FR-031**: A rating page MUST let a person without the repository approve or reject
  each candidate on their own device, keep votes between visits, and export them.
- **FR-032**: Further rounds MUST learn from approved and rejected candidates, and MUST
  NOT offer a rejected candidate again.
- **FR-033**: Only approved candidates MUST reach team data.
- **FR-034**: Generation and rating MUST use no rider data (Principle I), and MUST stay out
  of the production app.

**Deployment**

- **FR-035**: A merge into `main` MUST deploy each team independently, with one team's
  failure neither stopping nor rolling back the other. Each team's deployment MUST be
  re-runnable alone.
- **FR-036**: Each team's deployment MUST use its own credential scope, and production
  remains deployable only from `main`.
- **FR-037**: Gateway and team versions MUST work together in any deployment order.
- **FR-038**: Local development and tests MUST run with synthetic data for every team, and
  MUST NOT contact Strava or Cloudflare.

### Key Entities

- **Team**: A group of riders with its own deployment, database, domain and team data.
- **Team data**: The settings, rules, text and art that make a team differ.
- **Gateway**: The single receiver of Strava's webhook and sign-in returns. It knows the
  list of team domains and nothing about riders.
- **Content set**: A team's body of content in one language, with its brief.
- **Candidate**: A generated item with its round and vote, kept outside the app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In tests, no request on one team's domain ever returns another team's rider
  data, and no page of the second team contains the founding team's name or art.
- **SC-002**: After the change, the founding team's recalculated Rynke, badges and page
  texts match those from before it on a synthetic season, with no difference.
- **SC-003**: No ride is lost in a test where one team is unreachable for an hour.
- **SC-004**: A rider completes connecting on the second team's domain in the same number
  of steps as today, and ends up on that domain.
- **SC-005**: Adding a third test team needs no change to application code.
- **SC-006**: A single merge reaches both teams without manual steps, and a failure at one
  team leaves the other on the new version.
- **SC-007**: A content set of 430 approved phrases can be produced with one person rating,
  with no votes lost between sessions.
- **SC-008**: All rider-facing text exists in Danish and Swedish, and consent and privacy
  text are reviewed by native speakers before launch.
- **SC-009**: Both teams together stay within Cloudflare's free limits in normal use, as
  shown by feature 025. Going beyond them is the trigger to split accounts.

## Assumptions

- **Order**: Team data ships first with no visible change for the founding team, then the
  gateway, then the second team. Feature 025 can ship at any point.
- **Accepted limits**: A team's deployment briefly sees the other team's athlete and
  activity IDs in events before dropping them. Budget is first come, first served. A second
  team's data sits in the maintainer's Cloudflare account.
- **Data responsibility**: The second team's responsible person is named as controller,
  while the maintainer operates the system and can technically reach its data. Whether that
  needs a data processing agreement is to be settled before launch.
- **Strava**: Serving a second team goes beyond the original application, and that is
  accepted. Whether to tell Strava, and whether new pages need another review, is to be
  checked (`docs/strava-developer-program.md`).
- **Scoring start**: If the second team starts scoring later than the season start, this
  is a later season start setting, with earlier rides not stored. A separate concept is
  only needed if they want earlier rides kept.
- **Constitution**: Its Language section makes German the default for all riders and calls
  them a German team. It needs amending to per-team default languages before implementation.
- **Rating page**: It may be hosted outside the app, since it holds only candidates and
  votes. Who rates is the second team's decision, since they know their humour.
- **Inputs needed from the second team before launch**: domain, Strava clubs, Rynke values,
  dates, languages, switchable features, controller and contact, art direction, a phrase
  brief, a rater and native-speaker reviewers.
- **Further teams**: More teams may follow, but that's only a thought for now and nothing
  is built for it. The second team is the one to ship. Where it costs nothing extra, the
  design doesn't assume exactly two teams: lists of teams rather than "the other team",
  and no per-team steps that would be painful to repeat. The Strava cap of 999 athletes
  and the Cloudflare limits are shared, so further teams use up the same room.
- **Out of scope**: Separate Cloudflare accounts (kept possible, not built), per-team budget
  caps, monitoring the gateway beyond its errors, sharing anything between teams' riders,
  and team switching in the app.
