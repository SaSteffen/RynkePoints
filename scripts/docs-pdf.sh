#!/usr/bin/env bash
# Renders the German rules handout (docs/rynke-punkte.md) to
# dist/rynke-punkte.pdf: pandoc turns it into a standalone HTML page, and a
# headless Chrome/Chromium prints that page to PDF. Neither tool is a project
# dependency, since this is a seldom-run organiser task. Set CHROME to the
# browser binary if it isn't found on the PATH.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v pandoc >/dev/null; then
	echo "error: pandoc not found" >&2
	exit 1
fi

chrome="${CHROME:-}"
if [[ -z "$chrome" ]]; then
	for candidate in google-chrome-stable google-chrome chromium chromium-browser; do
		if command -v "$candidate" >/dev/null; then
			chrome="$candidate"
			break
		fi
	done
fi
if [[ -z "$chrome" ]]; then
	echo "error: no Chrome or Chromium found; set CHROME to its binary" >&2
	exit 1
fi

html="$(mktemp --suffix=.html)"
trap 'rm -f "$html"' EXIT

pandoc docs/rynke-punkte.md \
	--standalone \
	--embed-resources \
	--css docs/print.css \
	--output "$html"

mkdir -p dist
"$chrome" --headless --disable-gpu --no-pdf-header-footer \
	--print-to-pdf="$PWD/dist/rynke-punkte.pdf" "file://$html" 2>/dev/null

echo "wrote dist/rynke-punkte.pdf"
