# Research: Gateway Routing

Decisions for the open choices of [spec.md](spec.md). Each: decision, rationale, alternatives.

## R1 Where the gateway keeps the copy

**Decision**: One SQLite-backed Durable Object (`RoutingCopy`), one instance named `copy`,
created in the EU jurisdiction (`ROUTING_COPY.jurisdiction("eu")`). It holds the copy, each
team's list date and the day counts. The class is declared in `gateway/wrangler.jsonc` with a
`new_sqlite_classes` migration and exported by the gateway Worker.

**Rationale**: A Durable Object is created by the deploy itself: no database to create by hand,
no ID to put into the config, so the gateway keeps deploying from `main` unchanged. The EU
jurisdiction keeps its storage in the EU (FR-012). SQLite-backed objects are on the free plan
too. Reads and writes are strongly consistent, which the copy needs (a report must count for
the next event). The data is tiny: at most 999 athletes, a few teams, 30 days of counts.

If the jurisdiction or the object ever fails at runtime, every lookup fails, and every event goes
to every team (FR-001): the failure is safe.

**Alternatives**: D1 with an EU jurisdiction: needs a database created by hand and its ID in the
config before the gateway can deploy again, a manual production step. Workers KV: eventually
consistent and with no EU guarantee.

## R2 The one setting

**Decision**: The gateway var `ROUTING`: `off`, `trial` or `on`. Missing or anything else counts as
`off`. The repository ships `off`.

- `off`: today's broadcast. No lookup, no mark. Reports are answered `404`, as by a gateway
  without this feature. A full list empties the whole copy and is answered `404`, so switching to
  `off` empties the copy within a day (the teams' next daily runs) and the gateway keeps no rider
  data while off.
- `trial`: lookups and counts; every event to every team, each marked chosen or not (FR-020).
- `on`: routing (FR-001).

The figures exchange works in every mode, so the re-check's baseline (FR-023) is visible before
the trial.

**Rationale**: FR-018 wants one gateway setting between trial and routing, and routing must ship
switched off. A third value lets the release ship without the gateway keeping anything: when the
copy starts is the maintainers' step (set `trial` after the privacy notice is live), and the
baseline before the trial needs a time without it. Changing the var is a pull request that
touches only `gateway/`, which deploys only the gateway.

**Alternatives**: Two values (`trial`, `on`) shipping `trial`: the gateway would keep the copy from
the first deploy and the baseline would start with the trial. A secret instead of a var: invisible
in the repository, and the mode is no secret.

## R3 Choosing the teams within the acknowledgement

**Decision**: The webhook asks the object for the athlete's teams and the routing teams, with a
1-second budget. Past it, or on any error, the event goes to every team. The day's counts are
written after the answer, through `waitUntil`, never on the acknowledgement's path.

**Rationale**: FR-002. One object call is a few hundred milliseconds at worst from any data
centre; the budget leaves the other second for the queue send.

**Alternatives**: Counting inside the lookup: a lookup that times out could still count "by the
copy" for an event that went to every team.

## R4 Choosing

**Decision**: `chosen = (teams the copy lists for the athlete) ∪ (teams not routing)`, both within
`TEAMS`. When the copy lists none of `TEAMS`' teams, every team. A team routes while its last full
list is at most 48 hours old (FR-007). Entries of teams no longer in `TEAMS` are ignored at once
and deleted at the next full list or exchange (FR-009).

## R5 The trial's mark

**Decision**: In `trial`, each per-team queue message carries `chosen: true|false`, and the forward
adds the header `X-Rynke-Route: chosen` or `not-chosen`. The team's webhook puts `route` into the
`activity-event` and `delete-rider` message it queues: `chosen`, `not-chosen`, or `plain` without
a header. The consumer counts at its existing rider check, on the first delivery only:

- no rider row: one **dropped**; with `chosen` also one **would-be wasted**;
- a rider row and `not-chosen`: one **would-be miss**.

`route` is never part of a message's canonical form (`failed_work`, the Strava work table), and
processing never reads it (FR-020).

**Rationale**: The body stays as Strava sent it. The rider check already decides whether the team
holds the athlete, so counting there costs no extra query.

**Alternatives**: A field in the forwarded body: the body would no longer be Strava's. Counting in
the webhook: one more D1 read on the acknowledgement's path.

## R6 Reports

**Decision**: A team queues `{ kind: "report-hold", athleteId }` after it stores or deletes a person
(sign-in of a new rider or guest, a refused sign-in that deletes, leaving, deletion for any reason,
removal, let-go). The consumer handles it before the rider check: it reads whether the team holds
the person now and sends that, so reports can't overtake each other. `2xx` and `404` (a gateway
that takes no reports) settle it; anything else is retried with the queue's backoff, and the last
attempt drops it, since the next full list corrects the copy (FR-005). Without a gateway nothing
is queued. A failed enqueue is logged and never fails the rider's action.

