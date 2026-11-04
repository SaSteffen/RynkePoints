# Quickstart: Validating the Admin View

## Automated

```bash
pnpm test && pnpm lint && pnpm typecheck
```

Tests cover: access refusals, figures against synthetic usage, not attributed, levels, gaps,
repeat recording, alert once per level, the usage alerts switch, removal leaving only the block entry, a blocked rider's
connection refused with a revoke, and the overview's consent filter.

## Locally, with no real services

`pnpm dev`, sign in as the sample administrator, and open `/admin`.

1. Figures, percentages and marks match the seeded usage, and Cloudflare says "unavailable"
   only where the seed says so.
2. `/admin/history` shows a gap on the seeded empty day.
3. Remove a sample rider, then connect as that rider: refused at `/notice/blocked`.
4. As a sample rider without the flag, `/admin` gives the generic 403.
5. Turn usage alerts off on `/admin`: the switch stays off after a reload.

## Manual production steps, by the maintainer

1. Amend the constitution (research R9), which happens in the implementing change.
2. Create the read-only token and run `wrangler secret put CLOUDFLARE_ANALYTICS_TOKEN`.
3. Confirm the analytics fields (research R3).
4. Flag the administrator, as with organisers.
5. After release, check the live view, a real alert, and that existing riders see the new
   consent on their next visit.
