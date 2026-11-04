# Feature Specification: Sponsoring-Rynke

**Feature Branch**: `031-sponsoring-rynke`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "A third Rynke category, Sponsoring-Rynke. Rynke for contacts, much more
for money obtained through personal campaigns and sponsorships. New team and individual badges, new
monkey lines depending on how the individual is doing, practical tips. No minimum requirement to join
the tour. The goal is to motivate people to get into sponsoring. The data comes from a job on a
developer machine or home server, about once a day, that reads the sponsoring status and the team
sheet and pushes to Cloudflare. Architecture, concept and UI mockups matter now, the scraper later."

## Context

Sponsoring is the team's core business, and the app so far only rewards riding and turning up. The
team is mixed: salespeople and developers who rarely look strangers in the eye, first-timers and
people who have done this for years. Some have never asked anyone for money and don't know how to
start.

Sponsoringrynke give them a reason and a first step. They reward asking as well as closing, so
someone with many contacts and no sponsor yet still sees progress. Most contacts never pay, and
winning a €1,000 company is about as hard as winning a €250 one, so Rynke follow the close more than
the amount. Euros appear beside the Rynke as their own figure.

**Visual reference**: the concept page [`drafts/concept.html`](drafts/concept.html). Open it from a
checkout; it needs no server. It holds the scoring lab, the architecture drawing and the mockups. The
mockups in [`drafts/app/`](drafts/app/) are the app's real pages from local fake mode with the
sponsoring parts added, at phone and desktop width, so they show what's around each part. Their look,
order and placement apply. Their people and figures are made up, their German lines and tips are
drafts, and the green coin and badge pictures are placeholders.

**Terms**:

- **Sponsoring season**: 1 September to 31 August, whenever the riding evaluation starts.
- **Contact**: a person or company the team sheet lists for a rider with a real touchpoint, such as a
  mail, a social media message or a call. A contact either exists or it doesn't.
- **Sponsor**: a company that chose one of the six packages through a rider and has finally paid.
- **Campaign money**: finalised money from a rider's personal campaign, and gifts without a package.
- **Collection**: sponsors' euros plus campaign money. This is the charity figure.
- **Team sponsorship**: money that pays for the team, not the charity. It's a separate figure and
  never part of the collection.
- **Material sponsorship**: goods or services, rated by an organiser with a T-shirt size.
- **Started**: a rider has at least one contact, or any money or sponsorship credited, this season.
- **Snapshot**: one complete statement of the season's figures, pushed by the job.
- **Job**: a program outside the app, on a developer machine or home server, that reads the team's
  sources and pushes snapshots.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my own Sponsoringrynke and where they come from (Priority: P1)

A rider opens Du and finds their Sponsoringrynke as a third line in the top card, a Sponsoring card with
their euros, the date of the figures and the next milestone, and the sponsoring sources in "Woher deine
Rynke kommen".

**Why this priority**: Without a rider's own number nothing else motivates anyone. It's also the
smallest slice that shows the whole chain from figures to Rynke.

**Independent Test**: Apply a synthetic snapshot and compare one rider's card with the rules by hand.

**Acceptance Scenarios**:

1. **Given** a rider with 12 contacts, **When** they read the card, **Then** contacts show 24 Rynke.
2. **Given** a rider with a Gold sponsor who paid €2,700, **When** they read the card, **Then** the
   sponsor shows 225 Rynke from the package, and the euros show €2,700.
3. **Given** a rider with a €1,500 team sponsorship, **When** they read the card, **Then** it earns
   175 Rynke, is marked as not part of the collection, and doesn't add to their collection euros.
4. **Given** a rider's Training and Team Rynke, **When** they gain Sponsoringrynke, **Then** those two
   numbers and the rider's tour qualification don't change.
5. **Given** a rider with nothing yet, **When** they read the card, **Then** it shows 0 and a first
   step, without a warning or a target.
6. **Given** the yellow qualification card, the progress gauges and the season charts, **When** a rider
   reads them, **Then** none of them mentions sponsoring, and "Dir fehlen noch" never lists
   Sponsoringrynke.

---

### User Story 2 - Figures arrive once a day without anyone typing them (Priority: P1)

The job pushes a snapshot, usually once a day. The app replaces the season's figures with it, keeps
the old ones when something looks wrong, and never stores a sponsor's name.

