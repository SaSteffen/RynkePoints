# Quickstart: Checking Stored Rider Summaries

## Automated

```bash
pnpm exec vitest run test/unit/rider-summary.test.ts \
  test/integration/rider-summaries.test.ts \
  test/integration/rider-summaries-parity.test.ts \
  test/integration/d1-rows.test.ts
pnpm test && pnpm lint && pnpm typecheck
```

| Check | Expected |
|---|---|
| Rows read with 40 riders | Within the limits in spec SC-001 |
| Twice the rides | Within spec SC-003 |
| Summaries against adding up | Equal (research R10) |
| No, some and all riders with a row | Same pages, each rider counted once |
| Rider removed or no longer listed | In no team figure on the next load |
| Unchanged evaluation | Writes nothing |
| All riders without a row | Costs no more than today |
| Round trips with all rows present | Unchanged |

## Locally

`pnpm dev`, open the Team page, Badges page and the organiser's rider list. They look as before.

## After release

On the Admin page, the rows read per day should fall, starting the day after the daily job has filled the rows. The first day still costs about what it does today.
