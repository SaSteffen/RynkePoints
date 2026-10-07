# Contract: the progress section of `/me`

This extends 005's [rider-page.md](../../005-rider-view/contracts/rider-page.md).
Tests check this structure. Material Design can later restyle it without changing
what it shows (FR-072). Text is quoted by message ID ([messages.md](messages.md)).
Examples are in German, as the tests are.

## Place on the page (FR-001, spec [D3](../spec.md#d3-section-layout-desktop))

```text
section.rynke-summary · section.rynke-gauges · section.rynke-breakdown · section.rynke-rules
section#progress.progress                   ← this feature
section#rides                               unchanged, apart from the pager links (http-routes.md)
```

The section is absent when `ProgressView.state` is `"none"`:
- no balance (FR-016);
- the balance's rules version is unknown;
- the rebuilt last day disagrees with the balance (research R3).

It is never shown on any other page (FR-002).

## Markup (User Story 1)

```html
<section id="progress" class="progress" aria-labelledby="progress-heading">
  <h2 id="progress-heading">{progress.heading}</h2>
  <p class="progress-rules">{progress.rules version}</p>
  <p class="progress-nothing">{progress.nothingYet}</p>            <!-- only when nothingYet (FR-015) -->
  <nav class="progress-periods" aria-label="{progress.periods.label}">
    <a class="tap" href="/me#progress" aria-current="true">{progress.period.season}</a>
    <a class="tap" href="/me?period=3m#progress">{progress.period.3m}</a>   <!-- only if offered (FR-020) -->
    <a class="tap" href="/me?period=4w#progress">{progress.period.4w}</a>
    <span class="progress-move" hidden>                             <!-- the script shows it while zoomed -->
      <button type="button" class="tap" data-move="-1">{progress.earlier}</button>
      <button type="button" class="tap" data-move="1">{progress.later}</button>
      <button type="button" class="tap" data-reset>{progress.reset}</button>
    </span>
  </nav>
  <figure class="progress-chart" data-chart="training">
    <figcaption>{rynke.training}</figcaption>
    <div class="progress-plot" role="img" aria-label="{progress.chart.training from to value threshold}">
      <div class="progress-y" aria-hidden="true"><span style="bottom:0%">0</span><span style="bottom:33.33%">100</span>…</div>
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path class="grid" d="…"/>
        <path class="line-threshold" d="M0 16.67H1000"/>
        <path class="line-curve" d="M0 100L27.03 93…"/>
        <path class="line-marker" d="" />                           <!-- the script sets it -->
      </svg>
      <span class="progress-line-label" style="bottom:83.33%" aria-hidden="true">250</span>
      <div class="progress-x" aria-hidden="true"><span style="left:0%">Sep.</span>…</div>
    </div>
    <ul class="progress-legend">
      <li><svg class="progress-key" viewBox="0 0 24 4" aria-hidden="true"><path class="line-curve" d="M0 2H24"/></svg>{rynke.training}</li>
      <li><svg class="progress-key" …><path class="line-threshold" d="M0 2H24"/></svg>{progress.legend.threshold value}</li>
    </ul>
  </figure>
  <figure class="progress-chart" data-chart="team">…the same, Team Rynke and their threshold…</figure>
  <p id="progress-readout" class="progress-readout" aria-live="polite" hidden></p>
  <p id="progress-help" class="progress-help" hidden>{progress.help}</p>
  <details class="progress-table">
    <summary>{progress.table.summary}</summary>
    <table>
      <thead><tr><th scope="col">{progress.table.week}</th><th scope="col">{rynke.training}</th><th scope="col">{progress.table.total}</th><th scope="col">{rynke.team}</th><th scope="col">{progress.table.total}</th></tr></thead>
      <tbody><tr><th scope="row">01.09.2026</th><td class="num">21</td><td class="num">21</td><td class="num">1</td><td class="num">1</td></tr>…</tbody>
    </table>
  </details>
  <script type="application/json" id="progress-data">{…}</script>
  <script type="module" src="/progress/progress.js"></script>
</section>
```

| Rule | Requirement |
|---|---|
| The server draws the period from the URL (http-routes.md). The `aria-current` link is the preset shown; none while zoomed freely. | FR-020, FR-052 |
| Both charts are drawn for the same period. | FR-021 |
| `d` of `line-curve` covers the days of the period up to `lastDay`. After `lastDay` there is no line (FR-013). Coordinates have at most 2 decimals. | FR-010, FR-013 |
| The y labels and `line-threshold` use the chart's `yMax` (research R5): 0 … ≥ threshold, never cut off. | FR-014 |
| x labels are months (`Intl` `{month:"short"}`) for periods over 62 days, otherwise days (`{day:"numeric",month:"numeric"}`), at most 6 per chart, in `meta.intlLocale`. | FR-024, FR-061 |
| `aria-label` of each plot gives the period, the value at its end and the threshold as text. | FR-050 |
| Lines are told apart by dash pattern and legend, not only by colour (research R12). There are no fills, areas, bars or other chart kinds. | FR-007, FR-050 |
| No ride, ride name, link, team event, correction, distance, metres, time or speed appears in the section, in the JSON or in any attribute. | FR-005, FR-030, SC-004 |
| The table lists every week of the season up to `lastDay`, oldest first, whatever the period (research R11). The week is labelled with its first day (`formatDate`). | FR-037, FR-051 |
| The readout, help, move buttons and marker are hidden without the script. | FR-052 |
| Every link and button carries `tap` (44 px). | FR-071 |

### Additions of User Story 2