**Why this priority**: Every other story reads these figures. A sample snapshot is enough to build
and test the rest, so the job's reading of the sources can come later.

**Independent Test**: Push synthetic snapshots with and without the right token, twice in a row, and
with a falling figure, then compare what's stored.

**Acceptance Scenarios**:

1. **Given** a valid snapshot and token, **When** it's pushed, **Then** the season's figures match it
   and every page shows its date.
2. **Given** the same snapshot pushed twice, **When** the pages are compared, **Then** nothing differs
   and no Rynke are counted twice.
3. **Given** a wrong or missing token, **When** a snapshot is pushed, **Then** it's refused and
   nothing changes.
4. **Given** a snapshot in which any rider's or the team's figure falls, or which names a rider the
   app doesn't know, **When** it's pushed, **Then** the whole update is held and the last applied
   figures stay.
5. **Given** a snapshot with an unknown package or a malformed field, **When** it's pushed, **Then**
   it's refused with a reason and nothing changes.
6. **Given** a snapshot older than the last applied one, or for another season, **When** it's pushed,
   **Then** it's refused and nothing changes.
7. **Given** any applied snapshot, **When** everything stored for it is read, **Then** it contains no
   sponsor name, contact person or free text.

---

### User Story 3 - See the team's sponsoring together (Priority: P1)

The Team tab gets a third position on its switch, next to Training and Team. It shows the team's
Sponsoringrynke, how many riders have started, the money over the season and a ranking without names.

**Why this priority**: The count of riders who have started tells people they aren't alone. The
shared figure is what makes this a team effort.

**Independent Test**: With a synthetic snapshot, open the Sponsoring view as a rider and compare
each figure with the snapshot and the rules.

**Acceptance Scenarios**:

1. **Given** 23 of 41 riders have started, **When** a rider opens the view, **Then** it says so, with
   one coin per rider and no names.
2. **Given** the collection graph, **When** a rider switches between Euro and Rynke, **Then** one line
   for this season shows the chosen measure, from 1 September.
3. **Given** team sponsorships of €4,000, **When** a rider reads the money, **Then** they appear as a
   separate figure beside the collection, not in it.
4. **Given** the ranking, **When** a rider who has started reads it, **Then** they see their own
   position marked, others without names, and Rynke and euros on each row.
5. **Given** a rider who hasn't started, **When** they open the view, **Then** they see no position
   and aren't listed, and the ranking holds only riders who have started.
6. **Given** any figure on the view, **When** it's read, **Then** no percentage of a goal appears.
7. **Given** Training or Team on the switch, **When** a rider uses them, **Then** they work as before.

---

### User Story 4 - Get a push and a useful tip that fit my situation (Priority: P2)

The monkey says something that fits how the rider is doing, and a tip gives one concrete thing to try.
Someone who avoids cold calls finds a route that works without them, and someone experienced gets
something other than beginner advice.

**Why this priority**: This is what gets people started, but the figures work without it, and the
wording needs review by experienced fundraisers.

**Independent Test**: Sign in as sample riders in each of the four situations and read the line and
the tips.

**Acceptance Scenarios**:

1. **Given** a rider with no contact and no money, **When** they open Du, **Then** the line and tip
   belong to the first situation, and at least one tip for it needs no call to a stranger.
2. **Given** a rider with contacts and no money, **When** they open Du, **Then** the line and tip are
   about asking again and naming a package.
3. **Given** a rider's first sponsor, **When** they open Du, **Then** the line and tip are about thanks
   and recommendations.
4. **Given** a rider with several sponsors, **When** they open Du, **Then** the line and tip are about
   passing on what worked, without the sponsors' names.
5. **Given** a tip, **When** the rider taps "Noch ein Tipp", **Then** another tip for the same situation
   appears.
6. **Given** any line or tip, **When** it's read, **Then** it doesn't compare the rider with anyone or
   scold them for what they haven't done.

---

### User Story 5 - Earn sponsoring badges (Priority: P2)

Sponsoring categories appear as ordinary cards in the existing Deine and Team lists on Abzeichen, each
showing its highest badge and a bar to the next one, like every other category.

**Why this priority**: Badges reward steps along the way and give the next milestone its content, but
Rynke and figures come first.

