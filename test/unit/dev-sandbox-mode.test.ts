import { env } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { sampleFingerprint } from "../../dev/fake-strava/seed";
import { ensureTable, markSeeded } from "../../dev/fake-strava/store";
import {
	assertFakeMode,
	type DevEnv,
	devFetch,
	removeStravaInterceptor,
	sandboxMode,
} from "../../dev/worker";
import { makeCtx } from "../support/ctx";

// Fake mode's two modes (feature 027 contracts/access-check.md, Modes): local
// fake mode as before, and a release sandbox, which needs its host and the
// Access application it sits behind. Anything else runs nothing.
describe("fake mode's modes", () => {
	const sandbox: DevEnv = {
		...env,
		RYNKE_FAKE_STRAVA: "sandbox",
		SANDBOX_HOST: "sandbox-hamburg.trhh-rynke-coins.link",
		ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
		ACCESS_AUD: "test-aud",
	};

	it("runs in local fake mode, without a sandbox", () => {
		const local: DevEnv = { ...env, RYNKE_FAKE_STRAVA: "local-only" };
		expect(() => assertFakeMode(local)).not.toThrow();
		expect(sandboxMode(local)).toBeNull();
	});

	it("runs as a sandbox with its host and Access application", () => {
		expect(() => assertFakeMode(sandbox)).not.toThrow();
		expect(sandboxMode(sandbox)).toEqual({
			host: "sandbox-hamburg.trhh-rynke-coins.link",
			teamDomain: "example.cloudflareaccess.com",
			aud: "test-aud",
		});
	});

	it.each(["SANDBOX_HOST", "ACCESS_TEAM_DOMAIN", "ACCESS_AUD"] as const)(
		"refuses a sandbox without %s, or with it empty",
		(key) => {
			const { [key]: _, ...without } = sandbox;
			expect(() => assertFakeMode(without as DevEnv)).toThrow(
				"sandbox mode needs SANDBOX_HOST, ACCESS_TEAM_DOMAIN and ACCESS_AUD",
			);
			expect(() => assertFakeMode({ ...sandbox, [key]: "" })).toThrow(
				"sandbox mode needs SANDBOX_HOST, ACCESS_TEAM_DOMAIN and ACCESS_AUD",
			);
		},
	);

	it.each([undefined, "", "production", "Sandbox", "local"])(
		"refuses the marker %j",
		(marker) => {
			expect(() =>
				assertFakeMode({ ...sandbox, RYNKE_FAKE_STRAVA: marker }),
			).toThrow("fake Strava runs only in local fake mode or a sandbox");
		},
	);
});

// Production's hosts never get fake mode, in either mode (FR-013); local fake
// mode still answers localhost without a token.
describe("production's hosts", () => {
	const sandbox: DevEnv = {
		...env,
		RYNKE_FAKE_STRAVA: "sandbox",
		SANDBOX_HOST: "sandbox-hamburg.trhh-rynke-coins.link",
		ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
		ACCESS_AUD: "test-aud",
	};
	const local: DevEnv = { ...env, RYNKE_FAKE_STRAVA: "local-only" };

	beforeAll(async () => {
		await ensureTable(env.DB);
		await markSeeded(env.DB, await sampleFingerprint(env.TEAM_ID));
	});
	afterEach(removeStravaInterceptor);

	it.each([
		"https://trhh-rynke-coins.link/",
		"https://europe.trhh-rynke-coins.link/",
	])("refuses %s in either mode", async (url) => {
		const asSandbox = await devFetch(new Request(url), {
			...makeCtx(),
			env: sandbox,
		});
		expect(asSandbox.status).toBe(403);
		const asLocal = await devFetch(new Request(url), {
			...makeCtx(),
			env: local,
		});
		expect(asLocal.status).toBe(403);
	});

	it("answers localhost in local fake mode without a token", async () => {
		const res = await devFetch(new Request("http://localhost:8789/"), {
			...makeCtx(),
			env: local,
		});
		expect(res.status).toBe(200);
	});
});
