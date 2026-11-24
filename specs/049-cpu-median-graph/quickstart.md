# Quickstart: CPU Median Over the Season

How to see that the feature works. Tests come first per story (constitution V).

## Tests

```bash
pnpm test test/unit/usage-cpu.test.ts             # median parsed, owner max, week slots, season edges
pnpm test test/unit/charts.test.ts                # season lines: gaps, lone week, scale, limit line
pnpm test test/integration/admin-usage-cpu.test.ts # graph, empty season, table pair and header
pnpm test test/integration/usage-record.test.ts   # median stored, replaced, older days keep NULL
pnpm test test/unit/migrations.test.ts            # migration list
```

Expected:

- A Worker day with `cpuTimeP50` 1,400 µs is stored as 1400; two Workers of one
  team at 1.2 and 1.8 ms store 1.8 ms; an answer without `cpuTimeP50` reads as
  unavailable.
- A week with medians 1.1, 1.4, 2.0 ms has the value 2.0 ms; a week with no
  gateway median breaks the gateway line; nothing is drawn at zero.
- 1 September 2026 is a Tuesday: the first slot is 1–6 September, the last
  30–31 August 2027, 53 slots; on 24 November 2026 the current slot is the 13th
  (23–29 November) and the rest are empty.
- Medians up to 1.8 ms give a 2 ms scale and no limit line, with the "limit far
  above" line under the graph; a week at 11 ms gives a 20 ms scale with the
  limit line.
- No median in the season: the one-line empty state, the table as before.
- A cell reads "1,4 / 7,8 ms" over "0 von 1.234 abgebrochen"; a day without a
  median "– / 7,8 ms"; each owner's header says "Median / langsamste".
- A day recorded by the release before keeps its figures and a NULL median; the
  next recording of yesterday sets it.

## In fake mode

```bash
pnpm dev:hamburg
```

Sign in as Alex Admin at http://localhost:8789/_dev/, open Admin › Nutzung and
the Betrieb row "CPU-Zeit der Worker".

1. Compare with the design draft's boards at phone (390) and desktop (1280)
   width: three lines over the season, the gateway's gap week, the dotted today
   line, months along the bottom.
2. Hover (desktop) or tap (phone) a past week: the tip shows its dates and three
   values; a week to come shows no tip.
3. The table's cells show the pair and the header its meaning.

`pnpm test:e2e` covers the hover in Chromium (the CPU row's tip names the three
owners).

## The fill task, locally

With the migration applied to the local state (`pnpm wrangler d1 migrations
apply DB --local --env hamburg`) and some CPU rows whose median is NULL:

```bash
CLOUDFLARE_ANALYTICS_TOKEN=… CLOUDFLARE_ANALYTICS_ACCOUNT_ID=… \
  pnpm cpu:fill-median --team hamburg --local
```

1. Without `--team` or without `--local`/`--remote` it refuses and says what is
   missing.
2. It prints per owner the days filled and the days Cloudflare answered for;
   the rows' other figures are unchanged.
3. Run it again: 0 days filled for every owner.

## After the release

The maintainer runs the task once per team with `--remote`, after CI has
deployed the release (contracts/fill-task.md), then checks the graph on each
team's Admin › Nutzung.
