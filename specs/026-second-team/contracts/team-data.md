# Contract: Team Data

Shape: [data-model.md](../data-model.md) › TeamData.

## Registry

`src/teams/index.ts` exports `TEAMS: readonly TeamData[]` and `teamFor(env): TeamData`.
`teamFor` throws `Unknown TEAM_ID "<x>"` for an ID that isn't registered. `Ctx.team` is
set once per request, queue batch or cron run in `src/index.ts`, and in `dev/worker.ts`
for fake mode.

## Holidays

`holidays: readonly Holiday[]` (required, may be empty) lists the team's holidays with a
seasonal quote monkey; added by feature 035,
[contracts/team-holidays.md](../../035-seasonal-monkeys/contracts/team-holidays.md).

## No team names in code

Outside `src/teams/`, no file under `src/` may contain a registered team ID as a string
literal, or a team's display name (test, FR-016). Team-specific behaviour comes from a
field of `TeamData` or a var.

## Feature switches (FR-018)

Vars per team, `"on"` or `"off"`: `TRAINING_LEADERBOARD`, `BADGES`, `PHRASES`,
`SEASON_ALBUM`, `FUN_THEMES` (plus the existing `RIDE_FIGURES`, `RYNKE_VIEWS`,
`ORGANISER_*`). When a switch is `"off"`, no page, menu entry, text, notification or
scheduled work for the feature happens (US3 scenario 3).

## `scripts/team-check.mjs`

```text
node scripts/team-check.mjs                    # every team: completeness, exit 1 + list on failure
node scripts/team-check.mjs --deployable <id>  # also: placeholders must be empty
```

Output on failure names each team, the field or var, and what is wrong, one per line.
`pnpm lint` runs the first form. CI's deploy step for a team runs the second form before
deploying (FR-053).

## Placeholders

`placeholders: ["rules", "STRAVA_CLUB_ID", "SEASON_START_DATE", …]`. Europe starts with
every value it hasn't supplied. Removing an entry is the commit that brings the real
value.