**Alternatives**: Calling the gateway inline: holds up the connect. Putting it into `failed_work`:
the daily full list makes that redundant.

## R7 Full lists

**Decision**: A step of the daily run sends every athlete the team holds (any `riders` row). `2xx`
and `404` are fine; anything else fails the step, so the run shows the failure in the logs. The
gateway replaces the team's part in one transaction, counts additions, removals and possible
misses, and sets the team's list date.

**Possible miss** (FR-022): an athlete the list adds whom the copy listed under other teams only.
An athlete the copy didn't know at all went to every team and isn't one.

## R8 IDs on the new routes

**Decision**: Athlete IDs as JSON strings (`"athleteId": "990001"`, `"athleteIds": [...]`), checked
with `isStravaId`. The team question keeps its numbers.

**Rationale**: Exact without a reviver; `parseStravaJson` can't reach array elements by key.

## R9 How the figures reach the teams

**Decision**: Hourly, with the usage recording and on **Update now**, a team posts its own four
counts (would-be misses, would-be wasted, dropped, re-check finds) for the last 30 days to the
gateway and gets back every figure the gateway holds for those days: its own, every team's list
corrections and every team's own four. The team stores what it got in `routing_daily` (its own
four stay as counted locally). The view reads D1 only.

**Rationale**: FR-024: like the usage exchange, pulled by the hourly recording into D1, so the view
never waits for anyone. One channel through the gateway, which holds the list figures anyway; the
teams' usage export stays as it is, so teams on different versions never refuse each other's
exports.

**Alternatives**: New allowances in the usage export: an older team would refuse a newer team's
whole export during a deployment, and the allowance code would carry figures that aren't
allowances.

## R10 The day table

**Decision**: One row per day with a count, newest first, last 30 days. Columns: sent by the copy,
sent to every team, then per figure **This team** and **Other teams** (the other teams' sum):
would-be misses, would-be wasted, dropped, list corrections (added plus removed), possible misses,
re-check finds. Without other teams' figures, the "Other teams" columns are left out.

**Rationale**: FR-024 asks for each team's figures with other teams anonymous. One summed column
keeps the table readable at eleven teams; the warning mark doesn't need to know which other team.

**Alternatives**: One column per other team, as the allowance history: up to 60 columns.

## R11 The warning mark

**Decision**: A day is marked when any team has a would-be miss or a possible miss, or when more than
1% of the events that arrived while every team was routing went to every team. For the last part
the gateway counts per event: events while every team routed (`allRouting`) and those of them sent
to every team (`allRoutingEveryone`). The summary at the top adds a line with the number of marked
days.

## R12 Re-check finds

**Decision**: The re-check counts each listed activity it stores that wasn't stored before (rides,
runs and swims), as `found`, for its team and day. Counting starts with this release, whatever the
gateway's mode (FR-023).

## R13 Retention and clean-up without a cron

**Decision**: Counts are kept for 30 days including today, on the teams (pruned by the daily run)
and the gateway (pruned at every full list and exchange). Teams no longer in `TEAMS` lose their
copy entries, list date and counts at the same moments. No gateway cron: the account's five cron
triggers are four in use, and every team calls daily anyway.

## R14 Privacy notice

**Decision**: One paragraph in the notice's "Data needed to run the app" section, in all ten
catalogs; the notice's date moves. No consent revision (FR-015): nothing new is read from Strava
or shown to anyone.

## R15 Local development and tests

**Decision**: `pnpm dev` starts the local gateway with `ROUTING=on` and the object's state under
`.wrangler/fake-state-gateway`. The gateway's tests run the object in Miniflare. The app's tests
see a fake gateway (`test/support/fake-strava.ts`) that records reports, lists and exchanges.

## R16 Drops counted in every mode

**Decision**: "Dropped" counts every event about a person the team doesn't hold, in every mode. While
the gateway broadcasts, that is every other team's event; with routing live, the waste. The
section's note says so.

## R17 Gateway logs

**Decision**: The new routes log `<route> team=<id> status=<code>` at most, never an athlete or a
body (FR-013).
