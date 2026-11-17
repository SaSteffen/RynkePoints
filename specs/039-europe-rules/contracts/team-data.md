# Contract: Team Data (amends feature 026)

Amends [026 contracts/team-data.md](../../026-second-team/contracts/team-data.md). Shapes:
[data-model.md](../data-model.md).

## Rules

A team's rule history may now say, per version:

- **Minimum ride length**: `minRideKm`, whole kilometres. Absent means none. A team without a
  minimum leaves the field out; it never writes `0`.
- **No Team Rynke**: `teamThreshold: null`, with every team-event amount's `team` at 0.
- **Training Rynke from outside virtual rides**: `minOutsideTraining`, a whole number from 0 to
  `trainingThreshold`, replacing the share `maxVirtualShare` (research R15). 0: no such
  requirement. Hamburg 167, Europe 84.

A rule value changed in an existing version still needs a new version (feature 003); adding the
optional field to an existing version counts as a change. Hamburg's versions 1–3 stay as they are.

## Team Rynke and events go together

| `hasTeamRynke(team)` | `hasEvents(team)` | Allowed |
|---|---|---|
| true | true (at least one of `TEAM_EVENT_KINDS`) | yes: Hamburg |
| false | false (`eventKinds: []`) | yes: Europe |
| true | false | no |
| false | true | no |

`node scripts/team-check.mjs` reports a team in a refused row as
`team <id>: eventKinds: …`. Code asks only through `hasTeamRynke(team)` and `hasEvents(team)`,
never through `team.id` (026: no team names in code).

## Clubs

Each team's `otherClubIds` contains every other team's `STRAVA_CLUB_ID` that isn't `"0"`;
`team-check` reports a missing one as `team <id>: otherClubIds: <club> of <other> missing`.

| Team | `STRAVA_CLUB_ID` | `STRAVA_EXTRA_CLUB_IDS` | `otherClubIds` |
|---|---|---|---|
| Hamburg | 1088689 | 2372209 | [2292744] |
| Europe | 2292744 | (none) | [1088689] |

A sandbox block keeps its team's values (027 FR-012), so `sandbox-europe` gets 2292744 too.

## Placeholders

Europe's `placeholders` lose `STRAVA_CLUB_ID` and `STRAVA_EXTRA_CLUB_IDS`. The others stay until
Team Europe decides them.
