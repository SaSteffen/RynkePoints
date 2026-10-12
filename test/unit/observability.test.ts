import { describe, expect, it } from "vitest";

// Cloudflare's invocation logs record each request's URL, and the Strava
// webhook's URL carries its secret, so they stay off (wrangler.jsonc). The
// app's own log lines are checked in no-secret-logging.test.ts.
// `import.meta.glob` is declared in dev-guard.test.ts.

const FILES = import.meta.glob("../../wrangler.jsonc", {
	query: "?raw",
	import: "default",
	eager: true,
});
const wrangler = Object.values(FILES)[0] ?? "";

describe("wrangler.jsonc observability", () => {
	it("keeps Workers Logs on for the app's own log lines", () => {
		expect(wrangler).toMatch(/"observability":\s*\{\s*"enabled":\s*true/);
	});

	it("turns invocation logs off, which would record the webhook's secret", () => {
		expect(wrangler).toMatch(/"invocation_logs":\s*false/);
	});
});
