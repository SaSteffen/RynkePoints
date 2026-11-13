#!/usr/bin/env sh
# Serves the repo on localhost so the seasonal monkeys' overview page
# (specs/035-seasonal-monkeys/drafts/seasonal-monkeys.html) can read
# monkeys.json, the pictures and the teams' holidays. Stop it with Ctrl+C.
set -eu
cd "$(dirname "$0")/.."
PORT=8000
echo "Seasonal monkeys: http://localhost:$PORT/specs/035-seasonal-monkeys/drafts/seasonal-monkeys.html"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