**Independent Test**: Apply synthetic snapshots that cross each threshold and check the badge list.

**Acceptance Scenarios**:

1. **Given** a rider's first contact, **When** the snapshot is applied, **Then** they earn "Erste
   Anfrage".
2. **Given** a sponsor with the Silber package, **When** the snapshot is applied, **Then** the rider
   earns the Silber badge and no other package badge.
3. **Given** half of the riders have started on a day, **When** more riders join later, **Then** the
   team keeps "Die Hälfte hat angefangen" for the season.
4. **Given** a new sponsoring season, **When** the Abzeichen page opens, **Then** the group starts
   again from nothing, and earned badges of earlier seasons stay where earlier seasons' badges are.
5. **Given** a team with badges switched off, **When** a rider opens the app, **Then** no sponsoring
   badge appears anywhere.

---

### User Story 6 - Organisers see where the team stands and rate material sponsorships (Priority: P2)

Organisers get a Sponsoring view with counts, the money over the season and last season's line, whether
the figures are fresh and whether an update was held. They rate material sponsorships here.

**Why this priority**: Organisers need to trust the figures and are the only ones who can rate
material sponsorships, but riders' pages work without this view.

**Independent Test**: As an organiser, read the view with a good snapshot and a held one, rate a
material sponsorship and push a new snapshot.

**Acceptance Scenarios**:

1. **Given** the Sponsoring view, **When** an organiser reads it, **Then** they see riders started,
   collection, contacts, sponsors, team sponsorship and material sponsorships as counts or sums, and
   no list of riders who haven't started.
2. **Given** a recorded last season, **When** an organiser reads the graph, **Then** last season's
   money appears as a comparison line beside this season's, in any case.
3. **Given** a held update, **When** an organiser reads the view, **Then** they see why it was held,
   and they can accept or discard it.
4. **Given** an organiser picks a rider and size M, **When** they save, **Then** the rider gains 100
   Rynke, and the rating records who gave it.
5. **Given** a material rating, **When** a new snapshot is applied, **Then** the rating is still there.
6. **Given** a material rating, **When** an organiser changes the size or removes it, **Then** the
   rider's Rynke follow.
7. **Given** a person who isn't an organiser, **When** they try to open the view or save a rating,
   **Then** it's refused.

---

### User Story 7 - Riders are told before their figures appear (Priority: P2)

Everyone takes part, with no opt-in, since riders already see each other's sponsoring figures. The app
says once what it now shows, and the connect and privacy texts name it.

**Why this priority**: It's needed before launch on a live team, but it doesn't change what the
feature does.

**Independent Test**: Sign in as a connected rider before and after dismissing the notice. Read the
connect and privacy texts in every language.

**Acceptance Scenarios**:

1. **Given** a connected rider, **When** they first open the app with the feature on, **Then** they see
   a notice once, saying which figures are shown, to whom and where they come from.
2. **Given** the notice, **When** the rider reads it, **Then** it says leaving the app is the way to have
   these figures removed from it, and that the team's own lists stay outside the app.
3. **Given** the notice has not been dismissed, **When** the rider uses the app, **Then** nothing is
   blocked, and their figures count anyway.
4. **Given** a rider connecting for the first time, **When** they read the consent text, **Then** it
   names the sponsoring figures.

---

### User Story 8 - Turn it on per team (Priority: P3)

A team decides whether it uses this feature and whether riders see last season's line. A second team
runs its own job with its own token.

**Why this priority**: Only one team uses this at first, but the settings are cheap now and the second
team talks are under way.

**Independent Test**: Run with each setting on and off, and compare the pages and what the push
accepts.

**Acceptance Scenarios**:

1. **Given** the feature is off, **When** anyone uses the app, **Then** no sponsoring view, card, badge,
   notice or text appears, and a pushed snapshot is refused.
2. **Given** the rider setting for last season's line is on, **When** a rider opens the money graph,
   **Then** the line appears in the Euro measure, without a percentage.
3. **Given** the same setting is off, **When** a rider opens the graph, **Then** there's no line and no
   sign of last season's money.
4. **Given** a setting holds an invalid value, **When** the app reads it, **Then** it fails visibly.

---

### User Story 9 - Try it with a realistic team (Priority: P3)

