# Research: Team Europe's Own Rules

Every decision below keeps Hamburg's data, stored results and pages as they are (FR-001–FR-004).
The guiding rule: a value Hamburg doesn't set is **absent** from Hamburg's objects, never added
with a neutral value, so Hamburg's rule objects, rule fingerprint, badge catalog version and
pages stay byte-identical.

## R1 — The minimum ride length is an optional rule value

**Decision**: `RynkeRules` gains `minRideKm?: number`. Absent means no minimum, which is Hamburg's
"0 km". Present, it is a positive whole number of kilometres, and a ride whose `distanceM` is below
`minRideKm × 1000` gets the new reason `too_short` (R5). Europe's rules set `minRideKm: 25`.

**Rationale**: Hamburg's three rule objects stay exactly as they are, so `rulesFingerprint`, the
"has the values of data-model.md" test in `test/unit/rules.test.ts` and the pinned fingerprint keep
passing unchanged, and Hamburg's `version` stays 3. The daily cron re-evaluates only riders stored
with a version other than the current one, so no Hamburg rider is re-evaluated, re-notified or
changed (FR-002). Comparing metres with `minRideKm × 1000` is exact: 24,999.9 m doesn't count,
25,000.0 m does (spec edge case "exactly 25 km").

**Alternatives considered**:
- `minRideKm: 0` in every Hamburg object: changes Hamburg's fingerprint and the pinned values test,
  which says "raise the version", and raising it re-evaluates every Hamburg rider. Rejected (FR-002).
- A team-data field outside the rules: the rule wouldn't be versioned with the results it explains,
  and the rider page couldn't explain an older result with the minimum of its version. Rejected.
- Fractional kilometres: nobody asked for them; whole kilometres match the other distance values.

## R2 — "No Team Rynke" is a rule value too: `teamThreshold: null`

**Decision**: `RynkeRules.teamThreshold` becomes `number | null`. `null` means the team has no Team
Rynke: `tally` sets `teamMissing` to 0, so qualification rests on Training Rynke and the virtual
share alone (FR-011, SC-005). A rule set with `teamThreshold: null` earns no Team Rynke from events
either: `assertValidRules` requires every `teamEvents[kind].team` to be 0 then. Hamburg's objects
keep `teamThreshold: 25`, unchanged.

The predicate the pages use is `hasTeamRynke(team)`: the team's current rules have a threshold.

**Rationale**: Qualification is decided per rule version, and `tally` takes only the rules, so the
switch must be in the rules. Changing the type and not Hamburg's values keeps Hamburg's fingerprint.
The type change makes `tsc` list every place that reads `teamThreshold`, which are exactly the
places that show Team Rynke (rider view, gauges, progress chart, organiser overview, tour example,
album); none can be forgotten. The existing test that `teamThreshold: 0` is refused still passes:
0 stays invalid, only `null` is new.

**Alternatives considered**:
- `teamThreshold: 0` for Europe: `assertValidRules` and its existing test refuse 0, and "0 needed"
  would still show a gauge reading 100 %. Rejected.
- A `teamRynke: boolean` in `TeamData`: `tally` couldn't see it without a new parameter on every
  evaluation path, and a stored result's version wouldn't record it. Rejected.
- An optional `team?: { threshold, events }` group: restructures Hamburg's objects and changes its
  fingerprint. Rejected.

## R3 — "No events" is `eventKinds: []`, tied to R2 by a check

**Decision**: Europe's `eventKinds` becomes `[]`. A team without event kinds has no event pages,
no event navigation, no reports and no attendance (FR-012). `team-check` and a team test enforce
the invariant: **no Team Rynke ⇔ no event kinds**. Team Rynke come only from team events (corrections
aside), so a team with event kinds but no Team Rynke, or the other way round, isn't a state anyone
asked for, and refusing it keeps the pages to two cases: Hamburg's and Europe's.

The predicate is `hasEvents(team)`: `eventKinds.length > 0`. The existing `tourDays` switch
(`eventKinds.includes("tour_de_paris")`) stays as it is.

**Rationale**: `eventKinds` is already team data (feature 026) and today only feeds the tour-days
switch; an empty list now also means "no events". Nothing new to name.

