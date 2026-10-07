# Contract: the rider page's Rynke sections

What `GET /me` renders, section by section. Tests check this structure, and
Material Design later can restyle it without changing what it shows
(research R10). Text is quoted by message ID ([messages.md](messages.md)); the
examples use German, as tests do.

## Order (spec [D4](../spec.md#d4-page-layout-desktop))

```text
<h1> greeting                       feature 001, unchanged
status, scopes, change permissions  feature 001, unchanged
import status                       feature 001, unchanged
section.notice      (when one applies)                     US1 (FR-015) · US6 (FR-051, FR-052)
section#rynke.rynke-summary                               US1
section.rynke-gauges                                      US2
section.rynke-breakdown                                   US3a, US3b
section.rynke-rules                                       US6
section#rides                                             US1 · US4 · US5
section consent                     feature 001/004, unchanged
disconnect link, sign-out form      feature 001, unchanged
```

A section belongs to a delivery and is absent before that delivery (FR-006).
The *not worked out* state (`balance === null`) renders only `section.notice`
and `section#rides`. There is no summary, gauges, breakdown or rules section,
and no zeros (FR-015).

## `section.notice` (`role="status"`)

At most one of the first two, plus the import line when it applies:

- `rynke.notice.notWorkedOut`: no balance stored (FR-015).
- `rynke.notice.updating` {date}: the balance's version differs from the
  version in effect (FR-051, research R4).
- `rynke.notice.importing`: `import_status` is not `done` (FR-052).

## `section#rynke.rynke-summary` (US1)

```html
<section id="rynke" class="rynke-summary">
  <h2>{rynke.summary.heading}</h2>
  <p class="rynke-verdict">{rynke.verdict.in | rynke.verdict.notYet}</p>
  <ul class="rynke-missing">…one li per unmet condition…</ul>   <!-- only when not in -->
  <dl>
    <dt>{rynke.training}</dt><dd>{rynke.summary.ofTarget value target} · {rynke.summary.missing n | rynke.summary.reached}</dd>
    <dt>{rynke.team}</dt><dd>…</dd>
    <dt>{rynke.withoutVirtual}</dt><dd>…</dd>   <!-- only with a virtual ride (FR-012) -->
  </dl>
</section>
```

- `rynke.summary.ofTarget` "{value} von {target}". With an unknown target
  (FR-013), `rynke.summary.valueOnly` "{value}" is used instead.
- The unmet-condition lines are `rynke.missing.training` {n},
  `rynke.missing.team` {n} and `rynke.missing.withoutVirtual` {n}, in that
  order (FR-011). Surplus Rynke are never mentioned.

## `section.rynke-gauges` (US2)

Absent when the balance's rules are unknown (FR-013). One `figure.gauge` each,
stacked: Training, Team, without virtual rides (only with a virtual ride), and
elevation.

```html
<figure class="gauge [gauge-reached]">
  <figcaption>{rynke.gauge.caption label value target percent} [· {rynke.gauge.reached}]</figcaption>
  <div class="gauge-bar" aria-hidden="true">
    <span class="gauge-part gauge-part-1" style="width:28.00%"></span>
    …                                  <!-- or one .gauge-fill span when undivided -->
  </div>
  <ul class="gauge-legend">            <!-- only when divided -->
    <li><span class="gauge-key gauge-part-1" aria-hidden="true"></span>{rynke.source.distance}: 70</li>
    …
  </ul>
</figure>
```

- `percent` follows research R7: rounded down, capped at 100, and
  `gauge-reached` exactly when 100.
- The elevation gauge's caption is `rynke.gauge.elevation` {value} {target}
  {percent} {missing} {stepRynke}, in metres.
- The order of parts is distance, elevation, team training, training-weekend
  day, technique training, corrections. Parts of 0 are omitted. Before US3b,
  only distance and elevation exist, and the Team gauge is undivided
  (research R5).

## `section.rynke-breakdown` (US3)

