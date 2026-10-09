# Data Model: Rider Page Cleanup

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

No migration and no new table. D1 is unchanged; what changes is how the rider's
pages read it and one value on the device.

## Rider view (changed, `src/http/rider-view.ts`)

| Before | After |
|---|---|
| `{ state: "not-worked-out"; importing; rides }` | `{ state: "waiting" }` |
| `{ state: "ready"; importing; updating; … }` | `{ state: "ready"; updating; … }` |
| `ViewContext.importing` | removed |

- `"waiting"` ⇔ no row in the rider's balance (`read.balance === null`) (R1).
- `"ready"` is unchanged apart from losing `importing`. `rides.rows` may be
  empty, and then Rides says `me.recent.none` (R3).

## Rider (unchanged, `riders.import_status`)

`pending` → `running` → `done` stays as the import and re-read workers' own
progress record. No rider-facing page reads it any more (R2).

## Prompt state (new, per device, `localStorage`)

| Key | Value | Set when | Read when |
|---|---|---|---|
| `rp-install-prompt` | `"done"` | the rider taps install or close on the install panel, or `appinstalled` fires | deciding whether to show the install panel |
| `rp-notify-offer` | `"done"` | the rider taps turn on, not now or close on the offer | deciding whether to show the offer |
| `rp-install-dismissed` | `"1"` (feature 010, legacy) | no longer written | never; removed on the first run, so it doesn't hold back the new prompt |

The values stay on the device. They are not rider data and are never sent
(spec Key Entities). If `localStorage` fails (some private modes), no prompt
shows, so the prompt can't come back on every page.

### Prompt panel transitions

```text
install panel: hidden ──(can install ∧ not standalone ∧ ¬rp-install-prompt)──▶ shown
shown ──install / close / appinstalled──▶ hidden, rp-install-prompt=done
shown ──navigate away untouched──▶ (shown again on the next page)

notify panel:  hidden ──(appinstalled ∨ standalone) ∧ ¬rp-notify-offer
                         ∧ push supported ∧ permission=default ∧ no subscription──▶ shown
shown ──turn on──▶ subscribe as Settings; hidden, rp-notify-offer=done
shown ──not now / close──▶ hidden, rp-notify-offer=done
```

At most one panel shows at a time; the install panel goes first.
