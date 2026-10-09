# Contract: Catalog Messages

New keys in `src/i18n/messages/de.ts` and `en.ts` (FR-042). The quotes themselves
are not catalog keys (research R10). `team.placeholder.*` are removed with the
placeholder; `organiser.link` and `organiser.riders.link` are removed with the
links the Orga tab and its switch replace.

Ordinals: English places use `{place}` already formatted by a small helper
(`1st`, `2nd`, `3rd`, `4th`, `11th`–`13th`); German uses `{place}.`.

## Team page (`team.*`)

| Key | English | German |
|---|---|---|
| `team.heading` | Team | Team |
| `team.total.label` | Team Rynkeby Hamburg 🦧 | Team Rynkeby Hamburg 🦧 |
| `team.total.value` | {n} Rynke | {n} Rynke |
| `team.total.kind` | {kind} Rynke collected together | {kind}-Rynke gemeinsam gesammelt |
| `team.total.thisWeek` | +{n} this week 🔥 | +{n} diese Woche 🔥 |
| `team.kind.label` | Which Rynke | Welche Rynke |
| `team.kind.training` | Training | Training |
| `team.kind.team` | Team | Team |
| `team.place` | You're {place} of {count} riders 🚴 | Du bist {place} von {count} 🚴 |
| `team.place.joint` | You're joint {place} of {count} riders 🚴 | Du bist gemeinsam {place} von {count} 🚴 |
| `team.place.next` | {n} Rynke to pass the next place | Noch {n} Rynke bis zum nächsten Platz |
| `team.place.lead` | You lead the peloton. Bring the others along! | Du führst das Peloton an. Nimm die anderen mit! |
| `team.quote.push` | For you 🍌 | Für dich 🍌 |
| `team.quote.onTrack` | For you 🤝 | Für dich 🤝 |
| `team.peloton.heading` | The peloton 🚴 | Das Peloton 🚴 |
| `team.peloton.hint` | Every coin is a rider. The front of the bunch rides on the right. | Jede Münze ist eine Person aus dem Team. Die Spitze des Feldes fährt rechts. |
| `team.peloton.back` | Back of the bunch | Ende des Feldes |
| `team.peloton.front` | Front 🏁 | Spitze 🏁 |
| `team.peloton.label` | {count} riders between {min} and {max} Rynke; you have {own} | {count} Leute zwischen {min} und {max} Rynke; du hast {own} |
| `team.peloton.you` | You | Du |
| `team.list.heading` | Leaderboard | Rangliste |
| `team.list.count` | {n} riders listed | {n} Rider |
| `team.list.hint` | No names, just Rynke. The line shows each rider's season so far. | Keine Namen, nur Rynke. Die Linie zeigt die bisherige Saison jeder Person. |
| `team.list.scope` | Show | Zeigen |
| `team.list.around` | Around you | Um dich herum |
| `team.list.everyone` | Everyone | Alle |
| `team.list.ahead` | · · · {n} riders ahead · · · | · · · {n} weitere vor dir · · · |
| `team.list.behind` | · · · {n} riders behind · · · | · · · {n} weitere hinter dir · · · |
| `team.list.you` | You 🦧 | Du 🦧 |
| `team.list.other` | {n} {kind} | {n} {kind} |
| `team.list.weeks` | Week by week: {values} | Woche für Woche: {values} |
| `team.chart.heading` | The team, week by week | Das Team, Woche für Woche |
| `team.chart.hint` | Everyone's {kind} Rynke added up, at the end of each week. | Die {kind}-Rynke aller zusammengezählt, am Ende jeder Woche. |
| `team.chart.now` | this week | diese Woche |
| `team.chart.label` | Team {kind} at the end of each week, {weeks} weeks, now {total} | Team-{kind} am Ende jeder Woche, {weeks} Wochen, jetzt {total} |
| `team.chart.best` | Best team week so far: +{n} in the week ending {date} 🔥 | Beste Teamwoche bisher: +{n} in der Woche bis {date} 🔥 |
| `team.chart.table` | All weeks | Alle Wochen |
| `team.chart.week` | Week ending | Woche bis |
| `team.chart.total` | Total | Gesamt |
| `team.chart.gain` | Gain | Plus |

## Orga tab and switch

