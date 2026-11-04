# Cloudflare Analytics

`POST https://api.cloudflare.com/client/v4/graphql`, once per hourly run, with
`Authorization: Bearer <CLOUDFLARE_ANALYTICS_TOKEN>`.

| Allowance | Dataset | Field | Grouped by |
|---|---|---|---|
| `cf_worker_requests` | `workersInvocationsAdaptive` | `sum.requests` | `scriptName` |
| `cf_queue_operations` | `queueMessageOperationsAdaptiveGroups` | `sum.billableOperations` | `queueID` |
| `cf_d1_rows_read`, `cf_d1_rows_written` | `d1AnalyticsAdaptiveGroups` | `sum.rowsRead`, `sum.rowsWritten` | `databaseId` |
| `cf_d1_storage_bytes` | `d1StorageAdaptiveGroups` | `max.databaseSizeBytes`, latest day | `databaseId` |

Each is filtered by `accountTag` and yesterday and today (UTC), and summed per day.

**Settings**: `CLOUDFLARE_ANALYTICS_ACCOUNT_ID` and the token, both as secrets. The repository
keeps the account ID out of its files today (CI has it as a variable), and the name differs from
Wrangler's own `CLOUDFLARE_ACCOUNT_ID`. The token has only Account Analytics Read and is created
by hand. Neither is in `secrets.required`: without them, Cloudflare counts as unavailable.

**Failure** (network, non-2xx, `errors` in the body, or an unexpected shape): nothing is
overwritten, `last_failure_at` is set, and the Strava part of the run continues. Responses
hold no rider data, and the token is never logged.

**To confirm by introspection before use**: see research R3.
