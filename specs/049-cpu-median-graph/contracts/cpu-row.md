# Contract: the CPU time row on Admin › Nutzung

Inside the Betrieb row "CPU-Zeit der Worker" (feature 048), opened. Its summary
line and level stay as they are (FR-018). The design draft's boards 1–3 show
the result; new CSS only for the `cpu-*` classes below.

## Order inside the row

1. Intro (`usage-detail`), short (FR-014a):
   "Jeder Lauf eines Workers darf 10 ms CPU-Zeit nutzen. Abgebrochene Läufe
   sind Fehler, einzelne Ausreißer verzeiht Cloudflare. Median: Die Hälfte der
   Läufe eines Tages blieb darunter. Langsamste: die langsamsten 1 von 100
   Läufen."
2. The "unavailable" notice, as today, when the last CPU query failed.
3. The season graph, or its empty line.
4. The 30-day table, or "Bisher sind keine CPU-Zahlen aufgezeichnet." as today.

## Season graph

```html
<div class="cpu-graph">
  <div class="cpu-scale" aria-hidden="true"><span>2 ms</span><span>1 ms</span><span>0 ms</span></div>
  <div class="usage-graph" data-locale="de-DE" data-slots="53"
       data-weeks="2026-09-01/2026-09-06/1120/920/340,…,2026-11-23/2026-11-29/1740/1160/"
       data-names="Dieses Team|Anderes Team|Gemeinsam (Gateway)"
       data-gap="Nichts aufgezeichnet">
    <svg class="cpu-chart" viewBox="0 0 530 120" preserveAspectRatio="none"
         role="img" aria-label="Median-CPU-Zeit je Woche, Saison 2026/27: Dieses Team, Anderes Team, Gemeinsam (Gateway)">
      <line class="cpu-grid" …/>                       <!-- top and middle -->
      <line class="cpu-now" …/>                        <!-- today, dotted -->
      <line class="cpu-limit" …/>                      <!-- only when the scale reaches 10 ms -->
      <path class="cpu-line cpu-own" d="M… L… M…h0" vector-effect="non-scaling-stroke"/>
      <path class="cpu-line cpu-others" …/>
      <path class="cpu-line cpu-shared" …/>
    </svg>
  </div>
  <p class="usage-axis cpu-axis" aria-hidden="true"><span>Sep</span>…<span>Aug</span></p>
</div>
<ul class="cpu-legend">
  <li><svg aria-hidden="true">…solid…</svg>Dieses Team</li>
  <li><svg aria-hidden="true">…dashed…</svg>Anderes Team</li>
  <li><svg aria-hidden="true">…dotted…</svg>Gemeinsam (Gateway)</li>
</ul>
<p class="usage-detail">Je Woche der höchste Tages-Median, die gepunktete Linie ist heute. Das Limit von 10 ms je Lauf liegt weit über diesem Ausschnitt.</p>
```

- `data-weeks`: one entry per slot from the season's first up to the current
  one, `from/to/own/others/shared`, values in µs, empty for no record. Slots
  after it (up to `data-slots`) are drawn empty and show no tip.
- Lines: solid `--rp-graph-1` (this team), dashed `--rp-graph-2` (other teams),
  dotted `--rp-graph-3` (gateway). A week without a value breaks the line; a
  lone week is a dot. Never drawn at zero for a missing week (FR-007).
- Scale labels: the scale's top, its middle and 0, in `admin.cpu.ms`.
- Months: the twelve short month names of the viewer's language, September
  first (`admin.cpu.months`, one catalog string, `|`-separated).
- The line under the graph: `admin.cpu.under` when the scale stays below
  10 ms (as above); `admin.cpu.underLimit` when the limit line is drawn ("Je
  Woche der höchste Tages-Median, die gepunktete Linie ist heute, die rote
  gestrichelte das Limit von 10 ms je Lauf.").

Hover or tap (`public/app.js`, `usageGraphs`): the cursor covers the slot, the
tip (`usage-tip`, `white-space: pre-line`) reads

```text
16.11.–22.11.2026
Dieses Team 1,7 ms
Anderes Team 1,2 ms
Gemeinsam (Gateway) Nichts aufgezeichnet
```

Empty season (FR-012), instead of the graph, legend and line under it:

```html
<p class="usage-detail cpu-empty">Für diese Saison ist noch kein Median aufgezeichnet. Die Grafik füllt sich ab dem ersten aufgezeichneten Tag.</p>
```

## Table

Header: Tag | Dieses Team | Anderes Team | Gemeinsam (Gateway), each owner's
header with a second line:

```html
<th scope="col">Dieses Team<br><span class="cpu-head">Median / langsamste</span></th>
```

Cell, per day and owner:

```html
<td>1,4 / 7,8&nbsp;ms<br>0 von 1.234 abgebrochen</td>
<td>– / 7,8&nbsp;ms<br>3 von 1.234 abgebrochen <span class="usage-mark usage-mark-warning">Warnung</span></td>
<td>–</td>   <!-- owner without a record that day, as today -->
```

The mark rule (feature 025 FR-043) is unchanged.

## Catalog keys (all ten languages, German the source)

| Key | German |
|---|---|
| `admin.cpu.intro` | changed: the short intro above |
| `admin.cpu.pair` | `{median} / {slowest} ms` |
| `admin.cpu.cutOff` | `{cut} von {runs} abgebrochen` |
| `admin.cpu.pairHead` | `Median / langsamste` |
| `admin.cpu.chart` | `Median-CPU-Zeit je Woche, Saison {season}: {names}` |
| `admin.cpu.months` | `Sep\|Okt\|Nov\|Dez\|Jan\|Feb\|Mär\|Apr\|Mai\|Jun\|Jul\|Aug` |
| `admin.cpu.under` | the line under the graph, limit above the scale |
| `admin.cpu.underLimit` | the line under the graph, limit drawn |
| `admin.cpu.seasonNone` | the empty season line |
| `admin.cpu.cell` | removed |

Reused: `admin.cpu.ms`, `admin.history.team`, `admin.teams.other`,
`admin.teams.shared`, `admin.history.gap`, `meta.intlLocale`.
