# Alerts

**Alerting allowances**: all `usage_daily` allowances. Never Strava's 15-minute figures.

**In the hourly run**, after recording, for each allowance and each level reached, highest
last:

1. `INSERT OR IGNORE` into `usage_alerts`.
2. If a row was inserted, call `notifyRiders` once with all administrators. If both levels are
   newly reached in one run, send one notification for 95 %.

An alert problem never fails recording, and recording failure sends nothing. Riders without
the flag are never included (FR-037).

**Text**: `GET /me/notification-text` first checks whether the signed-in rider is an
administrator and an alert was fired in the last 15 minutes. If so, it returns:

```json
{ "title": "<app name>", "body": "<allowance>: <percent> %", "url": "/admin" }
```

A critical alert has its own wording, so it doesn't rely on anything but text. Otherwise the
response is unchanged. There's no rider data in the text or the push (FR-036).