**Alternatives considered**: a separate `events: boolean` — two fields saying one thing. Rejected.

## R4 — Europe's rule history: the three shared versions, then its own version 4

**Decision**: `europe.rules` becomes `[...hamburg.rules.slice(0, 3), EUROPE_RULES_V4]`. Version 4 is
Hamburg's version 3 values plus `minRideKm: 25`, `teamThreshold: null` and every team-event amount
0, effective on the release date. Hamburg's history keeps `[V1, V2, V3]`.

**Rationale**: It is the documented way to change rules ("raise `version`, keep the previous object
in `rules`", `src/teams/hamburg.ts`), applied to Europe's history: Europe really ran on versions 1–3
since feature 026. Europe's sandbox has results stored with version 3, so the rider page can still
explain them until the daily run re-evaluates them to version 4, and the next run does that by
itself. Europe production has no riders yet (its database is a placeholder), so nothing else is
affected. `slice(0, 3)` stays right when Hamburg later adds a version 4 of its own, since rule
histories only grow at the end.

**Alternatives considered**:
- A fresh history starting at version 1: a sandbox result stored with version 3 would have no rules
  to explain it until the cron ran, one stored with version 1 would never be re-evaluated, and
  versions 1–3 would mean different rules in the two teams' histories. Rejected.
- `[...hamburg.rules, V4]`: breaks the day Hamburg adds its own version 4. Rejected.

## R5 — The `too_short` reason

**Decision**: `REASON_CODES` gains `too_short`, after `manual` and before `pause`, and
`reasonsFor` checks it right after the flagged and manual checks, before the moving-time early
return, so a ride with no moving time that is also short lists both. It is **not** in
`FIXABLE_REASONS` (feature 036: a crop only shortens a ride) nor in the rider page's `FIXABLE` fix
hint (feature 005 FR-044). The rider page shows it as `{ code: "too_short", distanceKmTenths,
limitKm }`, the distance rounded **down** to a tenth like the speeds that broke a lower limit, with
`limitKm` from the rules of the result's version (`null` for an unknown version: the `.noLimit`
text).

**Rationale**: Follows the existing reason pattern (`too_slow`) exactly. Stored reasons are a JSON
list without a constraint, so no migration. Hamburg never produces the code: its rules have no
minimum.

**Alternatives considered**: hiding short rides from the list — the spec wants the reason shown
(FR-008).

## R6 — Hiding Team Rynke and events: in the view models, plus two guards

**Decision**: Pages already render optional parts: `renderSummary` skips a missing condition,
`renderGauges` a missing gauge, the Team tab has one view when `rynkeViews` is off, the tour drops
steps of hidden sections. A team without Team Rynke gets `null` where the view models hold Team Rynke
(`Summary.team`, `Gauges.team`, the progress series and table column, the Team tab's Team view and
kind switch, the hero's Team figure, the organiser overview's Team column, pace and breakdown, the
corrections form's Team field). A team without events gets `"events"` in `hiddenSections` (no menu
entry, no tour step, 404, as the `BADGES` switch already works), no Orga switch to the events, and
no events part on `/me` or in the album. `TourSwitches` gains `teamRynke` and `events`; the Team
Rynke step and the four organiser event steps get `only: "teamRynke"` / `only: "events"`, the
mechanism the graphs step already uses.

Two guards stop requests the pages no longer offer:
- **Routes**: when `!hasEvents(team)` the router answers 404 for `/events…`, `/organiser/events…`
  and `/organiser/requests…`, and `/organiser` (today the events page) redirects to
  `/organiser/riders`, where Orga's menu entry already points.
- **Domain**: `teamEventChange` refuses a kind outside `ctx.team.eventKinds` (`TeamEventRefused`),
  and a correction with a non-zero Team amount when `!hasTeamRynke(team)`. Sample seeding goes through
  the same function, so Europe's samples can't hold events (FR-016).

**Rationale**: One predicate per concept, read where the decision belongs; Hamburg takes the same
code path as today because both predicates are true for it. The guards keep the trust boundary for
forms that a team doesn't render.

