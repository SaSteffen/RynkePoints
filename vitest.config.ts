import { readFileSync } from "node:fs";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { isSandbox, parseJsonc } from "./scripts/team-check.mjs";
import PINNED_VARS from "./test/support/pinned.json";

// Tests run inside the real Workers runtime (workerd via Miniflare), with the
// bindings declared in wrangler.jsonc — no Cloudflare account needed.
//
// Two kinds of project (feature 026 research R11): `app`, every suite but
// test/teams/ and test/gateway/, as the founding team with its settings
// pinned; one `team:<id>` project per registered team for test/teams/, with the bindings of
// that team's Wrangler block `env.<id>` (`pnpm lint`'s team-check keeps those
// blocks and the registry in src/teams/ the same teams). The founding team's
// block comes first.
//
// `app` pins the founding team's settings (test/support/pinned.json), synthetic
// values only: the club and one further club, a season start so tests don't
// follow production's, the feature switches the "off" tests override per
// request, and a synthetic controller and contact.
export default defineConfig(async () => {
	const migrations = await readD1Migrations("./migrations");

	// Synthetic values only. They override .dev.vars, so tests never see real
	// secrets (constitution Principle I).
	const secrets = {
		TEST_MIGRATIONS: migrations,
		STRAVA_CLIENT_ID: "10001",
		STRAVA_CLIENT_SECRET: "test-client-secret",
		STRAVA_WEBHOOK_VERIFY_TOKEN: "test-verify-token",
		// Bytes 0x00..0x1f and 0x20..0x3f, base64.
		TOKEN_ENCRYPTION_KEY: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
		SESSION_SIGNING_KEY: "ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=",
		ADMIN_TOKEN: "test-admin-token",
		// Synthetic EC P-256 test key (JWK), never used in production.
		PUSH_VAPID_KEY:
			'{"kty":"EC","crv":"P-256","x":"EKhvzchlkzvjgKve8BblQ_7XywqXsIq3hKyKpvFut0c","y":"Fz_GMdH6KwK6EvTbVTdW9tNi8HqQFE3L0auRPE20Iwk","d":"oRmpIBPH91mXDWou0dK96dIkgbL87_VWY0djN0waCCw"}',
	};

	const wrangler = parseJsonc(readFileSync("./wrangler.jsonc", "utf8")) as {
		env: Record<string, unknown>;
	};
	// Sandbox blocks (feature 027) are fake mode, not teams.
	const teams = Object.keys(wrangler.env).filter((id) => !isSandbox(id));
	const [founding] = teams;
	const teamProjects = teams.map((id) => ({
		plugins: [
			cloudflareTest({
				wrangler: { configPath: "./wrangler.jsonc", environment: id },
				miniflare: { bindings: secrets },
			}),
		],
		test: {
			name: `team:${id}`,
			include: ["test/teams/**/*.test.ts"],
			setupFiles: ["./test/setup.ts"],
		},
	}));

	return {
		test: {
			projects: [
				{
					plugins: [
						cloudflareTest({
							wrangler: {
								configPath: "./wrangler.jsonc",
								environment: founding,
							},
							miniflare: { bindings: { ...secrets, ...PINNED_VARS } },
						}),
					],
					test: {
						name: "app",
						include: ["test/**/*.test.ts"],
						exclude: ["test/teams/**", "test/gateway/**"],
						setupFiles: ["./test/setup.ts"],
					},
				},
				...teamProjects,
				// The Strava gateway (release 3), with its own config and synthetic
				// settings: two teams, their webhook tokens, no D1.
				{
					plugins: [
						cloudflareTest({
							wrangler: { configPath: "./gateway/wrangler.jsonc" },
							miniflare: {
								bindings: {
									TEAMS: JSON.stringify([
										{ id: "hamburg", origin: "https://hamburg.example.test" },
										{ id: "europe", origin: "https://europe.example.test" },
									]),
									STRAVA_WEBHOOK_VERIFY_TOKEN: "test-gateway-verify-token",
									TEAM_WEBHOOK_TOKEN_HAMBURG: "test-hamburg-webhook-token",
									TEAM_WEBHOOK_TOKEN_EUROPE: "test-europe-webhook-token",
								},
								// Stands in for Hamburg's Worker; the forward tests replace it.
								serviceBindings: {
									TEAM_SERVICE_HAMBURG: () =>
										new Response("stand-in", { status: 500 }),
								},
							},
						}),
					],
					test: {
						name: "gateway",
						include: ["test/gateway/**/*.test.ts"],
						setupFiles: ["./test/gateway/setup.ts"],
					},
				},
			],
		},
	};
});
