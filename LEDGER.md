# Review ledger

Code review of everything merged into `develop` on 2026-11-19 (#368–#401). A row is
removed in the commit that fixes it; delete this file when it is empty.

Priority: **P1** can delete or hide a rider's data · **P2** wrong figures or text ·
**P3** older gap or minor.

| ID | Pri | Where | Problem | Fix |
|---|---|---|---|---|
| R04 | P1 | `src/work/delete-rider.ts` | Confirming a deauthorization with the stored refresh token loses a race with a concurrent refresh; the refused refresh deletes a rider who never withdrew. | On refused, re-read the credentials and retry once with the newer token before deleting. |
| R05 | P2 | `src/work/scheduled.ts` | The deadline record is taken right after the day's re-evaluations are queued, before they run, so it can hold stale totals. | Take it once no rider needs evaluation, or from a fresh evaluation. |
| R06 | P2 | `src/badges/evaluate.ts` | New Night owl / Early bird times and the solstice change don't reach existing riders: the badge catalog version wasn't raised. | Raise `BADGE_CATALOG_VERSION` and note why. |
| R07 | P2 | `src/i18n/messages/*` | Early bird says "before 6 am", Night owl "after 9:30 pm"; rides from 00:00 to 02:59 now earn Night owl. | Update both texts in all ten catalogs. |
| R08 | P2 | `src/rynke/tally.ts` | Corrections dated outside the qualification window still count in stored balances until the rider's next upload; the organiser overview already drops them. | Re-evaluate the riders affected. |
| R09 | P2 | `src/work/scheduled.ts` | Riders who must reconnect keep last season's rides in their summary: the season-start clean-up relies on an evaluation the consumer drops for them. | Accept `evaluate-rider` for them (needs no Strava), or evaluate inline. |
| R10 | P2 | `src/http/sections/team.ts` | With the Training ranking off, the Team page before the window shows everyone on 0 with no note, never the km chart, and shows the peloton to guests. | Wrap peloton and chart in the window note there too; use the km chart before the window. |
| R11 | P3 | `src/work/drain.ts` | Older: push notifications sent from a drain item don't count toward the per-run request limit; team badge news to many riders can exceed it. | Count push sends in the budget, or send notifications from their own queue message. |
| R12 | P3 | `src/recheck/diff.ts` | Older: rides older than the oldest listed are never checked, even when the list holds the rider's whole history. | When the list is shorter than a page, judge every stored ride. |
| R14 | P3 | `src/rynke/correction-change.ts` | Europe: a correction dated in autumn is refused as "outside the season"; it's before the qualification window. | Say "outside the qualification window" in both texts. |
| R15 | P3 | `public/sw.js` | A push shows no icon when its text can't be loaded. | Give the fallback the shared icons. |
