# Contract: `progressCharts()` in `public/app.js`

This is progressive enhancement (FR-052). If the script doesn't run or throws,
the section the server rendered stays as it is: the charts of the URL's period,
the period links and the table.

The function follows 010's rules for `app.js` (research R6):
- it holds no rider-facing text;
- it makes no network request;
- it writes no cookie or storage;
- it inserts values with `textContent` only.

## Start

When `#progress` and `#progress-data` exist, the script:
1. Parses the JSON (data-model.md "Chart data"). On a parse error it returns and
   leaves the section unchanged.
2. Adds the class `js` to the section, which shows the readout and the help and
   turns on `touch-action: pan-y` and the crosshair cursor on the plots.
3. Gives each `.progress-plot` the attributes `tabindex="0"`,
   `role="application"` and `aria-describedby="progress-help"`.
4. Selects the last day (`lastIndex`) and fills the readout.

## Period

- **State**: one shared state `{ from, to }` in day indexes, with `to − from ≥ 7`,
  `0 ≤ from` and `to ≤ axisDays`.
- **Applying a change**:
  1. Clamp the period, keeping its length where possible.
  2. Set `viewBox="{from} 0 {to − from} 100"` on both plots' SVGs.
  3. Re-lay the x labels (research R10).
  4. Update `aria-current` on the period links and each plot's `aria-label`. The
     label text comes from a `data-label-template` with slots, rendered by the
     server.
  5. Show `.progress-move` unless the period is the whole axis.
- **Period links**: on click, `preventDefault`, then apply `data-from`/`data-to`.
- **Inputs**: the gestures, wheel and keys of research R7.

## Selected day

- **On selection**: the crosshair line and the dot move to the day's x and value
  in both charts. The readout is rebuilt from `template[data-readout="day"]`, plus
  the US2 templates, with the slots filled from the values and `Intl`
  formatting.
- **Days after `lastIndex`** can't be selected. The selection snaps to the last
  day.

## Not done

The script does not:
- change the URL;
- fetch data;
- keep the period across page loads (FR-026);
- read or draw curves: the polylines are the server's.
