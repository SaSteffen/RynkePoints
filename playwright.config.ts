import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests: the app in fake mode (synthetic riders, no request
// leaves the machine) in Chromium, Firefox and WebKit. Its own port and state
// directory, so a running `pnpm dev` and its data stay untouched.

const PORT = 8797;
const CI = Boolean(process.env.CI);
/** Browsers served by `scripts/e2e-browsers.sh`, when they can't run here. */
const REMOTE = process.env.PW_TEST_CONNECT_WS_ENDPOINT;

export default defineConfig({
	testDir: "e2e",
	testMatch: "*.e2e.ts",
	fullyParallel: true,
	forbidOnly: CI,
	retries: CI ? 1 : 0,
	reporter: CI ? [["github"], ["list"]] : "list",
	use: {
		baseURL: `http://localhost:${PORT}`,
		locale: "de-DE",
		colorScheme: "light",
		trace: "retain-on-failure",
		// The remote browsers reach the app through this machine's localhost.
		connectOptions: REMOTE
			? { wsEndpoint: REMOTE, exposeNetwork: "<loopback>" }
			: undefined,
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
		{ name: "webkit", use: { ...devices["Desktop Safari"] } },
	],
	webServer: {
		command: "pnpm test:e2e:server",
		url: `http://localhost:${PORT}/health`,
		reuseExistingServer: !CI,
		timeout: 120_000,
		env: { WRANGLER_SEND_METRICS: "false" },
	},
});
