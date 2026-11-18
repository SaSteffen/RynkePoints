# Contract: What a Team Without Team Rynke and Events Shows

For a team with both (Hamburg) every row below is today's behaviour, byte for byte. For a team
with neither (Europe) the right-hand column applies. Decided by `hasTeamRynke(team)` and
`hasEvents(team)` (contracts/team-data.md); never by the team's ID.

## Rider pages

| Surface | Without Team Rynke and events |
|---|---|
| Navigation | no Events entry (`hiddenSections` gains `"events"`) |
| `/events`, `/events/{id}/report`, `…/delete` | 404 |
| `/me` hero | Training Rynke only; no Team figure |
| `/me` verdict | "missing" lists Training and outdoor share only; qualified with both met |
| `/me` gauges | Training and outdoor share; no Team gauge; the outdoor text without events |
| `/me` "Your team events" | not shown |
| `/me` progress chart and weekly table | Training series and column only |
| `/me` rules section | adds "Rides of 25 km or more count." (`rynke.rules.minRide`), only with a minimum |
| `/me/rides` | short rides listed as not counting with `too_short` |
| `/team` | Training view only: no kind switch; `?kind=team` shows the Training view (no 400) |
| `/me/badges` | no event-only badge, earned or locked, no hint for one (`badgesFor`) |
| Celebration, push texts | no Team Rynke part (never non-zero; the texts are also not reachable) |
| Onboarding tour | no Team Rynke step, no Events step; outdoor step text without events |
| Landing, consent form, privacy | the `.noEvents` texts (contracts/messages.md) |
| Coin | unchanged: front and back are art and show where they show today outside the Team Rynke view |

## Organiser pages

| Surface | Without Team Rynke and events |
|---|---|
| Orga switch (Riders · Events) and its open-request count | not shown |
| `/organiser` | redirects to `/organiser/riders` |
| `/organiser/events…`, `/organiser/requests…` | 404, GET and POST |
| `/organiser/riders` | no Team column, amount, missing, pace or event breakdown; "qualified" hint without Team |
| Corrections form | Training field only; a request with a non-zero Team amount is refused (400, `organiser.error.*`) |
| Organiser tour | Riders steps only; Riders text without Team Rynke |

## Work and data

| Path | Without Team Rynke and events |
|---|---|
| `teamEventChange` | refuses any kind outside `team.eventKinds` (`TeamEventRefused`) |
| Evaluation | `too_short` per R5; `teamMissing` 0 |
| Badges evaluation | unchanged code; event-only badges can't be earned, so none is stored |
| Team badge news | lists through `badgesFor` |
| Season album | no Team Rynke figure, no events page, no event-only badges |
| Sample seeding | no events; Europe's samples hold none (seeding would refuse them) |

## Check: no trace in Europe's pages

`test/teams/no-events.test.ts` (Europe only, `describe.runIf(!hasEvents(team))`) renders every rider
page, every organiser page, the tour steps, the landing, consent and privacy pages and the album,
in English and German, and finds none of: `Team Rynke`, `team event`, `Team event`, `attend`,
`Tour de Paris`, `tour day` (en); `Teamrynke`, `Teamtermin`, `Termine`, `Tour de Paris` (de); and
no `href` to `/events` or `/organiser/events`. Its Hamburg counterpart is the snapshot of R11.

## Without Training Rynke needed from outside virtual rides (research R15)

A team whose `minOutsideTraining` is 0 (none today) shows nothing about it:

| Surface | With `minOutsideTraining: 0` |
|---|---|
| `/me` verdict and push texts | no outdoor line; qualified without it |
| `/me` gauges | no outdoor gauge, even with virtual rides |
| `/me` progress chart and weekly table | no outside curve or column |
| Onboarding tour | no outdoor step |
| `/organiser/riders` | no "Outdoor Training n of m" figure, reason or amount to go; status without it |
