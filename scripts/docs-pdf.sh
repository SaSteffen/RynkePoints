#!/usr/bin/env bash
# Renders each team's rules handout to the PDF its team data links to
# (feature 026 FR-022): the founding team's German docs/rynke-punkte.md to
# public/rynke-punkte.pdf, Europe's English docs/teams/europe/rynke-points.md to
# public/teams/europe/rynke-points.pdf. pandoc turns each into a standalone HTML
# page, and a headless Chrome/Chromium prints that page to PDF. The PDFs are
# committed and the app serves them as static assets, so the rider page links to
# them. Neither tool is a project dependency, since this is a seldom-run
# organiser task. Set CHROME to the browser binary if it isn't found on the PATH.
set -euo pipefail

cd "$(dirname "$0")/.."

# Source and PDF per team, matching `rulesHandout` in src/teams/<id>.ts.
handouts=(
	"docs/rynke-punkte.md:public/rynke-punkte.pdf"
	"docs/teams/europe/rynke-points.md:public/teams/europe/rynke-points.pdf"
)

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

for handout in "${handouts[@]}"; do
	source="${handout%%:*}"
	pdf="${handout#*:}"

	pandoc "$source" \
		--standalone \
		--embed-resources \
		--css docs/print.css \
		--output "$html"

	mkdir -p "$(dirname "$pdf")"
	"$chrome" --headless --disable-gpu --no-pdf-header-footer \
		--print-to-pdf="$PWD/$pdf" "file://$html" 2>/dev/null

	echo "wrote $pdf"
done
