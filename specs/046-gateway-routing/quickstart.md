# Quickstart: Gateway Routing

## Tests

```bash
pnpm exec vitest run test/gateway/routing.test.ts test/gateway/team-routes.test.ts \
  test/unit/routing-choose.test.ts test/integration/routing-reports.test.ts \
  test/integration/routing-counts.test.ts test/integration/admin-usage-routing.test.ts
```

Expected: choosing (SC-001), every fallback (SC-002: unknown athlete, stale or missing list,
unreadable copy), reports and lists (SC-003), the trial's marks and counts, the exchange, the day
table and its warning mark.

## By hand, fake mode

1. `pnpm dev` (every team behind the local gateway, which runs with `ROUTING=on`).
2. No team has sent a full list: a simulated ride reaches every team (`[gateway] forward team=…`
   for each).
3. Trigger each team's daily run (`curl "http://localhost:8789/__scheduled?cron=17+3+*+*+*"`, and
   the same for Europe's port): each sends its full list.
4. Upload a simulated ride for a sample rider of one team: one `forward` line, for that team.
5. Connect a new sample rider: the team's report reaches the gateway within seconds; their next
   ride goes to that team only.
6. Admin › Usage › **Update now**: the "Gateway routing" section shows the day.

## Going live (maintainers)

Documented in `docs/gateway-switch.md` › Routing: set `ROUTING` to `trial` once the privacy notice
is live, watch 14 days without a would-be miss, move to the paid plan, set `on`.
