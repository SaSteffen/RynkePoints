# Contract: Messages

Every key is added to all ten catalogs under `src/i18n/messages/`; German is the key source,
English the reference wording (constitution, Language). Europe's texts are written fresh for a
distributed team: they don't assume group rides. No existing key's text changes, except
`tour.rider.outdoor` (below).

## New keys

| Key | English | German |
|---|---|---|
| `rynke.reason.too_short` | Too short: {distance}, at least {limit} needed. | Zu kurz: {distance}, mindestens {limit} sind nötig. |
| `rynke.reason.too_short.noLimit` | Too short: {distance}. | Zu kurz: {distance}. |
| `rynke.rules.minRide` | Rides of {limit} or more count. | Es zählen Fahrten ab {limit}. |

`{distance}` and `{limit}` use the page's existing kilometre format (one decimal for the distance,
none for the limit).

## Variants for a team without events (`<id>.noEvents`)

Picked by `eventsText(team, id)` (research R7). The base key stays Hamburg's text.

| Base key | English variant | German variant |
|---|---|---|
| `landing.purpose` | We use the data only for Rynke and badges. Only you see your individual rides and their names. | Wir nutzen die Daten nur für Rynke und Abzeichen. Deine einzelnen Fahrten und ihre Namen siehst nur du. |
| `consent.organisers` | The organisers see your first name from Strava, your Rynke and where they come from, what you still need, whether you've reached your training goal, and their corrections. | Die Orga sieht deinen Vornamen von Strava, deine Rynke und woher sie kommen, was dir noch fehlt, ob du dein Trainingsziel erreicht hast, und ihre Korrekturen. |
| `privacy.team.body` | The organisers can correct your Rynke with a reason and a date. Who changed what, and when, is stored too. | Die Organisatoren können deine Rynke mit Grund und Datum korrigieren. Gespeichert wird auch, wer das wann geändert hat. |
| `privacy.visibility.organisers` | The organisers see your first name, your Rynke and where they come from, what you still need, whether you've reached your training goal, their corrections, and your kilometres outdoors and virtually and your elevation as totals per day, but no individual activities. | Die Organisatoren sehen deinen Vornamen, deine Rynke und woher sie kommen, was dir noch fehlt, ob du dein Trainingsziel erreicht hast, ihre Korrekturen und deine Kilometer draußen und virtuell und deine Höhenmeter als Summen pro Tag, aber keine einzelnen Aktivitäten. |
| `privacy.legal.body` | Hamburg's text without "Team events," at the start of its second sentence: "Corrections, the necessary cookies and the logs rest on …" | likewise: „Korrekturen, die technisch nötigen Cookies und die Protokolle beruhen auf …" |
| `tour.rider.outdoor` | At most {virtualShare} of your Training Rynke may come from virtual rides. This bar counts everything else: at least {outside} of {trainingThreshold} Training Rynke have to come from riding outside. | Höchstens {virtualShare} deiner Trainingsrynke dürfen von virtuellen Fahrten kommen. Dieser Balken zählt alles außer ihnen: Mindestens {outside} von {trainingThreshold} Trainingsrynke musst du draußen erfahren. |
| `tour.organiser.riders` | Riders: everyone in the team with their Training Rynke and what they still need. | Rider: alle im Team mit ihren Trainingsrynke und dem, was ihnen noch fehlt. |
| `progress.day` | {date} · {training} Training Rynke | {date} · {training} Trainingsrynke |
| `organiser.overview.qualifiedHint` | Training threshold and the outdoor share met. | Trainingsschwelle und der Anteil draußen erreicht. |
| `organiser.overview.amounts` | {training} Training | {training} Training |
| `organiser.overview.corrections` | Corrections {training} Training | Korrekturen {training} Training |
| `badges.surprise.sunday-outing.for` | At least ten from the team out on the same Sunday. | Mindestens zehn aus dem Team am selben Sonntag unterwegs. |
| `organiser.overview.hint` | The tick on each bar marks the even pace to the deadline: today {training} Training. | Der Strich auf jedem Balken zeigt das gleichmäßige Tempo bis zum Stichtag: heute {training} Training. |
| `organiser.overview.hint.percent` | The tick on each bar marks the even pace to the deadline: today {training} of Training. | Der Strich auf jedem Balken zeigt das gleichmäßige Tempo bis zum Stichtag: heute {training} vom Training. |
| `tour.organiser.groups` | Hamburg's text without its last sentence, "First: everyone with an open report." | likewise, without „Ganz vorn: alle mit einer offenen Meldung." |

The `test/teams/no-events.test.ts` walk (contracts/team-surfaces.md) is the authority: a text it
finds on a Europe page that this table misses gets a variant in the same change.

## Not needed

Texts only shown with Team Rynke or events (`hero.team`, `rynke.team`, `rynke.missing.team`,
`rynke.events.*`, `events.*`, `organiser.event(s).*`, `organiser.attendance.*`,
`organiser.requests.*`, `tour.rider.teamRynke`, `tour.rider.events`, `tour.organiser.newEvent*`,
`album.events.*`, the event-only badges' texts) get no variant: a team without them never renders
them.

## Changed: the outdoor tour step (research R15)

`tour.rider.outdoor` and `tour.rider.outdoor.noEvents` lose their first sentence, which named the
share (`{virtualShare}`, now gone), in all ten languages. The rest names `{outside}` of
`{trainingThreshold}`.

| Key | English | German |
|---|---|---|
| `tour.rider.outdoor` | This bar counts everything but virtual rides: at least {outside} of {trainingThreshold} Training Rynke have to come from riding outside, team events included. | Dieser Balken zählt alles außer virtuellen Fahrten: Mindestens {outside} von {trainingThreshold} Trainingsrynke musst du draußen erfahren, Teamtermine zählen mit. |
| `tour.rider.outdoor.noEvents` | This bar counts everything but virtual rides: at least {outside} of {trainingThreshold} Training Rynke have to come from riding outside. | Dieser Balken zählt alles außer virtuellen Fahrten: Mindestens {outside} von {trainingThreshold} Trainingsrynke musst du draußen erfahren. |
