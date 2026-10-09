# Contract: Catalog Messages

New keys in `src/i18n/messages/de.ts` and `en.ts` (FR-042). The quotes themselves
are not catalog keys (research R10). `team.placeholder.*` are removed with the
placeholder; `organiser.riders.link` changes its text.

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
| `team.organiser.overview` | Team overview | Teamübersicht |

## Organiser overview (`organiser.overview.*`)

| Key | English | German |
|---|---|---|
| `organiser.overview.heading` | Team overview | Teamübersicht |
| `organiser.overview.deadline` | Deadline {date} · {n} days to go | Stichtag {date} · noch {n} Tage |
| `organiser.overview.deadlinePassed` | The deadline {date} has passed | Der Stichtag {date} ist vorbei |
| `organiser.overview.qualified` | {n} of {count} in for Paris 🗼 | {n} von {count} sind dabei in Paris 🗼 |
| `organiser.overview.groups` | Groups | Gruppen |
| `organiser.overview.group.push` | Need a push 🍌 | Brauchen Schwung 🍌 |
| `organiser.overview.group.notYet` | Not yet in | Noch nicht dabei |
| `organiser.overview.group.onTrack` | On track 🚴 | Gut unterwegs 🚴 |
| `organiser.overview.group.in` | In for Paris 🗼 | Dabei in Paris 🗼 |
| `organiser.overview.group.all` | Everyone | Alle |
| `organiser.overview.showing` | Showing: {group} | Angezeigt: {group} |
| `organiser.overview.training` | Training {n} of {threshold} | Training {n} von {threshold} |
| `organiser.overview.team` | Team {n} of {threshold} | Team {n} von {threshold} |
| `organiser.overview.outdoor` | Outdoor Training {n} of {required} | Training draußen {n} von {required} |
| `organiser.overview.pace` | Even pace today: {n} | Gleichmäßiges Tempo heute: {n} |
| `organiser.overview.missing` | Missing: {n} | Fehlen: {n} |
| `organiser.overview.behind` | behind pace | hinter dem Tempo |
| `organiser.overview.breakdown` | Where the Rynke come from | Woher die Rynke kommen |
| `organiser.overview.distance` | Distance {n} | Strecke {n} |
| `organiser.overview.elevation` | Elevation {n} | Höhenmeter {n} |
| `organiser.overview.event` | {kind}: {attended}× → {training} Training, {team} Team | {kind}: {attended}× → {training} Training, {team} Team |
| `organiser.overview.corrections` | Corrections {training} Training, {team} Team | Korrekturen {training} Training, {team} Team |
| `organiser.overview.virtual` | Virtual rides {n} % of Training | Virtuelle Fahrten {n} % vom Training |
| `organiser.overview.qualifiedList` | In for Paris | Dabei in Paris |
| `organiser.overview.nobodyYet` | Nobody qualifies yet. | Noch hat sich niemand qualifiziert. |
| `organiser.overview.none` | No riders share their Rynke yet. | Noch teilt niemand seine Rynke. |
| `organiser.overview.column.name` | Rider | Wer |
| `organiser.overview.column.group` | Group | Gruppe |

Team-event kind names reuse the existing `rynke.source.<kind>` keys (005). German
text says "du" and prefers neutral words ("Leute", "alle", "das Team", "wer …").
Where only a personal noun works, it uses the colon form, which screen readers read
as a pause ("Fahrer:innen"); never the gender star or the slash form.
