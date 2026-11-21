# Data Model: Strava 64-bit IDs

No table, column or index changes (research R5).

## Athlete ID, Activity ID

| Where | Representation |
|---|---|
| D1 columns (`athlete_id`, `strava_activity_id`, `overlaps_activity_id`, and every other column holding one of them) | `INTEGER`, unchanged; written by binding the decimal string, read as `CAST(col AS TEXT)` |
| App, gateway, album, fake Strava | decimal string |
| Queue messages, parked Strava work, failed work | JSON string; a JSON number from the previous version is accepted (R6) |
| Session cookie | the digits, as before |
| Web addresses, forms, links to Strava | the digits, as before |
| `held` body between a team and the gateway | JSON number, exact (R3) |
| Arrays bound for `json_each` | JSON numbers, exact (R3) |

**Validation**: `^[1-9][0-9]{0,18}$` and at most 9223372036854775807. Anything else is not an ID:
a refused event, a dropped message, an unknown page, as today for invalid values.

**Order**: numeric: by length, then by text.
