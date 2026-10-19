# Contract: `progressCharts()` in `public/app.js`

The app requires JavaScript (constitution v2.2.0). The function draws the charts
with the vendored Chart.js and its zoom plugin (research R4, R6) and follows 010's
rules for `app.js` (research R6):
- it holds no rider-facing text;
- it makes no network request;
- it writes no cookie or storage;
- it inserts values with `textContent` only.

## Start

When `#progress` and `#progress-data` exist, the script:
1. Checks for `window.Chart`. Without it (the vendor files failed to load) it logs
   one `console.error` and returns; the table still has the figures.
2. Registers the zoom plugin (`Chart.register(window.ChartZoom)`) and its own
   crosshair plugin.
3. Parses the JSON (data-model.md "Chart data"). On a parse error it logs and
   returns.
4. Reads the colour tokens and the font from the computed style (research R12).
5. Creates one chart per `canvas[data-series]` with:
   - `type: "line"`, `animation: false`, `responsive: true`,
     `maintainAspectRatio: false`;
   - x: `type: "linear"`, `min: 0`, `max: axisDays`, ticks from research R10;
   - y: `min: 0`, `max: yMax`;
   - datasets: the curve (`values` as `{x: i, y}`), the threshold, and from US2
     the pace and outdoor lines; `pointRadius: 0`, `pointHoverRadius: 4`, 2 px
     surface ring;
   - `interaction: { mode: "index", intersect: false, axis: "x" }`, with
     `events: []`: Chart.js's own hover is off, as the selected day is set by
     the pointer handlers and keys below;
   - `plugins.legend` and `plugins.tooltip` off;
   - `plugins.zoom` as in research R7: `limits.x = { min: 0, max: axisDays,
     minRange: 7 }`; wheel and drag on, pinch off, `mode: "x"`; pan
     `{ enabled: true, modifierKey: "shift" }` only so that drag-zoom ignores a
     shift-drag; `onZoomStart` refuses a wheel on an unfocused canvas;
     `onZoomComplete` calls `applyPeriod`.
6. Adds the pointer handlers of "Gestures" to each canvas.
7. Selects the last day (`lastIndex`) and fills the readout.
8. Destroys the charts and drops its listeners when the content is replaced
   (the `signal` of `enhance`).

**Swapped in place**: when an Overview arrives through `swapPage` (the waiting
state turning into the first data, a refresh on return), the page may not have
loaded the vendor scripts yet. `swapPage` loads the new page's head scripts that
this page lacks, in order, before it runs `enhance`.

`window.Hammer` is never loaded, so the plugin sets no gesture handlers and no
`touch-action` of its own.

## Gestures (research R7, FR-022, FR-023, FR-025)

Pointer Events on each canvas; the canvas's `touch-action: pan-y` comes from the
stylesheet.
- **`pointerdown`**: a touch or pen pointer, or the mouse's main button with
  Shift, is recorded with its x and y and captured (`setPointerCapture`).
- **`pointermove`**, one pointer: once it has moved 8 px sideways,
  `chart.pan({ x: dx }, undefined, "none")` by the change since the last move.
- **`pointermove`**, two pointers: `chart.zoom({ x: d / dLast, focalPoint:
  midpoint }, "none")`, `d` the distance between them.
- **`pointerup`, `pointercancel`**: the pointer is forgotten. When none is left
  after a pan or zoom, `applyPeriod` with the chart's x `min`/`max`.
- A pointer that starts on the chart doesn't select a day while it pans or
  zooms.

## Period

- **State**: the charts' x scale `min`/`max`, equal in both, with
  `max − min ≥ 7`, `0 ≤ min` and `max ≤ axisDays`.
- **`applyPeriod(from, to)`**:
  1. Sets the other chart (or both, for a button) with
     `zoomScale("x", { min: from, max: to }, "none")`. A guard stops the echo
     from the other chart's callback.
  2. Sets `aria-pressed` on the period buttons: `true` only on the one whose
     `data-from`/`data-to` equal the period.
  3. Refills each canvas's `aria-label` from its `template[data-label]`.
- **Period buttons**: apply their `data-from`/`data-to`; "Ganze Saison" is the
  reset. There are no move buttons: moving is a sideways drag, Shift-drag or
  the keys.
- **Keys** on a focused canvas: research R7.

## Selected day

- **Mouse over a chart, a click, a tap or ←/→**: the active index is set on both charts
  (`setActiveElements`), the crosshair plugin draws the hairline, and the readout
  is rebuilt from `template[data-readout="day"]` (plus the US2 templates), with
  the slots filled from the values and `Intl` formatting.
- **Days after `lastIndex`** can't be selected. The selection snaps to the last
  day.

## Colours

On a `prefers-color-scheme` change, or a change of `data-scheme` on `<html>`, the
script reads the tokens again and calls `chart.update("none")` (research R12).

## Not done

The script does not:
- change the URL;
- fetch data;
- keep the period across page loads (FR-026);
- compute curves: the values are the server's.
