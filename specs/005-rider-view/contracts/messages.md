# Contract: messages added by this feature

New keys of `src/i18n/messages/de.ts` and `en.ts`. Feature 001's
[messages.md](../../001-strava-connect-webhook/contracts/messages.md) rules apply:
- German is the source catalog, and tests assert the German text.
- Both catalogs have exactly the same keys and the same placeholders.
- Wording may be polished during implementation, with this file and the tests
  that quote it updated in the same change.
- Placeholders marked *html* are `SafeHtml`. All others are plain text, already
  formatted by the renderer with `formatNumber`, `formatDate`, `formatTime` or
  the `units.*` messages.

The **Delivery** column says which story adds the key (FR-006). A key is only
added with its story.

## Units and formats

| ID | Params | de | en | Delivery |
|---|---|---|---|---|
| `units.percent` | `value` | {value} % | {value}% | US2 |
| `units.kmh` | `value` | {value} km/h | {value} km/h | US4 |
| `units.mPerH` | `value` | {value} m/h | {value} m/h | US4 |
| `units.duration` | `h`, `min` | {h} h {min} min | {h} h {min} min | US4 |
| `units.durationMin` | `min` | {min} min | {min} min | US4 |

## Labels (FR-060)

| ID | de | en | Delivery |
|---|---|---|---|
| `rynke.training` | Trainingsrynke | Training Rynke | US1 |
| `rynke.team` | Teamrynke | Team Rynke | US1 |
| `rynke.withoutVirtual` | Trainingsrynke ohne virtuelle Fahrten | Training Rynke without virtual rides | US1 |

## Notices (`section.notice`)

| ID | Params | de | en | Delivery |
|---|---|---|---|---|
| `rynke.notice.notWorkedOut` | | Deine Rynke werden gerade berechnet. Schau in ein paar Minuten wieder vorbei. | Your Rynke are still being worked out. Check back in a few minutes. | US1 |
| `rynke.notice.updating` | `date`, `version` | Die Regeln haben sich geändert: Seit dem {date} gelten neue Regeln. Deine Zahlen werden gerade neu berechnet; bis dahin siehst du sie nach Regel-Version {version}. | The rules have changed: new rules apply since {date}. Your numbers are being updated; until then you see them under rules version {version}. | US6 |
| `rynke.notice.importing` | `date` | Deine Fahrten seit dem {date} werden noch importiert. Deine Rynke wachsen, sobald sie da sind. | Your rides since {date} are still being imported. Your Rynke will grow as they arrive. | US6 |

## Summary (US1)

| ID | Params | de | en |
|---|---|---|---|
| `rynke.summary.heading` | | Deine Rynke | Your Rynke |
| `rynke.verdict.in` | | Qualifiziert für Paris! 🗼 Du hast alles, was du für die Tour brauchst. | Qualified for Paris! 🗼 You have everything you need for the tour. |
| `rynke.verdict.notYet` | | Noch nicht qualifiziert 🍌 Dir fehlen: | Not qualified yet 🍌 You still need: |
| `rynke.missing.training` | `n` | {n} Trainingsrynke | {n} Training Rynke |
| `rynke.missing.team` | `n` | {n} Teamrynke | {n} Team Rynke |
| `rynke.missing.withoutVirtual` | `n` | {n} Trainingsrynke aus Fahrten draußen (nicht virtuell) | {n} Training Rynke from outdoor (non-virtual) rides |
| `rynke.summary.ofTarget` | `value`, `target` | {value} von {target} | {value} of {target} |
| `rynke.summary.missing` | `n` | {n} fehlen noch | {n} still missing |
| `rynke.summary.reached` | | erreicht ✓ | reached ✓ |

With an unknown target (FR-013), the formatted value is printed on its own,
without `rynke.summary.ofTarget`.

## Gauges (US2)

| ID | Params | de | en |
|---|---|---|---|
| `rynke.gauges.heading` | | Dein Fortschritt | Your progress |
| `rynke.gauge.caption` | `label`, `value`, `target`, `percent` | {label}: {value} von {target} · {percent} | {label}: {value} of {target} · {percent} |
| `rynke.gauge.reached` | | ✓ erreicht | ✓ reached |
| `rynke.gauge.elevation` | `value`, `target`, `percent`, `missing`, `stepRynke` | Höhenmeter bis zu den nächsten {stepRynke} Trainingsrynke: {value} von {target} · {percent} · noch {missing} | Elevation towards the next {stepRynke} Training Rynke: {value} of {target} · {percent} · {missing} to go |
| `rynke.source.distance` | | Distanz | Distance |
| `rynke.source.elevation` | | Höhenmeter | Elevation |

## Breakdown (US3)

