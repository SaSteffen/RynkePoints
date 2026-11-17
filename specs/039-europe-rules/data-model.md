# Data Model: Team Europe's Own Rules

No database change: no migration, no new table or column. Everything below is TypeScript data and
types. Hamburg's values don't change anywhere.

## RynkeRules (`src/rynke/rules.ts`)

| Field | Change | Hamburg V1–V3 | Europe V4 |
|---|---|---|---|
| `minRideKm` | **new**, optional: absent = no minimum; present = positive whole km | absent | `25` |
| `teamThreshold` | type `number` → `number \| null`; `null` = the team has no Team Rynke | `25` | `null` |
| `teamEvents` | unchanged type; with `teamThreshold: null` every `.team` must be 0 | as today | every kind `{ team: 0, training: 0 }` |
| `minOutsideTraining` | **replaces** `maxVirtualShare` (research R15): whole Training Rynke from outside virtual rides, 0 = no requirement | `167` (same results as ⅓ virtual) | `84` |
| every other field | unchanged | as today | Hamburg V3's values |

Validation (`assertValidRules`), added to today's:
- `minRideKm`, when present, is a positive integer.
- `teamThreshold` is a positive integer or `null` (0 stays invalid).
- `teamThreshold: null` ⇒ `teamEvents[kind].team === 0` for every kind.
- `minOutsideTraining` is a whole number from 0 to `trainingThreshold` (R15).

`rulesFingerprint` is unchanged as a function. Hamburg's objects produced the same string as before
until R15, whose field rename changes Hamburg's pin, not its version (results are identical).
A new pin in `test/teams/rules.test.ts` fixes Europe's version 4 fingerprint, so a later value change
without a version bump fails for Europe too.

## Rule histories (`src/teams/<id>.ts`)

| Team | `rules` | Current |
|---|---|---|
| Hamburg | `[RULES_V1, RULES_V2, RULES_V3]`, unchanged | version 3 |
| Europe | `[...hamburg.rules.slice(0, 3), EUROPE_RULES_V4]` | version 4, `effectiveDate` = release day |

Europe V4 = `{ ...hamburg V3, version: 4, effectiveDate, minRideKm: 25, teamThreshold: null,
teamEvents: all zero }` written out as its own object in `src/teams/europe.ts`, with the note on
raising `version` beside it.

## TeamData (`src/teams/types.ts`)

No new field. Changed values and meanings:

| Field | Hamburg | Europe |
|---|---|---|
| `rules` | unchanged | see above |
| `eventKinds` | unchanged: all four kinds | `[]` (was Hamburg's four) |
| `otherClubIds` | `[]` → `[2292744]` | `[1088689]`, unchanged |
| `placeholders` | `[]` | without `STRAVA_CLUB_ID` and `STRAVA_EXTRA_CLUB_IDS` |
| `art.coin` | unchanged | unchanged; the comment "Team Rynke's side" on `CoinArt.back` becomes "The coin's back, art only" |

Derived predicates (`src/teams/index.ts`), the only way code asks:
- `hasTeamRynke(team)`: `currentRules(team.rules).teamThreshold !== null`.
- `hasEvents(team)`: `team.eventKinds.length > 0`.

Invariant (`team-check` and `test/teams/completeness.test.ts`): `hasTeamRynke(team) === hasEvents(team)`.
A team with Team Rynke has at least one of `TEAM_EVENT_KINDS` in `eventKinds`.

New `team-check` rule: each team's `otherClubIds` contains every other team's `STRAVA_CLUB_ID` that
isn't `"0"`.

## Wrangler blocks (`wrangler.jsonc`)

| Block | `STRAVA_CLUB_ID` | `STRAVA_EXTRA_CLUB_IDS` |
|---|---|---|
| `env.hamburg`, `env.sandbox-hamburg` | `1088689`, unchanged | `2372209`, unchanged |
| `env.europe`, `env.sandbox-europe` | `0` → `2292744` | `""`, unchanged, no longer a placeholder |

## Ride result (`src/rynke/rides.ts`)

`REASON_CODES`: `outside_window, excluded_sport_type, flagged, manual, too_short, pause, too_slow,
too_fast, climbing_rate, overlap`. `too_short` is pushed when `minRideKm` is set and
`distanceM < minRideKm × 1000`, checked before the moving-time early return. Not in
`FIXABLE_REASONS`. Stored as today, in the result's reason list; no constraint to change.

## Rider page reason line (`src/http/rider-view.ts`)

`ReasonLine` gains `{ code: "too_short"; distanceKmTenths: number; limitKm: number | null }`:
the ride's distance in tenths of a kilometre rounded down, and `minRideKm` of the result's rules
version (`null` when that version is unknown → the `.noLimit` text). Not in the fix-hint set.

## Balance (`src/rynke/tally.ts`)

Shape unchanged. With `teamThreshold: null`: `teamMissing = 0`, `teamRynke` is whatever corrections
and events give, which for Europe is always 0 (no events; corrections refuse a Team amount),
`qualified = trainingMissing === 0 && virtualShareMissing === 0`.

## View models that become optional

Each holds `null` for a team without Team Rynke; Hamburg's are always set, as today.

| Where | Field |
|---|---|
| `src/http/rider-view.ts` | `Summary.team`, `Gauges.team`, the balance's events breakdown |
| `src/http/progress-view.ts` | the `team` series; the weekly table's Team column |
| `src/http/sections/team.ts` | the Team view (`kind=team` falls back to Training, like `rynkeViews` off) |
| `src/http/sections/overview.ts` | the hero's Team figure |
| `src/http/organiser/overview.ts` | each rider's Team amount, missing, pace and event breakdown |
| `src/http/organiser/corrections.ts` | the Team field |
| `src/http/tour-example.ts` | the example rider's and team's Team Rynke and events |
| `album/load.ts` | `teamRynke`, `eventsAttended`, `events` |

## Badge category (`src/badges/catalog.ts`)

`BadgeCategory` gains `events?: true` ("earned only through recorded events"), set on `team_events`,
`technique`, `big_training`, `attendances`, `tour_de_paris`. `BADGE_CATALOG_VERSION` stays 9.
`badgesFor(team)`: `BADGES` for a team with events, else without the flagged categories.

## Tour switches (`src/http/tour.ts`)

`TourSwitches` gains `teamRynke: boolean` and `events: boolean` (from the two predicates in
`tourSwitches`), and `outside: boolean` from `hasOutsideRule(team)` (R15): `tour.rider.outdoor`
`only: "outside"`. Steps: `tour.rider.teamRynke` `only: "teamRynke"`; `tour.organiser.requests`,
`tour.organiser.newEvent`, `tour.organiser.upcoming`, `tour.organiser.past` `only: "events"`.
`hiddenSections` takes the team too and adds `"events"` when `!hasEvents(team)`.

## Fake Strava samples (`dev/fake-strava/`)

- `SampleRider` gains `otherClubMember?: true`; the fake clubs list then adds the first of the
  team's `otherClubIds`.
- `samples.europe.ts`: no `events` on any rider, `teamEvents: []`, sample states reworded without
  events; one rider with rides of 24.9, 25.0 and 60 km; one rider with `otherClubMember: true`.
- `samples.hamburg.ts`: unchanged.