A developer running the app locally sees all of this with sample riders, without a job, the intranet
or any real sponsor.

**Why this priority**: It makes the feature buildable and reviewable long before the job exists.

**Independent Test**: Start the local fake mode and walk through the screens as sample riders.

**Acceptance Scenarios**:

1. **Given** local fake mode, **When** a developer signs in as sample riders, **Then** they can see all
   four situations, the ranking, badges, and the Orga view with both a good and a held update.

### Edge Cases

- **Rider who joined mid-season**: the next snapshot counts everything the sources credit to them for
  the whole season.
- **Person in the sources who isn't in the app**: the job sends only a count of unmatched names and adds
  their money to one anonymous sum. The count is shown to organisers and never holds an update, since
  it may stay above zero all season. The collection includes the sum, so it matches the team's own
  total.
- **Rider leaves**: all their sponsoring figures and material ratings are deleted with everything else.
  The job's next rider list no longer has them, and their money moves into the anonymous sum, so the
  team's money doesn't fall.
- **Rider leaves after the job fetched its list**: that snapshot names an unknown rider and is held. The
  next run fixes itself, and a newer clean snapshot replaces any held one.
- **Falling figure that is correct**: a list was cleaned up and a contact really wasn't one. An organiser
  accepts the held update, and Rynke and badges follow the new figures.
- **Accepting an update with an unknown rider**: that rider's entry is dropped, and their money counts in
  the anonymous sum.
- **Same-day pushes**: the later one replaces the earlier one's figures for that day.
- **No snapshot for days**: pages keep the last figures with their date. Administrators are alerted after
  three days without an applied update.
- **No snapshot yet this season**: pages show "no figures yet" and not a rider's zero as if it were known.
- **Season change**: on 1 September all season figures start from zero, whenever the riding evaluation
  starts. A snapshot for the old season is refused from that day on.
- **Package and payment differ**: a sponsor on Gold who paid €2,700 earns Gold's Rynke and adds €2,700 to
  the collection.
- **Money of €500 or more without a package**: counts as campaign money.
- **Platin and Platin Plus**: the sponsorship belongs to one team at full price, though its perks are
  shared across teams.
- **Small sums**: Rynke for campaign money round down on the rider's total, so €4 earns none, but the
  rider has started.
- **Team sponsorship without a rider**: it adds only to the team's figure and earns no one Rynke.
- **Team sponsorship of €400**: earns 80 Rynke; above €500 the curve continues from 100 without a jump.
- **Rating for someone who left**: it's deleted with them. It doesn't return if they connect again.
- **First season with this feature**: no last-season line exists, and the legend doesn't mention it.
- **Rule values change mid-season**: all of the season's Rynke are recomputed with the new values.

## Requirements *(mandatory)*

### Functional Requirements

**Scoring**

- **FR-001**: The app MUST keep Sponsoringrynke as a third category, separate from Training and Team
  Rynke. They MUST NOT count toward tour qualification or any other riding requirement. Taking part in
  sponsoring MUST NOT be a condition for anything else in the app.
- **FR-002**: A contact MUST earn 2 Rynke, once per contact, however many touchpoints it had.
- **FR-003**: A sponsor MUST earn Rynke by the package chosen, regardless of what was paid: Bronze
  (€500) 100, Silber (€1,500) 175, Gold (€2,500) 225, Gold Plus (€5,000) 325, Platin (€12,500) 500,
  Platin Plus (€25,000) 700.
- **FR-004**: Campaign money MUST earn 1 Rynke per €5 of the rider's season total, rounded down.
- **FR-005**: A team sponsorship won by a rider MUST earn 1 Rynke per €5 up to €500. Above €500 it MUST
  earn `100 × √(euros / 500)`, rounded to the nearest 25, so €1,000 earns 150, €1,500 earns 175, €2,500
  earns 225 and €5,000 earns 325. Each team sponsorship is scored on its own.
- **FR-006**: A team sponsorship with no rider behind it MUST add only to the team's figure.
- **FR-007**: A material sponsorship MUST earn Rynke by its size: XS 25, S 50, M 100, L 175, XL 300.
- **FR-008**: All values in FR-002 to FR-007 MUST be rule values that can change without touching stored
  figures. Rynke MUST be a pure result of rule values, stored figures and ratings, so that a season can
  be recomputed at any time.
