# Contract: Ride Evaluation (amends feature 003)

Amends [003 contracts/ride-evaluation.md](../../003-rynke-evaluation/contracts/ride-evaluation.md).

## New reason: `too_short`

| | |
|---|---|
| When | the rules in effect have `minRideKm`, and `distanceM < minRideKm × 1000` |
| Exact | metres against metres, no rounding: 24,999.9 m → `too_short`; 25,000.0 m → counts |
| Order in `REASON_CODES` | after `manual`, before `pause` |
| Checked | after flagged and manual, before the moving-time check, so a ride without moving time lists `too_short` and `pause` |
| With other reasons | listed with them, like every reason (US3 scenario 3: `too_short, too_slow`) |
| Overlap | a short ride isn't a candidate, so it never makes another ride `overlap` |
| Crop re-check | not in `FIXABLE_REASONS` (feature 036): a crop can't lengthen a ride |
| Fix hint | not in the rider page's fixable set (feature 005 FR-044) |

A ride that doesn't count adds nothing anywhere: Rynke, the virtual share, ride figures (feature
032), badges, team sums and team surprises all read counting rides only (feature 003, 013, 032).
Runs and swims are no rides and are unaffected.

Without `minRideKm` the code is never produced, so every result of a team without a minimum is the
same as before.

## Team Rynke in the balance

With `teamThreshold: null`, `teamMissing` is 0 and `qualified` is
`trainingMissing === 0 && virtualShareMissing === 0`. With a threshold, nothing changes.

## Rider page line

| Code | Figures | Text (contracts/messages.md) |
|---|---|---|
| `too_short` | distance in tenths of a km, rounded **down**; the version's `minRideKm` | `rynke.reason.too_short`, or `.noLimit` for an unknown version |

24.96 km shows as 24.9 km, never as 25.0 km next to "at least 25 km".