```html
<section class="rynke-breakdown">
  <h2>{rynke.breakdown.heading}</h2>
  <dl>
    <dt>{rynke.source.distance}</dt><dd>{n} {rynke.training}</dd>
    <dt>{rynke.source.elevation}</dt><dd>{rynke.breakdown.elevation metres rynke toNext stepRynke}</dd>
    <!-- US3b: one dt/dd per kind: {rynke.breakdown.kind count team training} -->
    <!-- US3b: corrections: {rynke.breakdown.corrections training team} (signed) -->
    <dt>{rynke.breakdown.total}</dt><dd>{training} {rynke.training} · {team} {rynke.team}</dd>
  </dl>
  <!-- US3b: <p>{rynke.breakdown.neverBelowZero}</p> when clamped -->
  <!-- US3b: <h3>{rynke.events.heading}</h3><ul>…date · kind · name [· not counting]…</ul> or {rynke.events.none} -->
  <!-- US3b: <h3>{rynke.corrections.heading}</h3><ul>…date · ±training · ±team · reason…</ul> or {rynke.corrections.none} -->
</section>
```

## `section.rynke-rules` (US6)

- `rynke.rules.version` {version} {date}
- `rynke.rules.window` {start}, or `rynke.rules.windowDeadline` {start} {deadline}
- `<a class="tap" href="{RULES_HANDOUT_URL}">{rynke.rules.handout}</a>`. The
  English text says that the handout is in German (FR-053).

## `section#rides` (US1, US4, US5)

```html
<section id="rides">
  <h2>{me.recent.heading}</h2>    <!-- text changes with US5, messages.md -->
  <p class="rides-position">{rynke.rides.position from to total}</p>   <!-- US5, only with a pager -->
  <table class="rides">
    <thead><tr>
      <th>{me.recent.col.date}</th><th>{me.recent.col.distance}</th>
      <th>{rynke.rides.col.status}</th><th>{rynke.training}</th><th>{rynke.rides.col.elevationTotal}</th>
    </tr></thead>
    <tbody>
      <tr class="ride ride-counting | ride-not-counting | ride-pending">
        <td>06.10.2026</td><td class="num">79,0 km</td>
        <td>{rynke.ride.counts | rynke.ride.doesNotCount | rynke.ride.beingEvaluated}</td>
        <td class="num">7</td><td class="num">1.240 m</td>
      </tr>
      <tr class="ride-details"><td colspan="5">
        {sport.*} · {units.m gain} [· {rynke.ride.virtual}]          <!-- US1 -->
        <ul class="ride-reasons">…{rynke.reason.*}…</ul>            <!-- US4 -->
        <p>{rynke.unknown.*} {rynke.unknown.mayChange}</p>          <!-- US4 -->
        <p>{rynke.ride.fixHint}</p>                                  <!-- US4 -->
      </td></tr>
    </tbody>
  </table>
  <nav class="pager" aria-label="{rynke.pager.label}">               <!-- US5, only with > 20 rides -->
    <a class="tap" href="/me?page=1#rides" rel="first">{rynke.pager.first}</a>
    <a class="tap" href="/me?page=1#rides" rel="prev">{rynke.pager.previous}</a>
    <a class="tap" href="/me?page=3#rides" rel="next">{rynke.pager.next}</a>
    <a class="tap" href="/me?page=3#rides" rel="last">{rynke.pager.last}</a>
  </nav>
</section>
```

- The main row is date, distance, status, Training Rynke and metres for the
  elevation total. Everything else is in the detail row, and nothing is dropped
  on a phone (FR-071, research R9).
- A ride being evaluated shows `–` in both number cells, never 0 (FR-041).
- A ride that doesn't count shows `0` and `0 m` (US1 scenario 7).
- There is no elevation Rynke per ride, anywhere (FR-040).
- With no stored rides, the section shows `me.recent.empty` instead of the
  table, as today.
- Before US4, the detail row has only sport type, elevation gain and the virtual
  mark. Before US5, there is no position and no pager, and the table holds the
  20 newest rides.

## CSS (research R9, R10)

Added to `STYLE` in `src/http/html.ts`, scoped to the classes above:

- `:root` custom properties `--rp-part-1` … `--rp-part-6`, `--rp-reached` and
  `--rp-track`.
- `.gauge-bar`: full width, about 1rem high, `--rp-track` background, with
  parts as inline blocks and a 2 px white gap between parts.
- `.tap`: `display:inline-flex; align-items:center; min-height:44px;
  min-width:44px`.
- `table.rides`: `width:100%`, number cells `white-space:nowrap;
  text-align:right`. `tr.ride-details td` has smaller, muted text and wraps.
- `main { overflow-wrap:anywhere }`.
- `@media (max-width:36rem)`: tighter cell padding and the pager wraps. Nothing
  scrolls sideways at 360 px (FR-070).