| ID | en | de |
|----|----|----|
| `nav.organiser` | Orga | Orga |
| `organiser.switch.label` | Orga views | Orga-Ansichten |
| `organiser.switch.riders` | Riders | Rider |
| `organiser.switch.events` | Events | Termine |

## Organiser overview (`organiser.overview.*`)

| Key | English | German |
|---|---|---|
| `organiser.overview.heading` | Team overview | Teamübersicht |
| `organiser.overview.deadline` | Qualification deadline · {date} | Stichtag · {date} |
| `organiser.overview.daysLeft` | {n} days to go ⏳ | Noch {n} Tage ⏳ |
| `organiser.overview.deadlinePassed` | The deadline has passed | Der Stichtag ist vorbei |
| `organiser.overview.qualified` | {n} of {count} reached their training goal 🎯 | {n} von {count} haben ihr Trainingsziel erreicht 🎯 |
| `organiser.overview.groups` | Groups | Gruppen |
| `organiser.overview.group.push` | Need a push 🍌 | Braucht Schwung 🍌 |
| `organiser.overview.group.notYet` | Training goal not reached yet | Trainingsziel noch nicht erreicht |
| `organiser.overview.group.onTrack` | On track 🚴 | Gut unterwegs 🚴 |
| `organiser.overview.group.in` | Training goal reached 🎯 | Trainingsziel erreicht 🎯 |
| `organiser.overview.group.all` | Everyone | Alle |
| `organiser.overview.showing` | Showing: {group} | Angezeigt: {group} |
| `organiser.overview.training` | Training {n} of {threshold} | Training {n} von {threshold} |
| `organiser.overview.team` | Team {n} of {threshold} | Team {n} von {threshold} |
| `organiser.overview.outdoor` | Outdoor Training {n} of {required} | Training draußen {n} von {required} |
| `organiser.overview.toGo.training` | {n} Training to go | Noch {n} Training |
| `organiser.overview.toGo.team` | {n} Team to go | Noch {n} Team |
| `organiser.overview.toGo.outdoor` | {n} outdoor Training to go | Noch {n} Training draußen |
| `organiser.overview.behind` | behind pace | hinter dem Tempo |
| `organiser.overview.breakdown` | Where the Rynke come from | Woher die Rynke kommen |
| `organiser.overview.distance` | Distance {n} | Distanz {n} |
| `organiser.overview.elevation` | Elevation {n} | Höhenmeter {n} |
| `organiser.overview.virtual` | Virtual rides {n} % of Training | Virtuelle Fahrten {n} % vom Training |
| `organiser.overview.amounts` | {training} Training, {team} Team | {training} Training, {team} Team |
| `organiser.overview.percent` | {n}% | {n} % |
| `organiser.overview.qualifiedList` | Training goal reached 🎯 | Trainingsziel erreicht 🎯 |
| `organiser.overview.nobodyYet` | Nobody has reached the training goal yet. | Noch hat niemand das Trainingsziel erreicht. |
| `organiser.overview.none` | No riders share their Rynke yet. | Noch teilt niemand Rynke mit dem Team. |
| `organiser.overview.column.name` | Rider | Wer |
| `organiser.overview.column.group` | Group | Gruppe |
| `organiser.overview.column.training` | Training | Training |
| `organiser.overview.column.team` | Team | Team |
| `organiser.overview.column.outdoor` | Outdoor | Draußen |
| `organiser.overview.column.missing` | Still to go | Fehlt noch |
| `organiser.overview.column.distance` | Distance | Distanz |
| `organiser.overview.column.elevation` | Elevation | Höhenmeter |
| `organiser.overview.column.events` | Team events | Termine |
| `organiser.overview.column.corrections` | Corrections | Korrekturen |
| `organiser.overview.column.virtual` | Virtual | Virtuell |

`organiser.riders.back` becomes "Back to the team overview" / "Zurück zur Teamübersicht";
`organiser.riders.heading` and `organiser.riders.none` are removed with 014's plain
list.

Team-event kind names reuse the existing `rynke.source.<kind>` keys (005). German
text says "du" and prefers neutral words ("Leute", "alle", "das Team", "wer …").
Where only a personal noun works, it uses the colon form, which screen readers read
as a pause ("Fahrer:innen"); never the gender star or the slash form.
