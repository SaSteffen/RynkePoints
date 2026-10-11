import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Screenshots for Strava's Developer Program review (scripts/strava-review.sh,
// docs/strava-developer-program.md): the smoke tests' fake-mode server, one
// browser, and the files go to STRAVA_REVIEW_OUT instead of test results.

export default defineConfig({
	...base,
	testMatch: "*.review.ts",
	fullyParallel: false,
	retries: 0,
	// Full-page screenshots, two sizes per page.
	timeout: 120_000,
	reporter: "list",
	use: { ...base.use, trace: "off" },
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				launchOptions: { args: ["--ignore-certificate-errors"] },
			},
		},
	],
});