- **FR-009**: Money MUST feed only the euro figures: sponsors' euros and campaign money the collection,
  team sponsorships their separate figure. Team sponsorships and material sponsorships MUST NOT count
  in the collection.
- **FR-010**: Figures MUST belong to a sponsoring season from 1 September to 31 August, regardless of any
  riding evaluation start. Only finalised money counts.

**Receiving figures**

- **FR-011**: The app MUST accept a snapshot only with a team's own secret token, and only while the
  feature is on. It MUST offer the job, under the same token, a list of riders with only their app
  identifier and name, and nothing that comes from Strava.
- **FR-012**: A snapshot MUST hold the season, its date, and per rider: contacts, campaign money, sponsors
  (reference, package, euros, date closed) and team sponsorships (reference, euros). For the team it MUST
  hold the number of unmatched names, the money of people outside the app, and team sponsorship money
  without a rider.
- **FR-013**: A reference MUST be a keyed hash of the sponsor's name, made by the job, that stays the same
  from day to day and can't be read back. The app MUST refuse any reference that doesn't have that form,
  so that a name can't slip in.
- **FR-014**: Sponsor names, contact people and contact details MUST NOT reach the app. Snapshots and
  ratings MUST have no free-text field.
- **FR-015**: A valid snapshot MUST replace the season's figures as a whole, and pushing the same snapshot
  again MUST change nothing. A partial or failed update MUST leave the previous figures in place.
- **FR-016**: The app MUST refuse, with a reason, a malformed snapshot, one for another season and one older
  than the last applied.
- **FR-017**: The app MUST hold a valid snapshot in which any rider's contacts or money, or the team's money,
  fall, or which names a rider it doesn't know. A held update MUST NOT change any figure until accepted.
  Only the newest held update is kept. A newer snapshot that would not be held replaces it and is applied.
- **FR-018**: Organisers MUST be able to accept or discard a held update, and the app MUST record who did
  which. Accepting drops entries of unknown riders and moves their money to the anonymous sum.
- **FR-019**: The app MUST keep the team's and riders' daily figures, enough to draw the season graphs and
  the weekly gain. Sponsors' money MUST be placed on the date closed, and other figures on the snapshot's
  date.
- **FR-020**: Administrators MUST get an alert through the existing usage alert switch and channel after
  three days without an applied update. Every page with these figures MUST show their date.

**Rider's view**

- **FR-021**: Du MUST show the rider's Sponsoringrynke as a third line in the top card, linking to a Sponsoring
  card that follows "Woher deine Rynke kommen" (beside it at desktop width). The card MUST hold the monkey's line,
  the Rynke, the collection euros, the figures' date, a next milestone from the next unearned badge in place of a
  target, and the tip. "Woher deine Rynke kommen" MUST gain a Sponsoring block under the team events with Rynke per
  source: contacts, sponsors, campaign, team sponsorship and material. The qualification card, progress gauges and
  season charts MUST NOT change.
- **FR-022**: The product word MUST be "Sponsoringrynke" in the German catalog. There MUST be no new
  bottom-navigation tab.
- **FR-023**: The app MUST sort each rider into one situation from this season's figures alone: **Neu** (no
  contact, no money), **Angefragt** (contact, no money), **Erster Sponsor** (some money and less than the
  next situation) and **Läuft** (at least 2 sponsors, or at least €2,500 in the collection). Nobody chooses
  a type. Team and material sponsorship count as money for this.
- **FR-024**: Each situation MUST have its own list of monkey lines, separate from the existing lists. The
  rule that quotes aren't about fundraising stays for those existing lists and doesn't apply to these.
- **FR-025**: Each situation MUST have at least five practical tips, one shown at a time, with a way to see
  another. Neu MUST include tips that need no call to a stranger, such as the employer's donation process, a
  short mail or the rider's own network.
- **FR-026**: Lines and tips MUST NOT compare the rider with named or ranked people, scold them, name real
  sponsors or suggest sharing sponsors' or contacts' details. They follow the house style for fun German
  copy.

**Team view**

