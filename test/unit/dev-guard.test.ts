import {
	createExecutionContext,
	createMessageBatch,
	createScheduledController,
	env,
} from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { sampleFingerprint } from "../../dev/fake-strava/seed";
import { ensureTable, markSeeded } from "../../dev/fake-strava/store";
import worker, {
	type DevEnv,
	devFetch,
	removeStravaInterceptor,
} from "../../dev/worker";
import { makeCtx, type TestCtx, tableCounts } from "../support/ctx";

// FR-009: the fake Strava can't reach production (specs/006-local-frontend-dev
// research R9). Layer 1: nothing under src/, nor the team data under teams/,
// imports dev/, album/ (the season album Worker, feature 021 research R12),
// tools/ (local content tools) or a team's sample riders (teams/<id>/samples.ts,
// which only the fake Strava reads), and production still deploys src/index.ts. Layer 2: the dev entry refuses to run without the
// fake-mode marker, and answers only local hosts.

declare global {
	interface ImportMeta {
		glob(
			pattern: string | string[],
			options: { query: "?raw"; import: "default"; eager: true },
		): Record<string, string>;
	}
}

// The app's sources: src/ and every team's data, which src/teams/ imports.
const SOURCES = import.meta.glob(
	["../../src/**/*.ts", "../../teams/*/*.ts", "!../../teams/*/samples.ts"],
	{
		query: "?raw",
		import: "default",
		eager: true,
	},
);
const WRANGLER = import.meta.glob("../../wrangler.jsonc", {
	query: "?raw",
	import: "default",
	eager: true,
});

const IMPORT_SPECIFIERS =
	/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'`]([^"'`]+)["'`]/g;

/**
 * A relative or absolute path with a `dev`, `album`, `tools` or `gateway`
 * segment (the Strava gateway Worker, feature 026 release 3), e.g.
 * `../../dev/worker`, or a team's sample riders, e.g. `./samples`.
 */
function reachesDev(specifier: string): boolean {
	return (
		/^[./]/.test(specifier) &&
		(/(^|\/)(dev|album|tools|gateway)(\/|$)/.test(specifier) ||
			/(^|\/)samples(\.ts)?$/.test(specifier))
	);
}

describe("layer 1: production never bundles dev/, album/, tools/ or gateway/", () => {
	it("finds the app's source files and the team data, not the samples", () => {
		const files = Object.keys(SOURCES);
		expect(files.length).toBeGreaterThanOrEqual(30);
		expect(files).toContain("../../teams/hamburg/team.ts");
		expect(files.some((file) => file.endsWith("/samples.ts"))).toBe(false);
	});

	it("has no app file importing from dev/, album/, tools/, gateway/ or samples", () => {
		const offenders = Object.entries(SOURCES).flatMap(([file, text]) =>
			[...text.matchAll(IMPORT_SPECIFIERS)]
				.map((m) => m[1] ?? "")
				.filter(reachesDev)
				.map((specifier) => `${file}: ${specifier}`),
		);
		expect(offenders).toEqual([]);
	});

	it("recognises imports that would reach dev/", () => {
		for (const specifier of [
			"../dev/worker",
			"../../dev/fake-strava/api",
			"/dev/x",
			"../../album/load",
			"../album",
			"../../tools/content-rating/server.mjs",
			"../../gateway/index",
			"../../teams/hamburg/samples",
			"./samples",
		]) {
			expect(reachesDev(specifier)).toBe(true);
		}
		for (const specifier of [
			"./devices",
			"./albums",
			"./toolsbar",
			"./gateways",
			"./samples-table",
			"../strava/client",
			"cloudflare:test",
		]) {
			expect(reachesDev(specifier)).toBe(false);
		}
	});

	it("has no app file reading a sandbox's settings (027 FR-013)", () => {
		const vars =
			/\b(SANDBOX_HOST|ACCESS_TEAM_DOMAIN|ACCESS_AUD|SANDBOX_COMMIT|SANDBOX_SOURCE)\b/;
		const offenders = Object.entries(SOURCES)
			.filter(([, text]) => vars.test(text))
			.map(([file]) => file);
		expect(offenders).toEqual([]);
	});

	it("deploys src/index.ts", () => {
		const config = Object.values(WRANGLER)[0] ?? "";
		expect(config).toContain('"main": "src/index.ts"');
	});
});

describe("layer 2: the dev entry runs only in local fake mode", () => {
	const refusal = "fake Strava runs only in local fake mode";

	// The dev entry wraps fetch; give test/setup.ts's spy back before its own
	// afterEach checks it.
	afterEach(removeStravaInterceptor);

	it("refuses fetch, queue and scheduled without the marker", async () => {
		const exec = createExecutionContext();
		await expect(
			worker.fetch(new Request("http://localhost:8789/"), env, exec),
		).rejects.toThrow(refusal);
		await expect(
			worker.queue(createMessageBatch("rynke-points-work", []), env, exec),
		).rejects.toThrow(refusal);
		await expect(
			worker.scheduled(createScheduledController(), env, exec),
		).rejects.toThrow(refusal);
	});

	describe("with the marker", () => {
		beforeAll(async () => {
			// Marked as seeded, so no request here seeds sample data.
			await ensureTable(env.DB);
			await markSeeded(env.DB, await sampleFingerprint(env.TEAM_ID));
		});

		function devCtx(): TestCtx {
			const devEnv: DevEnv = { ...env, RYNKE_FAKE_STRAVA: "local-only" };
			return { ...makeCtx(), env: devEnv };
		}

		it.each([
			"https://rynke.example/",
			"https://localhost.example/",
			"https://europe.localhost.example/",
		])("answers 403 to %s and writes nothing", async (url) => {
			const ctx = devCtx();
			const before = await tableCounts();
			const res = await devFetch(new Request(url), ctx);
			expect(res.status).toBe(403);
			expect(res.headers.get("Content-Type")).toMatch(/^text\/plain/);
			expect(await tableCounts()).toEqual(before);
		});

		it.each([
			"http://localhost:8789/",
			"http://127.0.0.1:8789/",
			"http://[::1]:8789/",
			"http://europe.localhost:8790/",
		])("serves %s", async (url) => {
			const res = await devFetch(new Request(url), devCtx());
			expect(res.status).not.toBe(403);
		});
	});
});
