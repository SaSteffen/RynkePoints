#!/usr/bin/env bash
# Serves Playwright's browsers from its official Ubuntu image, for machines
# where they don't run natively (WebKit on Arch, macOS without the libraries).
# The image's version follows @playwright/test. In another terminal:
#   PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:3000/ pnpm test:e2e
# The browsers reach the app on this machine's localhost (playwright.config.ts).
set -euo pipefail

version=$(node -p 'require("@playwright/test/package.json").version')

exec docker run --rm --init -p 127.0.0.1:3000:3000 \
	"mcr.microsoft.com/playwright:v${version}-noble" \
	npx -y "playwright@${version}" run-server --port 3000 --host 0.0.0.0
