# Contract: Messages

All new text goes into `src/i18n/messages/en.ts` and `de.ts` (FR-024, FR-028 of the app). The wordings
below are drafts. Final copy follows the design draft and the house rules for German:

- Gender-neutral words first.
- "Rider" stays English jargon.
- No poster slogans.

The German label is "Typische Fahrt", never "Median".

## Consent (minor revision 3.1, research R5)

| Key | Change | de draft | en draft |
| --- | --- | --- | --- |
| `consent.short.shown` | revised | adds: "…, im Ranking außerdem deine Fahrten, Kilometer und Höhenmeter ohne Namen." | adds: "…, and in the ranking your sessions, kilometres and elevation, without your name." |
| `consent.rideFigures` | new; listed in revision 3.1's `changes` | "Im Ranking des Teams sehen alle deine Zahl der gewerteten Fahrten, deine Kilometer und Höhenmeter pro Saison, Monat und Woche, ohne deinen Namen. Die Orga sieht mit deinem Vornamen deine Fahrten pro Saison und Tag und deine typische Fahrt: die Länge, über und unter der je die Hälfte deiner Fahrten liegt. Die Daten, die wir von Strava lesen, ändern sich dadurch nicht." | "In the team's ranking everyone sees your number of counting rides, your kilometres and elevation per season, month and week, without your name. The organisers see, with your first name, your sessions per season and per day and your typical ride: the length half of your rides are above and half below. What we read from Strava doesn't change." |

`consent.short.shown` and `consent.rideFigures` must stay consistent with `consent.team` and
`consent.dailyFigures`. A test checks that the summary names every `RiderData` shared with someone else.

## Privacy (FR-022)

| Key | de draft | en draft |
| --- | --- | --- |
| `privacy.team.rideFigures` | "Aus deinen gewerteten Fahrten zählt RynkePoints Fahrten, Kilometer und Höhenmeter pro Saison, Monat und Woche für das Ranking ohne Namen, und deine typische Fahrt, die nur du und die Orga sehen." | "From your counting rides RynkePoints counts sessions, kilometres and elevation per season, month and week for the ranking without names, and your typical ride, which only you and the organisers see." |

The paragraph is shown only while `RIDE_FIGURES` is on.

## Team section

| Key | en | de |
| --- | --- | --- |
| `team.rankBy.label` | Rank by | Rangliste nach |
| `team.rankBy.rynke` | Rynke | Rynke |
| `team.rankBy.sessions` | Sessions | Fahrten |
| `team.rankBy.km` | km | km |
| `team.rankBy.elevation` | Elevation | Höhenmeter |
| `team.period.label` | Period | Zeitraum |
| `team.period.season` | Season | Saison |
| `team.period.month` | Month | Monat |
| `team.period.week` | Week | Woche |
| `team.ride.sessions` | {n} sessions | {n} Fahrten |
| `team.ride.km` | {n} km | {n} km |
| `team.ride.elevation` | {n} m | {n} hm |
| `team.ride.typical` | Typical ride: {n} km | Typische Fahrt: {n} km |
| `team.ride.typical.hint` | Half of the rides are longer, half are shorter. | Die Hälfte der Fahrten ist länger, die Hälfte kürzer. |
| `team.ride.teamLine` | The team: {sessions} · {km} · {elevation} · typical {typical} | Das Team: {sessions} · {km} · {elevation} · typisch {typical} |
| `team.ride.nobodyYet` | Nobody has ridden yet this {period}. | In diesem Zeitraum ist noch niemand gefahren. |
| `team.ride.place.next` | {n} to pass the next place | {n} bis zum nächsten Platz |
| `team.ride.bar` | {value} of the leader's {lead} | {value} von {lead} an der Spitze |
| `team.ride.total.heading` | The team's kilometres | Die Kilometer des Teams |
| `team.ride.total.thisWeek` | +{n} km this week | +{n} km diese Woche |
| `team.ride.chart.heading` | Kilometres, week by week | Kilometer Woche für Woche |
| `team.ride.chart.label` | screen-reader summary, like `team.chart.label` | wie `team.chart.label` |

## Organiser area

| Key | en | de |
| --- | --- | --- |
| `organiser.overview.column.sessions` | Sessions | Fahrten |
| `organiser.overview.typical` | typical {n} km | typisch {n} km |
| `organiser.graphs.title.sessions` | Sessions | Fahrten |
| `organiser.graphs.tab.sessions` | Sessions | Fahrten |

The screen-reader table texts of the fourth graph reuse 029's keys with the new title.
