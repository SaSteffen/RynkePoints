import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests: the app in fake mode (synthetic riders, no request
// leaves the machine) in Chromium, Firefox and WebKit. Its own port and state
// directory, so a running `pnpm dev` and its data stay untouched. HTTPS with
// Wrangler's self-signed certificate, because Linux WebKit drops the app's
// `Secure` cookies over plain http://localhost.

const PORT = 8797;
/** Team Europe's smoke test server (feature 026 T057), Chromium only. */
const EUROPE_PORT = 8798;
const EUROPE_SMOKE = "europe-smoke.e2e.ts";
const CI = Boolean(process.env.CI);
/**
 * WebKit served by `scripts/e2e-webkit.sh`, where it can't run here (Arch). It
 * reaches the app through this machine's localhost.
 */
const REMOTE = process.env.E2E_WEBKIT_SERVER;

export default defineConfig({
	testDir: "e2e",
	testMatch: "*.e2e.ts",
	fullyParallel: true,
	forbidOnly: CI,
	retries: CI ? 1 : 0,
	reporter: CI ? [["github"], ["list"]] : "list",
	use: {
		baseURL: `https://localhost:${PORT}`,
		ignoreHTTPSErrors: true,
		locale: "de-DE",
		colorScheme: "light",
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			testIgnore: EUROPE_SMOKE,
			use: {
				...devices["Desktop Chrome"],
				// ignoreHTTPSErrors doesn't cover the service worker's script.
				launchOptions: { args: ["--ignore-certificate-errors"] },
			},
		},
		{
			name: "firefox",
			testIgnore: EUROPE_SMOKE,
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit",
			testIgnore: EUROPE_SMOKE,
			use: {
				...devices["Desktop Safari"],
				connectOptions: REMOTE
					? { wsEndpoint: REMOTE, exposeNetwork: "<loopback>" }
					: undefined,
			},
		},
		{
			// Europe on its own host, so its cookies stay apart from Hamburg's;
			// a browser locale the app doesn't ship, for "English by default".
			name: "europe-smoke",
			testMatch: EUROPE_SMOKE,
			use: {
				...devices["Desktop Chrome"],
				baseURL: `https://europe.localhost:${EUROPE_PORT}`,
				locale: "es-ES",
				launchOptions: { args: ["--ignore-certificate-errors"] },
			},
		},
	],
	webServer: [
		{
			command: "pnpm test:e2e:server",
			url: `https://localhost:${PORT}/health`,
			ignoreHTTPSErrors: true,
			reuseExistingServer: !CI,
			timeout: 120_000,
			env: { WRANGLER_SEND_METRICS: "false" },
		},
		{
			command: "pnpm test:e2e:server:europe",
			// localhost: Node may not resolve *.localhost; fake mode answers both.
			url: `https://localhost:${EUROPE_PORT}/health`,
			ignoreHTTPSErrors: true,
			reuseExistingServer: !CI,
			timeout: 120_000,
			env: { WRANGLER_SEND_METRICS: "false" },
		},
	],
});