- **FR-027**: The Team tab's switch MUST gain a Sponsoring position. Its view MUST follow the order of the other
  two: the monkey's line, the team's Sponsoringrynke and weekly gain, the switch, the rider's position with the
  distance to the next one, riders started in the peloton's place, the money graph in the weekly chart's place, and
  the ranking. Training and Team views MUST otherwise stay as they are, and the switch MUST fit on a phone.
- **FR-028**: "Riders started" MUST show the count and one coin per rider, without names.
- **FR-029**: The money graph MUST use the form of the existing weekly team chart, bars per week and a line for the
  running total, for this season from 1 September, switchable between euros and Rynke.
  Team sponsorship money MUST appear as its own figure beside it. It MUST NOT show a percentage or goal.
- **FR-030**: Last season's money MAY appear only as a comparison line in the Euro measure. Riders see it
  only if the team's setting allows; the default is off. Organisers always see it.
- **FR-031**: The ranking MUST carry no names, MUST mark the viewing rider, MUST show Rynke and euros per row,
  and MUST list only riders who have started, with the existing "Um dich herum" and "Alle" choices. Positions
  count only those riders ("Position 6 von 23"). A rider who hasn't started MUST see no position.

**Badges**

- **FR-032**: Personal badges MUST be, by category: Kontakte (1, 10, 50), Eingeworben (first euro, €5,000, €10,000,
  from the rider's collection), Pakete (one for each of the six), Sponsoren (3), Teamsponsoring and Material.
- **FR-033**: Team badges MUST be, by category: Eingeworben gemeinsam (€1,000, €25,000, €100,000, from the
  collection), Angefangen (half, all) and Kontakte gemeinsam (500). The two "started" badges are decided per day and
  stay for the season once reached.
- **FR-034**: Sponsoring categories MUST be ordinary cards in the existing Deine and Team lists, with the same
  empty state, "next badge" bar, sorting and "Neueste" and "Alle" choices. They MUST start afresh each sponsoring
  season and MUST follow the team's existing badge switch. Corrections may take away a personal badge that the figures no
  longer earn.

**Organiser's view**

- **FR-035**: The Orga switch MUST gain a Sponsoring position next to Rider and Termine, which stay as they are. Its
  view MUST show the figures' date and status, unmatched names, riders
  started, collection, contacts, sponsors, team sponsorship, material sponsorships and the money graph.
- **FR-036**: The view MUST NOT list who hasn't started, and MUST NOT add a "needs a push" group for sponsoring.
- **FR-037**: Organisers MUST be able to record, change and remove a material rating: a rider, a size and who
  rated it. A snapshot MUST NOT change a rating.

**Consent and privacy**

- **FR-038**: Every connected rider MUST take part, with no opt-in. The feature MUST NOT block anyone or depend
  on an answer.
- **FR-039**: A rider MUST see a one-time notice naming the figures, who sees them and where they come from. The
  connect consent text and the privacy page MUST name them too, in every language.
- **FR-040**: The figures and ratings MUST be deleted with the rider when they leave, promptly and completely. A
  later snapshot naming them is held as unknown. Daily team totals stay, since they name nobody.
- **FR-041**: Sponsoring figures MUST NOT be written to a Strava activity description or sent to Strava.

**Settings and text**

- **FR-042**: Per team, one setting MUST turn the feature on or off, off by default, and another MUST control
  riders' view of last season's line. Rule values MUST be per team too. An invalid value MUST fail visibly.
- **FR-043**: All rider-facing text MUST live in the catalogs, in every language.
- **FR-044**: Local fake mode MUST bring a synthetic snapshot with sample riders in all four situations, plus a
  way to see a held update. None of it may reach the production bundle.

**Fit with the rest of the app**

- **FR-046**: The first-steps tours for riders and organisers MUST gain a stop for the new switch positions and the
  Sponsoring card, while the feature is on.
- **FR-047**: Fahrten, Termine, Einstellungen and the Rider view MUST NOT change, apart from the privacy link's text
  (FR-039).

**Project rules**

- **FR-045**: Before implementation, the constitution MUST be amended to allow one job outside Cloudflare that's
  optional for running the app, to let points come from stored sponsoring figures as well as activities, and to
  allow a notice in place of asking again for these figures (FR-038, FR-039).

### Key Entities

- **Snapshot record**: when it arrived, its date, whether it's applied, held or discarded, why, and who decided.
- **Rider's season figures**: season, rider, contacts, campaign money.
- **Sponsor entry**: season, rider, reference, package, euros, date closed.
- **Team sponsorship entry**: season, rider if any, reference, euros.
- **Material rating**: season, rider, size, who rated. No note.
- **Daily figures**: season, day, rider or team, and the values the graphs and weekly gain need.
- **Rule values**: Rynke per contact, package, campaign euro, team sponsorship curve and T-shirt size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a synthetic season, every rider's Sponsoringrynke equals a hand calculation from the rule
  tables, and recomputing from stored figures gives identical numbers.
- **SC-002**: Pushing the same snapshot any number of times gives identical pages.
- **SC-003**: No sponsor name appears anywhere in stored data or pages after any accepted snapshot, and a push
  that tries to carry one is refused.
- **SC-004**: An update with a falling figure changes nothing on riders' pages until an organiser accepts it.
- **SC-005**: At the default values, five Bronze sponsors earn more Rynke than one Gold sponsor for the same
  €2,500, and one Platin sponsor earns five times what one Bronze earns, at 25 times the price.
- **SC-006**: A rider with contacts and no money sees progress: 30 contacts earn 60 Rynke, more than a €250
  personal campaign's 50.
- **SC-007**: A rider who has never asked anyone finds a first step they can do without calling a stranger, in
  under a minute from opening Du.
- **SC-008**: Training and Team Rynke, their rankings and tour qualification are identical with the feature on or
  off, for the same riding data.
- **SC-009**: After a rider leaves, nothing about them remains in sponsoring data, and the team's money doesn't
  fall with the next snapshot.
- **SC-010**: With the job stopped for a week, every page still works, shows the figures' date, and administrators
  have been alerted once per their usual alert rules.
- **SC-011**: By 31 December of the first sponsoring season, the Sponsoring view shows at least half of the team
  as started.

## Assumptions

- **Contact Rynke**: "binary" means once per contact, however many mails or calls it had. If it should instead
  mean once for having any contact at all, FR-002 changes.
- **Started** counts any contact or credited money or sponsorship. Decided here from the concept.
- **Situation thresholds** (FR-023) and badge thresholds are starting values, like the Rynke, and can change.
- **Consent**: the app shows new things to other riders here, which the constitution currently says needs a new
  question. The user decided on no opt-in, since these figures are team business and already visible to all riders.
  This spec reads that as a notice instead, with the constitution amended first (FR-045). The data controller
  confirms the legal basis before launch.
- **Figures are not Strava data**: they come from the team, so Strava's sharing rules don't apply to them.
- **Rule values** live with the team's data and change by a code or configuration change, like the riding rules, not
  through a screen.
- **Outside money**: the anonymous sum isn't in the concept's first draft. It's there so the team's money matches
  its own lists and doesn't fall when a rider leaves.
- **Sponsors per rider**: the source credits a sponsor to one rider. Riders rarely share them, and the job decides
  how if they do.
- **One rider's history**: situations read this season only, so a veteran begins each September as Neu. "Noch ein
  Tipp" gets them past that. Using last season's figures can come later if this feels wrong.
- **Retention**: rider-level figures of past seasons follow the same rules as past riding data, and team daily totals
  stay for the comparison line.
- **Tips**: experienced fundraisers on the team review all lines and tips before launch. Whether they prove useful
  is an open question that only use can answer, so they're cheap to change.
- **Badge art**: mockups use placeholders. Pictures come from the usual badge art process.
- **Allowances**: one small push a day and existing page reads stay inside the free tier. The plan measures it.
- **Second team**: the settings exist per team, but only one team is expected to use this feature at first.

### Out of Scope

- How the job reads the intranet and the team sheet, its adapters and its schedule. This spec fixes only what it
  pushes. Building the job comes after the app's side, first run by hand with the sheet.
- A rider entering or correcting figures in the app. Corrections happen in the team's sources.
- Sponsor management of any kind: names, contact history, reminders or a shared pipeline.
- Goals or percentages for the team or a rider.
- Per-rider sponsoring figures for organisers. They already have them in the team's own lists.
- A last-season line for the first season, unless a season was recorded.
- Sponsoring in season albums and rider summaries.
- Push notifications about sponsoring. Earned badges and new figures show on the next visit.