**Alternatives considered**: CSS hiding or per-page `team.id` checks — a branch on the team in code,
forbidden by feature 026 (FR-003). Rejected.

## R7 — Text variants: `<id>.noEvents`

**Decision**: A text that mentions Team Rynke or events inside a sentence the other team still needs
gets a sibling key `<id>.noEvents` in all ten catalogs (German is the key source). A typed helper
picks it: `eventsText(team, id)` returns `id` when `hasEvents(team)`, else `` `${id}.noEvents` ``; its
type only accepts ids whose `.noEvents` sibling exists. Texts that only belong to Team Rynke or
events need no variant: they aren't rendered (R6). The list is in contracts/messages.md.

**Rationale**: Hamburg keeps calling the same keys with the same text. Europe's wording is written
fresh in English for a distributed team (no group rides assumed), then translated; the existing
`tour.organiser.newEvent.tourDays` shows the team-dependent text pattern already.

**Alternatives considered**: parameters like `{eventsPart}` spliced into sentences — breaks grammar
in ten languages. Rejected.

## R8 — Consent: no new version or revision

**Decision**: `CONSENT_VERSIONS` stays as it is (3, revision 1) for both teams. Europe's consent
form, landing purpose and privacy notice use the `.noEvents` texts (FR-013).

**Rationale**: The list is shared by both teams; a revision would make Hamburg's new riders record
3.2 for a text that didn't change for them (FR-001). No Europe rider has accepted any text in
production (Europe isn't deployed), and the Europe text only drops a use of data, which the
constitution counts as at most a minor revision with no re-ask; with no rider to tell, there is
nothing to record.

**Alternatives considered**: per-team consent version lists — machinery for a difference no rider can
have accepted. Rejected.

## R9 — Event-only badges: a category flag, filtered for display

**Decision**: `BadgeCategory` gains `events?: true` on `team_events`, `technique`, `big_training`,
`attendances` and `tour_de_paris`. `badgesFor(team)` returns `BADGES` when `hasEvents(team)`, else
`BADGES` without those categories; the badges page, its hints (feature 034), team badge news and the
album list badges through it. `BADGE_CATALOG_VERSION` stays 9 and the evaluation is unchanged: without
events no event-only badge can be earned, so none is ever stored for Europe.

**Rationale**: The flag names what makes these badges different; `badge-catalog.test.ts` compares
ids, groups and thresholds with `art/badges/badges.json`, none of which change. Hamburg's list is the
same array as today.

**Alternatives considered**: deriving "event-only" from units (`events`, `attendances`, …): `days`
is shared with the winter badges, so the tour days would need a special case. Rejected.

## R10 — Clubs

**Decision**: `STRAVA_CLUB_ID` becomes `2292744` in `env.europe` and `env.sandbox-europe`;
`STRAVA_EXTRA_CLUB_IDS` stays `""`, now final. Both leave Europe's `placeholders`. Hamburg's
`otherClubIds` becomes `[2292744]`. `team-check` gains: each team's `otherClubIds` contains every
other team's `STRAVA_CLUB_ID` that isn't `0`. The fake Strava gains an optional sample field
`otherClubMember` (the first of the team's `otherClubIds` is listed too), used by one new Europe
sample rider; no Hamburg sample changes.

**Rationale**: FR-005, FR-006. Hamburg's only change is the one the spec asks for: a **new** rider in
both clubs sees the one-team-at-a-time notice once after connecting (`src/http/auth.ts`), and the
club listing reads one more page only for a rider with more than 200 clubs. The new check stops the
two lists drifting apart again.

## R11 — Proving "no side effects for Hamburg"

**Decision**: The first commit, on today's code, pins what isn't pinned yet: a Hamburg snapshot
(`test/teams/pages-snapshot.test.ts`, founding team only, like `season-snapshot.test.ts`) of the pages the
feature touches: landing, privacy, consent form, `/events`, Orga overview, events, an event's
attendance, requests and corrections, the tour texts, and the album pages, in German and English.
It and `season-snapshot.test.ts` must stay byte-identical through the feature. Further:
- `test/unit/rules.test.ts` and its fingerprint pin unchanged (version 3).
- `BADGE_CATALOG_VERSION` unchanged; Hamburg's `badgesFor` is `BADGES` itself.
- No existing test case is edited or removed; new behaviour gets new cases that run both teams side
  by side (FR-004), in `test/teams/` (run per team) or with both `TeamData` objects in one test. The
  one list that must grow is `fixable-reasons.test.ts`'s sorting of every reason code, which gains
  `too_short` on the not-fixable side.
- Tests in `test/teams/` that assume events and now run for Europe without them get
  `describe.runIf(hasEvents(team))`, leaving their Hamburg assertions untouched, plus a Europe
  counterpart.

**Rationale**: SC-001 asks for identical Hamburg pages; snapshots taken before the change are the
only proof that doesn't rely on reading every diff.

## R12 — Europe's handout and rules section

**Decision**: `docs/teams/europe/rynke-points.md` drops Team Rynke, team events, the Tour de Paris
days and their badges, states the 25 km minimum with examples (24.9 km doesn't count, 25 km does),
and fixes examples that relied on shorter rides; `pnpm docs:pdf` regenerates
`public/teams/europe/rynke-points.pdf` only. The rules section (`renderRules`) gains the line
`rynke.rules.minRide` when the rules in effect have a minimum. Hamburg's Markdown, PDF and rules
section are untouched (FR-009).

## R13 — Rollout

**Decision**: One branch and one pull request, commits ordered by story (club, minimum, Team Rynke
and events, badges). Europe isn't in production, so nothing waits on it; Hamburg sees nothing. After
the release the user runs **Sandbox reseed** for Europe (feature 027), which rebuilds its data without
events (FR-016); until then the sandbox's daily run re-evaluates its riders to version 4.

## R14 — The coin

**Decision**: No change. The coin's front and back are art on both teams (maintainer, 2026-11-17).
Where Hamburg's Team Rynke view shows the back today, Europe has no such view; the theme menu, the
hero coin and every other place showing both sides stay as they are.

## R15 — Training Rynke from outside virtual rides: a whole number

Added after the first implementation (maintainer, 2026-11-17, spec User Story 6).

**Decision**: `maxVirtualShare: Share` becomes `minOutsideTraining: number`, the Training Rynke of
the threshold that must come from anything but virtual rides (rides outdoors, events, corrections),
a whole number from 0 to `trainingThreshold`. Hamburg's versions 1–3 say `167`, Europe's version 4
says `84`. 0 means no such requirement: `tally` misses nothing (`virtualShareMissing` 0), the pace
check never trails (even pace of 0), and every surface that names it reads the rules in hand and
shows nothing: the rider summary's and gauges' `withoutVirtual` are `null`, the progress view has no
`outside` curve or column, the organiser breakdown has no outdoor figure (its reason and amount to
go are already empty with nothing missing), and the tour's outdoor step has `only: "outside"`, a
new switch from `hasOutsideRule(team)`.

**Hamburg**: 167 is exactly what `ceil(250 × (3 − 1) / 3)` gave, so every balance, status and
stored result is the same. Hamburg's rule version stays 3: a new version would make the daily run
re-evaluate every Hamburg rider for nothing (FR-002). Its fingerprint pin changes with the field's
name, and a test proves 167 is the old formula for each of Hamburg's versions. The stored column
`virtual_share_missing` and the balance field keep their names (no migration). The one visible
change is the onboarding tour's outdoor step: a whole number has no "1/3" to name, so its first
sentence goes in all ten languages; "at least 167 of 250" stays (maintainer's choice). Hamburg's
handout already names 167 and stays.

**Europe**: a third of 250 is 83⅓; 84 rounds up like Hamburg's 166⅔ → 167 (maintainer). Europe's
version 4 isn't released yet, so its value changes without a version 5. The handout says 84; the
sample rider `Védís Virtual` rides 7 times outdoors instead of 14, so she still misses some.

**Alternatives considered**:
- *Keep Hamburg's share and add the whole number for Europe only*: Hamburg byte-identical, but two
  ways to express one rule. The maintainer chose one setting for both.
- *A new Hamburg version 4 with the whole number*: re-evaluates every Hamburg rider; refused by
  FR-002.
