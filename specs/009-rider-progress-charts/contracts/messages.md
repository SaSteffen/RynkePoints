# Contract: messages added by this feature

These are new keys in `src/i18n/messages/de.ts` and `en.ts`. The rules of 005's
[messages.md](../../005-rider-view/contracts/messages.md) apply:
- German is the source catalog, and tests assert the German text.
- Both catalogs have the same keys and placeholders.
- Placeholders are plain text that is already formatted.
- Wording may be polished during implementation, with this file and its tests
  changed in the same change.

Texts the script needs are passed to it in the chart data (contracts/rider-page.md),
so the script holds no text itself (FR-060). Existing keys are reused where they
fit: `rynke.training`, `rynke.team`, `rynke.withoutVirtual`.

## User Story 1

| ID | Params | de | en |
|---|---|---|---|
| `progress.heading` | | Dein Saisonverlauf | Your season so far |
| `progress.rules` | `version` | Berechnet mit den Regeln Version {version}, für die ganze Saison. | Worked out with rules version {version}, for the whole season. |
| `progress.nothingYet` | | Du hast in dieser Saison noch keine Rynke gesammelt. | You haven't earned any Rynke this season yet. |
| `progress.periods.label` | | Zeitraum | Period |
| `progress.period.season` | | Ganze Saison | Whole season |
| `progress.period.3m` | | Letzte 3 Monate | Last 3 months |
| `progress.period.4w` | | Letzte 4 Wochen | Last 4 weeks |
| `progress.earlier` | | Früher | Earlier |
| `progress.later` | | Später | Later |
| `progress.reset` | | Ganze Saison zeigen | Show whole season |
| `progress.chart.training` | `from`, `to`, `value`, `threshold` | Trainingsrynke vom {from} bis {to}: {value} am Ende, Ziel {threshold} | Training Rynke from {from} to {to}: {value} at the end, target {threshold} |
| `progress.chart.team` | `from`, `to`, `value`, `threshold` | Teamrynke vom {from} bis {to}: {value} am Ende, Ziel {threshold} | Team Rynke from {from} to {to}: {value} at the end, target {threshold} |
| `progress.legend.threshold` | `value` | Ziel ({value}) | Target ({value}) |
| `progress.help` | | Zum Vergrößern über das Diagramm ziehen oder mit zwei Fingern spreizen. Tastatur: Pfeile wählen einen Tag, + und − zoomen, Bild auf/ab verschiebt, 0 zeigt die ganze Saison. | To zoom, drag across a chart or pinch with two fingers. Keyboard: arrows pick a day, + and − zoom, Page Up/Down move, 0 shows the whole season. |
| `progress.day` | `date`, `training`, `team` | {date}: {training} Trainingsrynke, {team} Teamrynke | {date}: {training} Training Rynke, {team} Team Rynke |
| `progress.table.summary` | | Zahlen als Tabelle | Figures as a table |
| `progress.table.week` | | Woche ab | Week from |
| `progress.table.total` | | Summe | Total |

## User Story 2

| ID | Params | de | en |
|---|---|---|---|
| `progress.legend.pace` | | Gleichmäßiges Tempo bis zum Stichtag | Even pace to the deadline |
| `progress.legend.needed` | `value` | Nötig ohne virtuelle Fahrten ({value}) | Needed without virtual rides ({value}) |
| `progress.day.pace` | `pace` | Tempo: {pace} | Pace: {pace} |
| `progress.day.ahead` | `n` | {n} vor dem Tempo | {n} ahead of the pace |
| `progress.day.behind` | `n` | {n} hinter dem Tempo | {n} behind the pace |
| `progress.day.onPace` | | genau im Tempo | exactly on pace |
| `progress.day.withoutVirtual` | `value` | davon ohne virtuelle Fahrten: {value} | of which without virtual rides: {value} |

Being behind is stated as a number, never as a broken rule (FR-038, US2
scenario 5).

"Ziel" and "Target" name the threshold as 005's gauges do: their captions call it
`{target}` ("{value} von {target}").
