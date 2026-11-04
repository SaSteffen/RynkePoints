# Contract: `organiserGraphs(signal)` in `public/app.js`

Runs from `enhance` when `#organiser-graphs` exists. It stops with `signal`, as `progressCharts` does.

## Graphs

- One Chart.js line chart per measure, sharing one x range. Below 1100 px only the chosen tab's chart exists.
- Kilometres are shown from metres, metres from decimetres. Values: one decimal under 100 km, otherwise whole.
- Running total: adds up from zero at the start of `from`, so the first point is that day's value. Per day: the day's value, 0 without rides.
- Legend per graph: each line's range sum, or the hovered or tapped day's value.

## Range

- Presets, date boxes and gestures all write `from` and `to`, then redraw all graphs and update the boxes.
- `min` and `max` on the date boxes are `firstDay` and `lastDay`. A From past To moves To, and the reverse.
- Gestures are the rider charts', from one shared helper (research R4). Touch: pinch zooms, sideways drag moves
  the period, tap selects a day, vertical swipes scroll the page. Mouse: drag selects a stretch, wheel zooms when
  focused, shift-drag moves, hover selects a day. A preset resets the zoom to its range.
- A preset is marked only when the range equals it. Below 1100 px the "Custom" pill shows the date boxes.

## Lines

- Selection starts from the group. For `group: null`: all agreed riders from 1100 px, `status === "push"` below.
- The panel: search filters names as typed. A checkbox applies at once. "Clear all" empties riders and team
  lines. "Done", click outside and Escape close it. Focus returns to the dropdown button.
- More than 8 riders: rider lines thin and grey. Legend: team lines first, then riders by range sum, descending,
  in a scrolling box. Up to 8: selection order, colours from the tokens.
- Hover (fine pointer) or tap on a legend entry highlights the line and fades the others. Tap again clears.
- The summary label and note come from templates with counts.
- `agreedCount === 0`: no rider or team lines, and the "still being asked" note.

## Narrow Riders view

- The switch sets `data-view` on `.team-overview`, and CSS shows the parts.
- Search matches `data-name` across all rows, ignoring the group. An empty search returns to the group. A tile
  click clears it through the swap.
- Rows are expanded when 5 or fewer show, and collapsed otherwise, after each change of what shows.
- "Riders (N)" uses the group's count.

## Not done

Nothing is saved to storage, and no request is made beyond the page swap.
