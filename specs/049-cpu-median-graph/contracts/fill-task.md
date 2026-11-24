# Contract: the one-time median fill task

A manual maintainer task (FR-015 to FR-017). Not imported by `src/`, not run by
CI or the hourly recording. Delete it once it has run on every team.

## Invocation

```bash
CLOUDFLARE_ANALYTICS_TOKEN=… CLOUDFLARE_ANALYTICS_ACCOUNT_ID=… \
  pnpm cpu:fill-median --team <hamburg|europe> (--local | --remote)
```

- `--team`: a team of `TEAMS`; its `wrangler.jsonc` env block names the
  database.
- `--local`: Wrangler's local state of that env (the one `pnpm dev:strava`
  uses). `--remote`: the team's production database, through the maintainer's
  Wrangler login. Exactly one of them.
- The token needs analytics read only; it is never printed.

Refusals (exit 2, one line, nothing read or written): no or unknown team,
neither or both of `--local`/`--remote`, missing token or account ID. A database
without the `cpu_p50_us` column: "the release adding the median isn't applied
to this database yet", exit 1, nothing written.

## What it does

1. Reads the rows of the current season (1 Sep to yesterday, UTC) whose
   `cpu_p50_us` is NULL.
2. Asks Cloudflare for each of those days, one day per request, and keeps
   each owner's highest median of its Workers (the hourly recording's rule).
3. For each row that got a value:

   ```sql
   UPDATE usage_cpu_daily SET cpu_p50_us = ?
   WHERE day = ? AND owner = ? AND cpu_p50_us IS NULL;
   ```

   Never inserts a row, never touches another column or a median already set.

## Output

```text
hamburg (remote): 41 days without a median, Cloudflare answered 2026-11-02 … 2026-11-23
  hamburg  22 days filled
  europe   19 days filled
  shared   22 days filled
```

A second run prints 0 days for every owner and changes nothing.
