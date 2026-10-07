import {
	createExecutionContext,
	createMessageBatch,
	createScheduledController,
	env,
} from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ensureTable } from "../../dev/fake-strava/store";
import worker, {
	type DevEnv,
	devFetch,
	removeStravaInterceptor,
} from "../../dev/worker";
import { makeCtx, type TestCtx, tableCounts } from "../support/ctx";

// FR-009: the fake Strava can't reach production (specs/006-local-frontend-dev
// research R9). Layer 1: nothing under src/ imports dev/, and production still
// deploys src/index.ts. Layer 2: the dev entry refuses to run without the
// fake-mode marker, and answers only local hosts.

declare global {
	interface ImportMeta {
		glob(
			pattern: string,
			options: { query: "?raw"; import: "default"; eager: true },
		): Record<string, string>;
	}
}

const SOURCES = import.meta.glob("../../src/**/*.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});
const WRANGLER = import.meta.glob("../../wrangler.jsonc", {
	query: "?raw",
	import: "default",
	eager: true,
});

const IMPORT_SPECIFIERS =
	/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'`]([^"'`]+)["'`]/g;

/** A relative or absolute path with a `dev` segment, e.g. `../../dev/worker`. */
function reachesDev(specifier: string): boolean {
	return /^[./]/.test(specifier) && /(^|\/)dev(\/|$)/.test(specifier);
}

describe("layer 1: production never bundles dev/", () => {
	it("finds the app's source files", () => {
		expect(Object.keys(SOURCES).length).toBeGreaterThanOrEqual(30);
	});

	it("has no src/ file importing from dev/", () => {
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
		]) {
			expect(reachesDev(specifier)).toBe(true);
		}
		for (const specifier of [
			"./devices",
			"../strava/client",
			"cloudflare:test",
		]) {
			expect(reachesDev(specifier)).toBe(false);
		}
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
			// The fake table exists, so no request here seeds sample data.
			await ensureTable(env.DB);
		});

		function devCtx(): TestCtx {
			const devEnv: DevEnv = { ...env, RYNKE_FAKE_STRAVA: "local-only" };
			return { ...makeCtx(), env: devEnv };
		}

		it("answers 403 to any other host and writes nothing", async () => {
			const ctx = devCtx();
			const before = await tableCounts();
			const res = await devFetch(new Request("https://rynke.example/"), ctx);
			expect(res.status).toBe(403);
			expect(res.headers.get("Content-Type")).toMatch(/^text\/plain/);
			expect(await tableCounts()).toEqual(before);
		});

		it.each([
			"http://localhost:8789/",
			"http://127.0.0.1:8789/",
			"http://[::1]:8789/",
		])("serves %s", async (url) => {
			const res = await devFetch(new Request(url), devCtx());
			expect(res.status).not.toBe(403);
		});
	});
});
