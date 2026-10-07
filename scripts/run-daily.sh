#!/usr/bin/env bash
# Starts the daily cron work now instead of waiting for 03:17 UTC
# (specs/007-manual-daily-run). The Worker answers at once and runs it in the
# background; its outcome shows in the Worker logs. Needs ADMIN_TOKEN in the
# environment; RYNKE_URL picks another base URL, e.g. http://localhost:8787.
set -euo pipefail

if [[ -z "${ADMIN_TOKEN:-}" ]]; then
	echo "error: ADMIN_TOKEN is not set" >&2
	exit 1
fi

url="${RYNKE_URL:-https://trhh-rynke-coins.link}"

# The header comes from stdin so the token stays out of the process list.
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" |
	curl -sS --fail-with-body --max-time 30 -X POST -H @- \
		"$url/admin/run-daily" >/dev/null

echo "daily run started on $url"
