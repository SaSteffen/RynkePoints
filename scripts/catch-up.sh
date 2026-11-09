#!/usr/bin/env bash
# Re-reads every connected rider's rides since a moment (feature 026 FR-011,
# docs/gateway-switch.md), for events Strava never sent, e.g. while the webhook
# subscription moved. The Worker only queues the work; its outcome shows in the
# Worker logs. Needs ADMIN_TOKEN in the environment; RYNKE_URL picks another
# base URL, e.g. http://localhost:8789.
#
#   pnpm catch-up 1793000000                  # epoch seconds
#   pnpm catch-up "2026-11-20 10:00 UTC"      # anything `date -d` reads
set -euo pipefail

if [[ -z "${ADMIN_TOKEN:-}" ]]; then
	echo "error: ADMIN_TOKEN is not set" >&2
	exit 1
fi
if [[ $# -ne 1 ]]; then
	echo "usage: pnpm catch-up <since: epoch seconds or a date>" >&2
	exit 1
fi

since="$1"
if [[ ! "$since" =~ ^[0-9]+$ ]]; then
	since=$(date -d "$since" +%s)
fi
url="${RYNKE_URL:-https://trhh-rynke-coins.link}"

# The header comes from stdin so the token stays out of the process list.
answer=$(printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" |
	curl -sS --fail-with-body --max-time 30 -X POST -H @- \
		"$url/admin/catch-up?since=$since")

echo "$answer on $url since $(date -u -d "@$since" '+%Y-%m-%d %H:%M UTC')"
