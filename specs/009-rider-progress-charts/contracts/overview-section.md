# Contract: the progress section on the Overview

The section extends the Overview (`/me`, 011 and 015). Text is quoted by message
ID ([messages.md](messages.md)), and tests check structure, not styling. The look
follows research R12.

## Place (FR-001, [D3](../spec.md#d3-section-layout-desktop))

```text
div.overview-grid
  section.hero · notices · celebration · section.rynke-summary · section.rynke-gauges · section.rynke-breakdown
  section#progress.progress.card-outlined      ← this feature, both grid columns
```

**When the section is absent** (`ProgressView.state === "none"`):
- there is no balance: the Overview shows its waiting state instead (015 FR-001);
- the balance's rules version is unknown (FR-040).

It appears on no other page (FR-002). On the tour's Overview step it shows the
example rider (FR-043).

## Markup (User Story 1)

```html
<section id="progress" class="progress card-outlined" aria-labelledby="progress-heading"
	data-locale="de-DE">
  <h2 id="progress-heading">{progress.heading}</h2>
  <p class="progress-rules">{progress.rules version}</p>
  <p class="progress-nothing">{progress.nothingYet}</p>          <!-- only when nothingYet (FR-015) -->
  <div class="progress-periods" role="group" aria-label="{progress.periods.label}">
    <button type="button" class="chip" data-from="0" data-to="302" aria-pressed="true">{progress.period.season}</button>
    <button type="button" class="chip" data-from="…" data-to="…" aria-pressed="false">{progress.period.3m}</button>  <!-- only if offered -->
    <button type="button" class="chip" data-from="9" data-to="36" aria-pressed="false">{progress.period.4w}</button>
    <span class="progress-move" hidden>                           <!-- the script shows it while zoomed -->
      <button type="button" class="button-text" data-move="-1">{progress.earlier}</button>
      <button type="button" class="button-text" data-move="1">{progress.later}</button>
      <button type="button" class="button-text" data-reset>{progress.reset}</button>
    </span>
  </div>
  <figure class="progress-chart progress-training">
    <figcaption>{mini coin} {rynke.training}</figcaption>
    <div class="progress-plot">
      <canvas data-series="training" role="img" tabindex="0" aria-describedby="progress-help"
        aria-label="{progress.chart.training from to value threshold, for the whole season}"></canvas>
    </div>
    <template data-label="training">{progress.chart.training, with <span data-slot> for each}</template>
    <ul class="progress-legend">
      <li><span class="progress-key key-curve" aria-hidden="true"></span>{rynke.training}</li>
      <li><span class="progress-key key-threshold" aria-hidden="true"></span>{progress.legend.threshold value}</li>
    </ul>
  </figure>
  <figure class="progress-chart progress-team">…the same for Team Rynke…</figure>
  <p class="progress-readout" aria-live="polite"></p>
  <p id="progress-help" class="progress-help">{progress.help}</p>
  <template data-readout="day">{progress.day date training team, with <span data-slot> for each}</template>
  <details class="progress-table">
    <summary>{progress.table.summary}</summary>
    <div class="progress-table-scroll"><table>
      <thead><tr><th scope="col">{progress.table.week}</th>
        <th scope="col">{rynke.training}</th><th scope="col">{progress.table.total}</th>
        <th scope="col">{rynke.team}</th><th scope="col">{progress.table.total}</th></tr></thead>
      <tbody><tr><th scope="row">01.09.2026</th><td class="num">21</td><td class="num">21</td><td class="num">1</td><td class="num">1</td></tr>…</tbody>
    </table></div>
  </details>
  <script type="application/json" id="progress-data">{…}</script>
</section>
```

The page's `<head>` gets the vendor scripts before `app.js`, through
`LayoutOptions.scripts` (research R6):

```html
<script src="/vendor/hammer-2.0.8.min.js" defer></script>
<script src="/vendor/chart-4.5.1.umd.min.js" defer></script>
<script src="/vendor/chartjs-plugin-zoom-2.2.0.min.js" defer></script>
<script src="/app.js" defer></script>
```

| Rule | Requirement |
|---|---|
| The page opens on the whole season: the season button is `aria-pressed="true"`. The script keeps `aria-pressed` on the button whose stretch is shown; none is pressed while zoomed freely. | FR-020, FR-026 |
| Both canvases always show the same period (`applyPeriod`, research R7). | FR-021 |
| The curve runs from index 0 to `lastIndex` and stops there. | FR-010, FR-013 |
| The y scale and the threshold use the chart's `yMax` (research R5). | FR-014 |
| Date labels follow research R10, in the section's locale. | FR-024, FR-061 |
| Each canvas's `aria-label` gives the period, the value at its end and the threshold; the script refills it from `template[data-label]` on every change. | FR-050 |
| Lines differ by stroke style and legend, not only by colour. There are no fills, areas or bars. | FR-007, FR-050 |
| No ride, ride name, link, team event, correction, distance, metres, time or speed appears in the section, the JSON or any attribute. | FR-005, FR-030, SC-004 |
| The table lists every week up to the last day, oldest first, whatever the period. It is the charts' text version for screen readers. | FR-037, FR-050, FR-051 |
| Every button is at least 44 × 44 px (`--rp-tap`). | FR-071 |
| Each canvas is focusable (`tabindex="0"`) and described by the key help. | FR-053 |
| The vendor scripts are loaded only on an Overview that shows the section. | research R6 |

## Additions for User Story 2

- **Pace**: in each chart, a dataset from (0, 0) to (`axisDays`, the threshold),
  with the legend entry `{progress.legend.pace}` (FR-038).
- **Outdoor curve**, only for riders with virtual rides (FR-039). The Training
  chart gains:
  - a dataset for the outdoor curve;
  - a dataset for the line at 167;
  - a second pace dataset towards 167;
  - legend entries `{rynke.withoutVirtual}` and `{progress.legend.needed value}`.
- **Readout templates**:
  - `data-readout="pace-ahead"`, `"pace-behind"` and `"pace-on"`, one set per line
    with a pace;
  - `data-readout="outside"`.
- **Table**: gains the outdoor columns (research R11).