- **Pace line** (`FR-038`, only with a deadline): in each chart
  `<path class="line-pace">` from 0 on the season start to the threshold on the
  deadline, with a legend entry `{progress.legend.pace}`.
- **Without virtual rides** (`FR-039`, only when `virtualCount > 0`): in the
  Training chart, `<path class="line-without-virtual">`, plus
  `<path class="line-needed">` with its label at 167. The legend gains
  `{rynke.withoutVirtual}` and `{progress.legend.needed value}`. The table gains
  a column `{rynke.withoutVirtual}`.
- **Readout** (from the JSON's templates): the pace and how far ahead or behind
  (`progress.day.ahead` / `progress.day.behind` / `progress.day.onPace`), and the
  Training Rynke without virtual rides.

## Chart data

`#progress-data`'s JSON. `<`, `>` and `&` are escaped as `<`, `>` and
`&`. Example for the example rider on 7 October without a deadline:

```json
{
  "seasonStart": "2026-09-01",
  "lastDay": "2026-10-07",
  "axisEnd": "2026-10-07",
  "period": { "from": "2026-09-01", "to": "2026-10-07" },
  "presets": { "3m": null, "4w": { "from": "2026-09-10", "to": "2026-10-07" } },
  "intlLocale": "de-DE",
  "charts": {
    "training": { "values": [0, 0, 0, 0, 0, 21, …, 112], "threshold": 250, "yMax": 300 },
    "team": { "values": [0, 0, 0, 0, 0, 1, …, 17], "threshold": 25, "yMax": 30 }
  },
  "pace": null,
  "withoutVirtual": null,
  "text": {
    "day": "{date}: {training} Trainingsrynke, {team} Teamrynke",
    "chartTraining": "…{from} … {to} … {value} … {threshold}",
    "chartTeam": "…"
  }
}
```

- `values[i]` is the total at the end of day `seasonStart + i`, for `i` from 0 to
  `lastDay − seasonStart`.
- `presets` is `null` for a preset not offered.
- With US2:
  - `pace` is `{ "deadline": "2027-05-31", "totalDays": 273 }`;
  - `withoutVirtual` is `{ "values": […], "needed": 167 }`;
  - `text` gains `pace`, `ahead`, `behind`, `onPace` and `withoutVirtual`.
- Nothing else is in the JSON (FR-005, SC-004, SC-007).

## Script behaviour (`public/progress/progress.js`)

Progressive enhancement. If it doesn't load or throws, the server-rendered
section stays as it is (FR-052).

On load, the script:
1. Reads `#progress-data`.
2. Makes each `.progress-plot` keyboard-focusable: `tabindex="0"`,
   `role="application"`, `aria-describedby="progress-help progress-readout"`.
3. Shows `#progress-help`, `#progress-readout`, and `.progress-move` while zoomed.
4. Sets `touch-action: pan-y` on the plots (through the CSS class `js`).

The inputs and what they do are in research R7. Every change of the period:
- redraws both charts with `chart.js`, the same function the server uses;
- updates the plots' `aria-label`s and the `aria-current` link;
- calls `history.replaceState` with the query of http-routes.md;
- writes that query into `header input[name=next]` (FR-026).

Selecting a day sets the marker in both charts and the readout text.

The script makes no network request, sets no cookie and writes no storage
(FR-003, Principle I).

## CSS (`src/http/html.ts`)

```css
.progress-periods{display:flex;flex-wrap:wrap;gap:0 .75rem;align-items:center}
.progress-periods a[aria-current]{font-weight:700;text-decoration:none}
.progress-chart{margin:1rem 0}
.progress-plot{position:relative;height:10rem;margin:0 0 1.5rem 2.25rem}
.progress-plot svg{display:block;width:100%;height:100%;overflow:visible}
.progress-plot path{fill:none;vector-effect:non-scaling-stroke}
.progress-plot:focus-visible{outline:2px solid #fc5200;outline-offset:2px}
.js .progress-plot{touch-action:pan-y;cursor:crosshair}
.grid{stroke:#eee;stroke-width:1}
.line-curve{stroke:var(--rp-part-1);stroke-width:2.5}
.line-threshold,.line-needed{stroke:#555;stroke-width:1.5;stroke-dasharray:6 4}
.line-pace{stroke:#555;stroke-width:1.5;stroke-dasharray:2 3}
.line-without-virtual{stroke:var(--rp-part-2);stroke-width:2;stroke-dasharray:8 3 2 3}
.line-marker{stroke:#222;stroke-width:1}
.progress-y span,.progress-x span,.progress-line-label{position:absolute;font-size:.75rem;color:#555;white-space:nowrap}
.progress-y span{right:calc(100% + .25rem);transform:translateY(50%)}
.progress-x span{top:calc(100% + .125rem);transform:translateX(-50%)}
.progress-line-label{right:0;transform:translateY(-.125rem)}
.progress-legend{display:flex;flex-wrap:wrap;gap:0 1rem;list-style:none;margin:0;padding:0;font-size:.875rem}
.progress-key{width:1.5rem;height:.25rem;margin-right:.25rem;vertical-align:middle;overflow:visible}
.progress-table table{border-collapse:collapse}
.progress-table th,.progress-table td{padding:.2rem .5rem;text-align:right}
@media (min-width:36rem){.progress-plot{height:12rem}}
```

The script adds the `js` class to the `<section>`, not to `<html>`, so nothing
outside the section changes. Two stacked charts with the readout and the period
buttons fit 360 px wide without scrolling sideways (FR-070, SC-008): the plot is
360 − 2 × 16 (body padding) − 36 (y labels) = 292 px wide, and every label is
HTML text of `.75rem`.