| ID | Params | de | en | Delivery |
|---|---|---|---|---|
| `rynke.breakdown.heading` | | Woher deine Rynke kommen | Where your Rynke come from | US3a |
| `rynke.breakdown.trainingRynke` | `n` | {n} Trainingsrynke | {n} Training Rynke | US3a |
| `rynke.breakdown.elevation` | `metres`, `rynke`, `toNext`, `stepRynke` | {metres} gesamt → {rynke} Trainingsrynke, noch {toNext} bis zu den nächsten {stepRynke} | {metres} in total → {rynke} Training Rynke, {toNext} to the next {stepRynke} | US3a |
| `rynke.breakdown.elevationNoStep` | `metres`, `rynke`, `toNext` | {metres} gesamt → {rynke} Trainingsrynke, noch {toNext} bis zur nächsten Stufe | {metres} in total → {rynke} Training Rynke, {toNext} to the next step | US3a |
| `rynke.breakdown.total` | | Gesamt | Total | US3a |
| `rynke.breakdown.totals` | `training`, `team` | {training} Trainingsrynke · {team} Teamrynke | {training} Training Rynke · {team} Team Rynke | US3a |

| `rynke.source.team_training` | | Teamtraining | Team training | US3b |
| `rynke.source.training_weekend_day` | | Tag Trainingswochenende | Training-weekend day | US3b |
| `rynke.source.technique_training` | | Techniktraining | Technique training | US3b |
| `rynke.breakdown.kind` | `count`, `team`, `training` | {count} × dabei → {team} Teamrynke, {training} Trainingsrynke | attended {count} × → {team} Team Rynke, {training} Training Rynke | US3b |
| `rynke.events.heading` | | Deine Teamtermine | Your team events | US3b |
| `rynke.events.none` | | Für dich ist noch kein Teamtermin eingetragen. | No team event has been recorded for you yet. | US3b |
| `rynke.events.notCounting` | | zählt nicht: außerhalb des Wertungszeitraums | doesn't count: outside the counting period | US3b |

- There is one `rynke.source.<kind>` per value of feature 003's
  `TEAM_EVENT_KINDS` (`team_training`, `training_weekend_day`,
  `technique_training`); `catalogs.test.ts` checks every kind has one (FR-062).
  The same label names the kind in the breakdown, the gauge legends and the
  event list.
- An event line is `{date} · {rynke.source.<kind>}`, then ` · {name}` when the
  event has one, then ` · {rynke.events.notCounting}` outside the counting
  window. The name is the organiser's text, printed escaped and never
  translated.

Corrections add, with feature 003 Story 6 (research R5), wording fixed in their
tasks:
- `rynke.source.corrections`;
- `rynke.breakdown.corrections` {training} {team};
- `rynke.breakdown.neverBelowZero`;
- `rynke.corrections.heading`, `rynke.corrections.none`;
- `rynke.correction.line` {date} {training} {team} {reason}.

## Rules (US6)

| ID | Params | de | en |
|---|---|---|---|
| `rynke.rules.heading` | | Regeln | Rules |
| `rynke.rules.version` | `version`, `date` | Berechnet nach Regel-Version {version}, gültig seit dem {date}. | Computed with rules version {version}, in effect since {date}. |
| `rynke.rules.window` | `start` | Es zählt alles ab dem {start}. | Everything from {start} counts. |
| `rynke.rules.windowDeadline` | `start`, `deadline` | Es zählt alles vom {start} bis zum {deadline}. | Everything from {start} to {deadline} counts. |
| `rynke.rules.handout` | | So funktionieren die Rynke (Regeln zum Nachlesen) | How Rynke work (rules handout, in German) |

## Rides (US1, US4, US5)

| ID | Params | de | en | Delivery |
|---|---|---|---|---|
| `me.recent.heading` *(changed text)* | | Deine Fahrten | Your rides | US5 |
| `rynke.rides.col.status` | | Zählt? | Counts? | US1 |
| `rynke.rides.col.elevationTotal` | | Für die Höhenmeter | Towards elevation | US1 |
| `rynke.ride.counts` | | zählt | counts | US1 |
| `rynke.ride.doesNotCount` | | zählt nicht | doesn't count | US1 |
| `rynke.ride.beingEvaluated` | | wird ausgewertet | being evaluated | US1 |
| `rynke.ride.virtual` | | virtuell | virtual | US1 |
| `rynke.ride.fixHint` | | Du kannst die Fahrt auf Strava korrigieren oder dich an das Orga-Team wenden. | You can correct the ride on Strava or ask an organiser. | US4 |
| `rynke.rides.position` | `from`, `to`, `total` | Fahrten {from}–{to} von {total} | Rides {from}–{to} of {total} | US5 |
| `rynke.pager.label` | | Seiten | Pages | US5 |
| `rynke.pager.first` | | « Neueste | « Newest |  US5 |
| `rynke.pager.previous` | | ‹ Neuere | ‹ Newer | US5 |
| `rynke.pager.next` | | Ältere › | Older › | US5 |
| `rynke.pager.last` | | Älteste » | Oldest » | US5 |

## Reasons (US4, FR-042, FR-062)

Each `REASON_CODES` value of feature 003 has a base key `rynke.reason.<code>`.
`catalogs.test.ts` checks that it exists in every catalog (SC-003). Variants
cover rule values that are unknown (FR-013) and special figures (research R12).

