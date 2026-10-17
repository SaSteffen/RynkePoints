# Contract: New and Changed Messages

All in `src/i18n/messages/de.ts` and `en.ts`. Every tour hint gets the same
parameters, filled from `CURRENT_RULES` (research R6): `distanceKm`,
`distanceRynke`, `elevationM`, `elevationRynke`, `teamTraining`, `weekendDay`,
`technique`, `teamThreshold`, `virtualShare` (`num/den`), `outside`,
`trainingThreshold`.

| Id | German |
| --- | --- |
| `tour.example` | Beispieldaten: So sieht es aus, wenn schon ein paar Fahrten da sind. Deine eigenen Zahlen siehst du nach dem Rundgang. |
| `tour.rider.elevation` | Der Höhenmeter-Zähler: Alle {elevationM} Höhenmeter bringen dir {elevationRynke} Trainingsrynke. Er zeigt, wie viele Meter dir noch bis zu den nächsten fehlen. |
| `tour.rider.teamRynke` | Teamrynke gibt es nur für Teamtermine, bei denen die Orga dich eingetragen hat: {teamTraining} für ein Teamtraining, {weekendDay} für einen Tag am Trainingswochenende, {technique} für ein Techniktraining. Für Paris brauchst du {teamThreshold}. |
| `tour.rider.outdoor` | Höchstens {virtualShare} deiner Trainingsrynke dürfen von virtuellen Fahrten kommen. Dieser Balken zählt alles außer ihnen: Mindestens {outside} von {trainingThreshold} Trainingsrynke musst du draußen erfahren, Teamtermine zählen mit. |
| `tour.rider.shortRide` | Für jede volle {distanceKm} km einer Fahrt gibt es {distanceRynke} Trainingsrynke. Diese Fahrt war kürzer: Sie zählt, bringt aber keine Rynke für die Strecke. Ihre Höhenmeter kommen trotzdem auf den Zähler. |
| `tour.rider.events` | Termine: die Teamtermine. Sag vorher Bescheid, ob du dabei bist, und melde danach, dass du da warst. Sobald die Orga dich eingetragen hat, gibt es Teamrynke. |

The other tour messages are unchanged.
