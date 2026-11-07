import { readFileSync } from "node:fs";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { parseJsonc } from "./scripts/team-check.mjs";
import PINNED_VARS from "./test/support/pinned.json";

// Tests run inside the real Workers runtime (workerd via Miniflare), with the
// bindings declared in wrangler.jsonc — no Cloudflare account needed.
//
// Two kinds of project (feature 026 research R11): `app`, every suite but
// test/teams/, as the founding team with its settings pinned; and one
// `team:<id>` project per registered team for test/teams/, with the bindings of
// that team's Wrangler block (the top level for the founding team,
// `env.<id>` for the others; `pnpm lint`'s team-check keeps those blocks and
// the registry in src/teams/ the same teams).
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
		vars: { TEAM_ID: string };
		env?: Record<string, unknown>;
	};
	const teams = [
		{ id: wrangler.vars.TEAM_ID, environment: undefined },
		...Object.keys(wrangler.env ?? {}).map((id) => ({ id, environment: id })),
	];
	const teamProjects = teams.map((team) => ({
		plugins: [
			cloudflareTest({
				wrangler: {
					configPath: "./wrangler.jsonc",
					...(team.environment ? { environment: team.environment } : {}),
				},
				miniflare: { bindings: secrets },
			}),
		],
		test: {
			name: `team:${team.id}`,
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
							wrangler: { configPath: "./wrangler.jsonc" },
							miniflare: { bindings: { ...secrets, ...PINNED_VARS } },
						}),
					],
					test: {
						name: "app",
						include: ["test/**/*.test.ts"],
						exclude: ["test/teams/**"],
						setupFiles: ["./test/setup.ts"],
					},
				},
				...teamProjects,
			],
		},
	};
});