| ID | Params | de | en |
|---|---|---|---|
| `rynke.reason.flagged` | | Strava hat die Fahrt markiert. Wenn du anderer Meinung bist, kläre das bitte mit Strava. | Strava flagged this ride. If you disagree, please settle it with Strava. |
| `rynke.reason.pause` | `paused`, `moving` | Zu lange Pause: {paused} Pause bei {moving} Bewegungszeit – mehr als die Hälfte ist nicht erlaubt. | Paused too long: {paused} paused for {moving} moving time – more than half is not allowed. |
| `rynke.reason.pause.share` | `paused`, `moving`, `share` | Zu lange Pause: {paused} Pause bei {moving} Bewegungszeit – mehr als {share} ist nicht erlaubt. | Paused too long: {paused} paused for {moving} moving time – more than {share} is not allowed. |
| `rynke.reason.pause.noLimit` | `paused`, `moving` | Zu lange Pause: {paused} Pause bei {moving} Bewegungszeit. | Paused too long: {paused} paused for {moving} moving time. |
| `rynke.reason.pause.noMovingTime` | | Keine Bewegungszeit: Die Fahrt gilt als ganz pausiert. | No moving time: the ride counts as paused throughout. |
| `rynke.reason.manual` | | Manuell auf Strava eingetragen. | Entered manually on Strava. |
| `rynke.reason.too_slow` | `speed`, `limit` | Zu langsam: {speed} im Schnitt, mindestens {limit} sind nötig. | Too slow: {speed} on average, at least {limit} needed. |
| `rynke.reason.too_slow.noLimit` | `speed` | Zu langsam: {speed} im Schnitt. | Too slow: {speed} on average. |
| `rynke.reason.too_fast` | `speed`, `limit` | Zu schnell für eine Radfahrt: {speed} im Schnitt, höchstens {limit} sind erlaubt. | Too fast for a bike ride: {speed} on average, at most {limit} allowed. |
| `rynke.reason.too_fast.noLimit` | `speed` | Zu schnell für eine Radfahrt: {speed} im Schnitt. | Too fast for a bike ride: {speed} on average. |
| `rynke.reason.climbing_rate` | `rate`, `limit` | Zu viele Höhenmeter für die Zeit: {rate} bergauf, höchstens {limit} sind erlaubt. | Too much climbing for the time: {rate} uphill, at most {limit} allowed. |
| `rynke.reason.climbing_rate.noLimit` | `rate` | Zu viele Höhenmeter für die Zeit: {rate} bergauf. | Too much climbing for the time: {rate} uphill. |
| `rynke.reason.excluded_sport_type` | `sport` | {sport} zählt nicht für die Rynke. | {sport} doesn't count for Rynke. |
| `rynke.reason.outside_window` | `date` | Vor dem Saisonstart am {date}. | Before the season start on {date}. |
| `rynke.reason.outside_window.afterDeadline` | `date` | Nach dem Stichtag am {date}. | After the deadline on {date}. |
| `rynke.reason.outside_window.afterDeadlineNoDate` | | Nach dem Stichtag. | After the deadline. |
| `rynke.reason.overlap` | `date`, `time`, `distance` | Doppelt aufgezeichnet: Deine Fahrt vom {date}, {time} Uhr, {distance} zählt stattdessen. | Recorded twice: your ride of {date}, {time}, {distance} counts instead. |
| `rynke.reason.overlap.noRide` | | Doppelt aufgezeichnet: Eine andere deiner Fahrten zählt stattdessen. | Recorded twice: another of your rides counts instead. |
| `rynke.reason.unknown` | | Zählt nach den aktuellen Regeln nicht. | Doesn't count under the current rules. |

`share` is formatted as `{num}/{den}`, for example "1/3". `rynke.reason.pause`
is used when the share is exactly 1/2.

## Unknown figures (US4, FR-043)

One key per `UNKNOWN_FIGURE_CODES` value, which `catalogs.test.ts` checks.

| ID | de | en |
|---|---|---|
| `rynke.unknown.elapsed_time` | Die Gesamtzeit mit Pausen fehlt noch, deshalb ist die Pausenregel noch nicht geprüft. | The elapsed time including pauses is still missing, so the pause rule hasn't been checked yet. |
| `rynke.unknown.manual` | Ob die Fahrt manuell eingetragen wurde, ist noch nicht bekannt. | Whether the ride was entered manually isn't known yet. |
| `rynke.unknown.trainer` | Ob die Fahrt auf dem Rollentrainer war, ist noch nicht bekannt. | Whether the ride was on an indoor trainer isn't known yet. |
| `rynke.unknown.flagged` | Ob Strava die Fahrt markiert hat, ist noch nicht bekannt. | Whether Strava flagged the ride isn't known yet. |
| `rynke.unknown.mayChange` | Das Ergebnis kann sich noch ändern. | The result may still change. |

## Removed

| ID | Removed with | Why |
|---|---|---|
| `me.recent.col.sport` | US1 | The sport type moved from the main row into the ride's detail row, which shows `sport.*` without a column header. |
| `me.recent.col.elevation` | US1 | The elevation gain moved into the detail row as `units.m`; the main row's metres are `rynke.rides.col.elevationTotal`. |
| `me.import.running` | US6 | `rynke.notice.importing` {date} says it, so a running import is mentioned once; the status line shows only `me.import.done`. |
