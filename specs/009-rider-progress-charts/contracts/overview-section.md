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
  <nav class="progress-periods" aria-label="{progress.periods.label}">
    <a class="chip" href="/me#progress" data-from="0" data-to="302" aria-current="true">{progress.period.season}</a>
    <a class="chip" href="/me?period=3m#progress" data-from="…" data-to="…">{progress.period.3m}</a>  <!-- only if offered -->
    <a class="chip" href="/me?period=4w#progress" data-from="9" data-to="36">{progress.period.4w}</a>
    <span class="progress-move" hidden>                           <!-- the script shows it while zoomed -->
      <button type="button" class="button-text" data-move="-1">{progress.earlier}</button>
      <button type="button" class="button-text" data-move="1">{progress.later}</button>
      <button type="button" class="button-text" data-reset>{progress.reset}</button>
    </span>
  </nav>
  <figure class="progress-chart progress-training">
    <figcaption>{mini coin} {rynke.training}</figcaption>
    <div class="progress-plot" role="img" aria-label="{progress.chart.training from to value threshold}">
      <div class="progress-y" aria-hidden="true"><span style="bottom:0%">0</span>…</div>
      <svg viewBox="0 0 302 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <g class="grid">…</g>
        <line class="line-threshold" x1="0" x2="302" y1="0" y2="0"/>
        <polyline class="line-curve" points="0,100 1,100 … 36,55.2"/>
        <g class="progress-cursor" hidden><line/><circle r="4"/></g>   <!-- the script moves it -->
      </svg>
      <span class="progress-line-label" style="bottom:100%" aria-hidden="true">250</span>
      <div class="progress-x" aria-hidden="true"><span style="left:0%">Sep.</span>…</div>
    </div>
    <ul class="progress-legend">
      <li><svg class="progress-key" …><line class="line-curve" …/></svg>{rynke.training}</li>
      <li><svg class="progress-key" …><line class="line-threshold" …/></svg>{progress.legend.threshold value}</li>
    </ul>
  </figure>
  <figure class="progress-chart progress-team">…the same for Team Rynke…</figure>
  <p class="progress-readout" aria-live="polite" hidden></p>
  <p id="progress-help" class="progress-help" hidden>{progress.help}</p>
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

| Rule | Requirement |
|---|---|
| The server draws the period of `?period=` and marks that link `aria-current`. With the script, the link of the period shown carries it; none does while zoomed freely. | FR-020, FR-052 |
| Both plots share one `viewBox`, so they always show the same period. | FR-021 |
| The `line-curve` points run from index 0 to `lastIndex` and stop there. | FR-010, FR-013 |
| The y labels and the threshold use the chart's `yMax` (research R5). | FR-014 |
| Date labels follow research R10, in the section's locale. | FR-024, FR-061 |
| Each plot's `aria-label` gives the period, the value at its end and the threshold. | FR-050 |
| Lines differ by stroke style and legend, not only by colour. There are no fills, areas or bars. | FR-007, FR-050 |
| No ride, ride name, link, team event, correction, distance, metres, time or speed appears in the section, the JSON or any attribute. | FR-005, FR-030, SC-004 |
| The table lists every week up to the last day, oldest first, whatever the period. | FR-037, FR-051 |
| The readout, help, cursor, templates and move buttons stay hidden without the script. | FR-052 |
| Every link and button is at least 44 × 44 px (`--rp-tap`). | FR-071 |
| The plots get `tabindex="0"` from the script, not from the server, so nothing is focusable that does nothing. | FR-053 |

## Additions for User Story 2

- **Pace**: in each chart, `<line class="line-pace">` from (0, 100) to
  (`axisDays`, the threshold's y), with the legend entry
  `{progress.legend.pace}` (FR-038).
- **Outdoor curve**, only for riders with virtual rides (FR-039). The Training
  chart gains:
  - `<polyline class="line-outside">` for the outdoor curve;
  - `<line class="line-needed">` at 167;
  - a second `line-pace` towards 167;
  - legend entries `{rynke.withoutVirtual}` and `{progress.legend.needed value}`.
- **Readout templates**:
  - `data-readout="pace-ahead"`, `"pace-behind"` and `"pace-on"`, one set per line
    with a pace;
  - `data-readout="outside"`.
- **Table**: gains the outdoor columns (research R11).
