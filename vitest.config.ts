import {
	cloudflareTest,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Tests run inside the real Workers runtime (workerd via Miniflare), with the
// bindings declared in wrangler.jsonc — no Cloudflare account needed.
export default defineConfig(async () => {
	const migrations = await readD1Migrations("./migrations");

	return {
		plugins: [
			cloudflareTest({
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					// Synthetic values only. They override .dev.vars, so tests never
					// see real secrets (constitution Principle I).
					bindings: {
						TEST_MIGRATIONS: migrations,
						STRAVA_CLIENT_ID: "10001",
						STRAVA_CLIENT_SECRET: "test-client-secret",
						STRAVA_WEBHOOK_VERIFY_TOKEN: "test-verify-token",
						// Bytes 0x00..0x1f and 0x20..0x3f, base64.
						TOKEN_ENCRYPTION_KEY:
							"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
						SESSION_SIGNING_KEY: "ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=",
						ADMIN_TOKEN: "test-admin-token",
						STRAVA_SUBSCRIPTION_ID: "777",
						// Pinned so tests don't follow the production season start.
						SEASON_START_DATE: "2026-01-01",
					},
				},
			}),
		],
		test: {
			setupFiles: ["./test/setup.ts"],
		},
	};
});
