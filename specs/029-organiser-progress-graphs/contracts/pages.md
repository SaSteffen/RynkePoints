# Contract: `/organiser/riders`

The look, helper texts and interactions follow the
[design draft](https://claude.ai/artifact/CS7cXRCBrwevDxRBJudfH2). Read it before styling (colours, radii,
spacing, the Progress section's card). This contract fixes order, states and what is sent.

## When the section exists

| `ORGANISER_PROGRESS_GRAPH` | `ORGANISER_FIGURES` | Example team (tour) | Progress section | Daily reads | Chart script |
| --- | --- | --- | --- | --- | --- |
| on | full | no | yes | yes | yes |
| on | percent | no | no | no | no |
| off | any | no | no | no | no |
| any | any | yes | no | no | no |

No listed riders: as today, no section.

## Query

- `group`: as today.
- `view=riders`: below 1100 px, opens the Riders view. Any other value is ignored.

## Order from 1100 px

1. Riders/Events switch, heading, deadline hero, tiles
2. Pace hint
3. Rider table in a box with its own scroll (`max-height: 560px`), sticky header
4. Progress section
5. "Training goal reached"

No reports box, no Graphs/Riders switch, no search above the table.

## Order below 1100 px

1. Riders/Events switch, heading, deadline hero, tiles
2. Open reports box, when any: heading with count, up to 3 lines with Add and Decline, "Show all N"
3. Graphs / Riders (N) switch, only with the section. N counts the group's riders.
4. Graphs view: Progress section. Riders view: pace hint, search, rows, "Training goal reached".

Without the section, item 4's Riders view shows directly.

## Rows below 1100 px

```html
<input type="search" data-rider-search aria-label="…">
<ul class="rider-rows">
  <li class="rider-row status-push" data-name="anna" [hidden]>
    <details [open]>
      <summary>status dot, name, report mark, Training and Team mini bars</summary>
      today's card content, full or percent
    </details>
  </li>
</ul>
```

All listed riders are rendered. Those outside the group carry `hidden`.

## Progress section

```html
<section id="organiser-graphs" aria-labelledby="…" data-locale="…">
  <h2>Progress</h2>
  controls: "Shown in the graphs" dropdown, date boxes, presets, Running total / Per day
  <p> drag hint </p>
  <p data-graphs-note> group's riders without a line </p>
  <div role="group"> Outdoor, Virtual, Elevation tabs (narrow only) </div>
  <figure> × 3: <figcaption>, <canvas role="img">, legend </figure>
  <template>s for each sentence the script fills
  <script type="application/json" id="organiser-graphs-data">…</script>
</section>
```

Every word comes from the catalogs. The script fills `data-slot` spans in templates only, as feature 009 does.
The not-agreed names are rendered by the server into the panel, without checkboxes.

## What must never be in the response

- Any daily value of a rider below version 3, or of anyone when the section is off.
- Ride names, IDs, start times, speeds, durations or routes, in the section's markup or data.
