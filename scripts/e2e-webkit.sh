#!/usr/bin/env bash
# Serves Playwright's WebKit from its official Ubuntu image, for machines where
# it doesn't run natively (Arch). The image's version follows @playwright/test.
# In another terminal:
#   E2E_WEBKIT_SERVER=ws://127.0.0.1:3797/ pnpm test:e2e
# WebKit reaches the app on this machine's localhost (playwright.config.ts).
set -euo pipefail

version=$(node -p 'require("@playwright/test/package.json").version')

exec docker run --rm --init -p 127.0.0.1:3797:3797 \
	"mcr.microsoft.com/playwright:v${version}-noble" \
	npx -y "playwright@${version}" run-server --port 3797 --host 0.0.0.0
