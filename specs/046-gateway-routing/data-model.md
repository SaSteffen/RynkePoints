# Data Model: Gateway Routing

## Gateway: the `RoutingCopy` object (SQLite, EU jurisdiction)

One instance, `copy`. Tables created by the object itself (`CREATE TABLE IF NOT EXISTS`).

| Table | Columns | Notes |
|---|---|---|
| `copy` | `athlete_id TEXT`, `team TEXT`, primary key both | An athlete is in it only while some team lists them (FR-010, FR-011) |
| `lists` | `team TEXT` primary key, `listed_at INTEGER` (epoch s) | The team's last full list; routing while `listed_at ≥ now − 48 h` (FR-007) |
| `counts` | `day TEXT`, `team TEXT`, `figure TEXT`, `count INTEGER`, primary key the first three | `team` is `""` for the gateway's own figures. Counts only (FR-026) |

Nothing else: no names, dates of joining, guest or rider status (FR-010).

### Figures

| Figure | Team | Counted by | When |
|---|---|---|---|
| `copy` | `""` | gateway | an event whose athlete the copy lists (trial and on) |
| `everyone` | `""` | gateway | an event sent to every team because the copy listed none or couldn't be read |
| `allRouting` | `""` | gateway | an event that arrived while every team was routing |
| `allRoutingEveryone` | `""` | gateway | of those, sent to every team |
| `added`, `removed` | team | gateway | entries a full list added to or removed from the team's part |
| `possible` | team | gateway | of `added`, athletes the copy listed under other teams only |
| `missed` | team | team | would-be miss: held, came marked not chosen (trial) |
| `wasted` | team | team | would-be wasted: not held, came marked chosen (trial) |
| `dropped` | team | team | not held, dropped (every mode) |
| `found` | team | team | activities the re-check stored that weren't stored before |

The four team figures reach the gateway with the team's hourly exchange and replace what it held
for that team and day.

### Transitions

- **Report held**: insert (athlete, team), if missing.
- **Report not held**: delete (athlete, team).
- **Full list**: in one transaction, diff against the team's entries; count `added`, `removed`,
  `possible`; replace the team's entries; set `lists.listed_at`; delete entries, list dates and
  counts of teams not in `TEAMS`; delete counts older than 30 days.
- **Off mode full list**: delete every `copy` and `lists` row.

## Team: D1 `routing_daily` (migration `0039_routing_daily.sql`, additions only)

| Column | Type | Notes |
|---|---|---|
| `day` | TEXT, `YYYY-MM-DD` (UTC) | |
| `team` | TEXT | a team ID, or `""` for the gateway's figures |
| `figure` | TEXT | one of the figures above |
| `count` | INTEGER ≥ 0 | |

Primary key (`day`, `team`, `figure`), without rowid. Own team-side figures are incremented
locally; everything else is upserted from the gateway's exchange. Pruned daily to 30 days. No
rider identifiers and no relation to `riders`.

## Team: queue messages

- New: `{ kind: "report-hold", athleteId }` (contracts/team-side.md).
- `activity-event` and `delete-rider` gain an optional `route`: `plain`, `chosen` or `not-chosen`,
  set by the webhook only, read only for the counts, never serialized.
