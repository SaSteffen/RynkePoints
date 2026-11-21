# Quickstart: One Team at a Time

**Feature**: [spec.md](spec.md) | **Contract**: [contracts/one-team.md](contracts/one-team.md)

## 1. Tests

```bash
pnpm exec vitest run test/integration/one-team.test.ts test/integration/let-go.test.ts \
  test/integration/held.test.ts test/gateway/held.test.ts test/gateway/let-go.test.ts
```

| Scenario | Expected |
|---|---|
| New person, another team holds them as a rider, no switch flag | redirected to `/switch-team`; no `riders` row; nothing revoked |
| The same with the switch flag | the gateway is asked to let go; the person is stored and signed in; the import starts |
| Let-go fails | `/notice/strava-busy`; no row; nothing revoked |
| Team question unanswered | `/notice/strava-busy`; no row |
| Another team holds them only as a guest | stored and signed in, no choice |
| A guest at this team who rides elsewhere | stored as a guest, no choice |
| Team endpoint `let-go` for a rider / a guest / nobody | row deleted / kept / nothing; `200` each time |
| Gateway `let-go` with every team `200` / one failing | `200` / `503` |
| Gateway `held` with one team answering `rider: true` | `rider: true`; answers without `rider` count as false |
| Kept token from the first pass, then a switch | dropped when the rider is stored, never revoked |
| `/switch-team` | names no other team; the form posts `consent` and `switch=1` to `/connect` |
| `/connect` with `switch=1` | authorize URL with `approval_prompt=auto`; switch flag in the state cookie |

## 2. Team data

```bash
node scripts/team-check.mjs   # passes without otherClubIds
```

## 3. After the release (live sites, by hand)

With a Strava account that is in two teams' clubs and rides for one of them: connect on the other
team's site. The choice page appears. **Stay** leaves everything as it was at the first team.
**Switch** returns to the second team's site signed in, with the season's rides importing, and the
first team's site no longer knows the person. RynkePoints stays in the account's Strava settings
throughout.
