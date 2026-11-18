# Quickstart: Season and Qualification Window

## Tests

```bash
pnpm vitest run test/unit/rides*.test.ts test/unit/rules*.test.ts   # before_window, overlap, window
pnpm vitest run test/teams                                          # Hamburg pages snapshot unchanged, badge lists
node scripts/team-check.mjs                                         # date rules pass; a broken block fails
```

Expected: Hamburg's pages snapshot and season snapshot have **no diff** (SC-001).

## Fake mode

```bash
pnpm dev     # Hamburg :8789, Europe europe.localhost:8790
```

1. Europe, fake day before 1 January (e.g. `RYNKE_FAKE_SEASON_DAY` for 18 November): reset sample
   data in `/_dev/`, connect a sample rider.
   - Rides from September on are listed; rides meeting every rule show the orange "zählt noch nicht"
     with "–" and the open reason "Die Qualifikation beginnt am 01.01.2027 …" (SC-002).
   - You page: status box with the pre-window text, 0 Rynke; no graph shows any ride (SC-003).
   - Badges page lists the November/December badges; a 24 December ride earns Christmas Eve
     (SC-004). Season end shows 31.08.2027 (SC-005).
2. Europe, a fake day after 1 January: countdown and plan sentence; new rides count; old ones stay
   orange.
3. Hamburg, same day: looks exactly as before.

## e2e

`pnpm test:e2e` — `europe-smoke` runs on its re-picked in-window day plus the pre-window check.
