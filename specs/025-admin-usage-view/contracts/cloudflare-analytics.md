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

**Settings**: `CLOUDFLARE_ACCOUNT_ID` in `wrangler.jsonc`, and the token as a secret with only
Account Analytics Read, created by hand. It's optional in `secrets.required` terms: without
it, Cloudflare counts as unavailable.

**Failure** (network, non-2xx, `errors` in the body, or an unexpected shape): nothing is
overwritten, `last_failure_at` is set, and the Strava part of the run continues. Responses
hold no rider data, and the token is never logged.

**To confirm by introspection before use**: see research R3.
