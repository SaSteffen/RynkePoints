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
| `tour.rider.peloton` | Das Peloton: alle im Team nach ihren Trainingsrynke, ohne Namen; deine Münze ist markiert. Je weiter rechts, desto mehr Rynke. Wer mit Abstand vorn fährt, ist im Breakaway. |
| `tour.rider.rides` (changed) | Fahrten: jede Fahrt und was sie gebracht hat. Diese hier zählt nicht. Unter „Warum?“ steht, woran es lag und was du tun kannst. |
| `tour.organiser.riders` (changed) | Rider: alle im Team mit ihren Trainings- und Teamrynke und dem, was ihnen noch fehlt. |
| `tour.organiser.example` | Beispielteam: So sieht Orga aus, wenn die Saison läuft. Anklicken lässt sich hier nichts; das echte Team siehst du nach dem Rundgang. |
| `tour.organiser.groups` | Die Gruppen: „Braucht Schwung“ liegt hinter dem Tempo, „Gut unterwegs“ im Plan, „Trainingsziel erreicht“ hat alles zusammen. Tippst du auf eine Kachel, siehst du nur ihre Rider. Ganz vorn: alle mit einer offenen Meldung. |
| `tour.organiser.pace` | Der Strich auf jedem Balken ist das gleichmäßige Tempo bis zum Stichtag. Wer links davon liegt, braucht Schwung. Ein Tipp auf einen Namen öffnet die Korrekturen: Rynke dazu oder weg, mit Grund. |
| `tour.organiser.requests` | Meldungen: Rider sagen dir, dass sie bei einem Teamtermin waren. „Eintragen“ gibt ihnen die Rynke des Termins, ✕ lehnt ab. Beides kannst du kurz danach rückgängig machen. |
| `tour.organiser.newEvent` | Hier legst du Teamtermine an: Art, Datum und, wenn du willst, einen Namen. Ein Teamtraining bringt {teamTraining} Teamrynke, ein Tag am Trainingswochenende {weekendDay}, ein Techniktraining {technique}. |
| `tour.organiser.upcoming` | Ein kommender Termin: Rider sagen vorher, ob sie dabei sind. Die Zahl zeigt, wie viele zugesagt haben. |
| `tour.organiser.past` | Ein vergangener Termin: Öffne ihn und hake ab, wer da war; erst dann gibt es die Rynke. Graue Kästchen sind offene Meldungen. Warst du selbst dabei, tippe auf „Ich war auch dabei“. |
| `rynke.ride.countsWithoutRynke` | zählt |
| `tour.rider.events` | Termine: die Teamtermine. Sag vorher Bescheid, ob du dabei bist, und melde danach, dass du da warst. Sobald die Orga dich eingetragen hat, gibt es Teamrynke. |

`tour.organiser.events` goes; the organiser tour now has its own steps. The
other tour messages are unchanged. `rynke.ride.counts` ("zählt 🪙") is now
only for a ride with Training Rynke (FR-011).
