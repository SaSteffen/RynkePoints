# Quickstart: Dismiss Day Warnings

How to see the feature work. Each story starts red (Principle V).

## Tests

Run only the files this feature touches (the whole suite is CI's job):

```bash
pnpm vitest run test/unit/usage-attention.test.ts
pnpm vitest run test/integration/admin-usage-dismiss.test.ts
pnpm vitest run test/integration/admin-roles.test.ts
```

| Story | What the tests show |
|---|---|
| 1 Dismiss | With a routing warning yesterday, `POST /admin/dismiss` with its reasons answers `303 /admin`; the page then lists no such row, the head and the Admin tab's number drop by one, and the routing table still marks the day. As the only mark, the head reads "Alles im Rahmen" and the tab shows no number. |
| 2 Other admins | A second administrator still sees the row and counts it. |
| 3 New reason | Dismissed for `possible`, the day then also gets a would-be miss: the row is back with both reasons. Two possible misses instead of one: still dismissed. |
| 4 Limits | A figure at Warnung, a CPU mark and the state hints have no `/admin/dismiss` form. |
| Guard | Not an administrator, another origin: `403`, nothing stored. Unknown kind, a day before yesterday, unknown reasons: nothing stored. Twice: one row per reason. |
| Clean-up | The daily prune drops days before yesterday; making an administrator an organiser drops their dismissals; deleting the rider does too. |

## By hand

Checked on the live site after the release (no task for it): open Admin › Nutzung with a day
warning, press **Gesehen**, see the row go and the Admin tab's number drop, reload, open the day
table and find its mark.
