import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests: the app in fake mode (synthetic riders, no request
// leaves the machine) in Chromium, Firefox and WebKit. Its own port and state
// directory, so a running `pnpm dev` and its data stay untouched. HTTPS with
// Wrangler's self-signed certificate, because Linux WebKit drops the app's
// `Secure` cookies over plain http://localhost. Each server pretends a fixed
// day of its team's season (RYNKE_FAKE_SEASON_DAY in package.json,
// dev/clock.ts), so the sample riders' figures don't change with the real date
// (issue #301): Hamburg's 10 November 2026, Europe's 12 March 2027, 70 days
// into its qualification window, and Europe's second server 18 November 2026,
// before its window opens on 1 January (feature 040).

const PORT = 8797;
/** Team Europe's smoke test server (feature 026 T057), Chromium only. */
const EUROPE_PORT = 8798;
const EUROPE_SMOKE = "europe-smoke.e2e.ts";
/** Team Europe before its window opens (feature 040 FR-021), Chromium only. */
const EUROPE_EARLY_PORT = 8799;
const EUROPE_PRE_WINDOW = "europe-pre-window.e2e.ts";
/** The files only a Europe server runs. */
const EUROPE_ONLY = [EUROPE_SMOKE, EUROPE_PRE_WINDOW];
const CI = Boolean(process.env.CI);
/**
 * WebKit served by `scripts/e2e-webkit.sh`, where it can't run here (Arch). It
 * reaches the app through this machine's localhost.
 */
const REMOTE = process.env.E2E_WEBKIT_SERVER;
/**
 * Pull requests into develop (scripts/e2e-scope.mjs sets E2E_SCOPE=pr): Firefox
 * and WebKit run only the tests tagged @cross-browser and the e2e files the pull
 * request adds or changes (E2E_CHANGED, comma-separated). Unset, everything runs:
 * locally, nightly and on pull requests into main. Grep sees the file name in each
 * test's title path, between spaces.
 */
const CROSS_BROWSER_GREP =
	process.env.E2E_SCOPE === "pr"
		? [
				/@cross-browser/,
				...(process.env.E2E_CHANGED ?? "")
					.split(",")
					.filter(Boolean)
					.map(
						(file) =>
							new RegExp(
								`(^| )${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`,
							),
					),
			]
		: undefined;

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
			testIgnore: EUROPE_ONLY,
			use: {
				...devices["Desktop Chrome"],
				// ignoreHTTPSErrors doesn't cover the service worker's script.
				launchOptions: { args: ["--ignore-certificate-errors"] },
			},
		},
		{
			name: "firefox",
			testIgnore: EUROPE_ONLY,
			grep: CROSS_BROWSER_GREP,
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit",
			testIgnore: EUROPE_ONLY,
			grep: CROSS_BROWSER_GREP,
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
		{
			// Europe on 18 November 2026: rides that don't count yet (feature 040).
			name: "europe-pre-window",
			testMatch: EUROPE_PRE_WINDOW,
			use: {
				...devices["Desktop Chrome"],
				baseURL: `https://europe.localhost:${EUROPE_EARLY_PORT}`,
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
		{
			command: "pnpm test:e2e:server:europe-early",
			url: `https://localhost:${EUROPE_EARLY_PORT}/health`,
			ignoreHTTPSErrors: true,
			reuseExistingServer: !CI,
			timeout: 120_000,
			env: { WRANGLER_SEND_METRICS: "false" },
		},
	],
});
