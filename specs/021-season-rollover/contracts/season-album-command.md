# Contract: `pnpm season:album`

The maintainer's command that makes the season albums (spec US3, FR-020–FR-027,
FR-034, FR-057). `package.json`: `"season:album": "node scripts/season-album.mjs"`.

## Usage

```bash
pnpm season:album [--cutoff YYYY-MM-DD] [--local] [--rider <athleteId>]
```

| Option | Default | Meaning |
|--------|---------|---------|
| `--cutoff` | today in Europe/Berlin | Every figure, badge and event as of this date (FR-023). |
| `--local` | off | Read `pnpm dev`'s synthetic sample season (`.wrangler/fake-state`) instead of production. For trying it out and for the quickstart. |
| `--rider` | all listed riders | Make only this rider's album (to check one before making all). |

Without `--local` the command reads production through Wrangler's login (the
maintainer's `wrangler login`); it is a manual maintainer step, like
`pnpm strava:review --remote`.

## Preconditions (checked first; the command stops with a message and exit code 2)

1. `season-albums/` is ignored by git (`git check-ignore`) (FR-025).
2. Chromium for Playwright is installed (`pnpm exec playwright install
   chromium`); if not, the message gives that command.
3. The cut-off date is a calendar date, not after today, and not before
   `SEASON_START_DATE` (FR-024: the season start already moved).

## Steps

1. Start the album Worker: `wrangler dev -c album/wrangler.jsonc --ip 127.0.0.1
   --port 8798` plus `--var SEASON_START_DATE:… --var QUALIFICATION_DEADLINE:…`
   from the root `wrangler.jsonc` (and `--local --persist-to .wrangler/fake-state`
   with `--local`). Wait until it answers.
2. `GET /riders?cutoff=…` → the listed riders (FR-022).
3. For each rider: open `/album/<athleteId>?cutoff=…` in one Chromium page, wait
   for network idle and `document.fonts.ready`, print with
   `preferCSSPageSize: true, printBackground: true` to
   `season-albums/<season>/<file>.pdf`.
4. Check each PDF (R14): A4 MediaBox within 0.5 mm on every page, even page
   count, no image XObject, every font embedded.
5. Stop the album Worker and the browser, also on failure or Ctrl-C.

## Output

```text
Season 2026/27, cut-off 2026-08-31, production (read-only)
14 albums written to season-albums/2026-27/ (98 MB)
Print check: 14 of 14 passed
Delete season-albums/ once every rider has their album.
```

- When `season-albums/` already holds albums from an earlier run, the first line
  after the header says so with their age ("3 albums from 12 days ago are still
  in season-albums/") (FR-034).
- An album failing the print check is listed with the reason ("ben-1.pdf: page 4
  holds an image").

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | All albums written and passed the print check. |
| 1 | At least one album failed the print check (all others are written). |
| 2 | A precondition failed; nothing written. |
| 3 | The album Worker or the browser failed; albums written so far stay. |

## Guarantees

- No write to D1 (the Worker's read-only guard), no Strava request, no
  notification (FR-021).
- Never uploads anything and never deletes anything (FR-020; the owner deletes
  the folder by hand).
- Same data and cut-off → the same albums (FR-026).
