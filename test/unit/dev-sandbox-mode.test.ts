import { env } from "cloudflare:test";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { sampleFingerprint } from "../../dev/fake-strava/seed";
import { ensureTable, markSeeded } from "../../dev/fake-strava/store";
import { forgetAccessKeys } from "../../dev/sandbox-access";
import {
	assertFakeMode,
	type DevEnv,
	devFetch,
	removeStravaInterceptor,
	sandboxMode,
} from "../../dev/worker";
import {
	type AccessKeys,
	accessKeys,
	accessToken,
	sandboxEnv,
	sandboxRequest,
	serveCerts,
} from "../support/access";
import { makeCtx, resetDb, seedRider, tableCounts } from "../support/ctx";

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

// In a sandbox, nothing seeds and nothing resets: each deployment rebuilds the
// database outside the Worker (research R6, FR-016, FR-019).
describe("a sandbox's sample data", () => {
	let access: AccessKeys;

	beforeAll(async () => {
		access = await accessKeys();
	});
	beforeEach(async () => {
		await resetDb();
		await env.DB.batch([
			env.DB.prepare("DROP TABLE IF EXISTS fake_strava_activities"),
			env.DB.prepare("DROP TABLE IF EXISTS fake_strava_seed"),
		]);
		serveCerts(access);
	});
	afterEach(() => {
		removeStravaInterceptor();
		forgetAccessKeys();
		vi.restoreAllMocks();
	});

	const ctx = () => ({ ...makeCtx(), env: sandboxEnv() });

	async function seedTable(): Promise<string | null> {
		return (
			(await env.DB.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fake_strava_seed'",
			).first<string>("name")) ?? null
		);
	}

	it.each(["/", "/_dev/"])(
		"never seeds an empty database, on %s",
		async (path) => {
			const res = await devFetch(
				sandboxRequest(await accessToken(access), { path }),
				ctx(),
			);
			expect(res.status).toBe(200);
			expect(await seedTable()).toBeNull();
			expect(
				await env.DB.prepare("SELECT COUNT(*) AS n FROM riders").first("n"),
			).toBe(0);
		},
	);

	it("answers a reset with 409 and deletes nothing", async () => {
		await seedRider(makeCtx());
		const before = await tableCounts();
		const res = await devFetch(
			sandboxRequest(await accessToken(access), {
				path: "/_dev/reset",
				init: { method: "POST" },
			}),
			ctx(),
		);
		expect(res.status).toBe(409);
		expect(res.headers.get("Set-Cookie")).toBeNull();
		expect(await res.text()).toBe(
			"Deploy again to reset the sandbox (docs/sandboxes.md)",
		);
		expect(await tableCounts()).toEqual(before);
		expect(await seedTable()).toBeNull();
	});
});

// The bar on every page of a sandbox (research R12, FR-003, FR-050).
describe("the sandbox bar", () => {
	const SHA = "0123456789abcdef0123456789abcdef01234567";
	let access: AccessKeys;

	beforeAll(async () => {
		access = await accessKeys();
		await ensureTable(env.DB);
		await markSeeded(env.DB, await sampleFingerprint(env.TEAM_ID));
	});
	beforeEach(() => {
		serveCerts(access);
	});
	afterEach(() => {
		removeStravaInterceptor();
		forgetAccessKeys();
		vi.restoreAllMocks();
	});

	async function sandboxGet(
		path: string,
		extra: Partial<DevEnv> = {},
	): Promise<Response> {
		return devFetch(sandboxRequest(await accessToken(access), { path }), {
			...makeCtx(),
			env: sandboxEnv({
				SANDBOX_COMMIT: SHA,
				SANDBOX_SOURCE: "PR #296",
				...extra,
			}),
		});
	}

	function bar(page: string): string {
		return page.match(/<div class="sandbox-bar"[^>]*>.*?<\/div>/s)?.[0] ?? "";
	}

	it.each(["/", "/_dev/"])(
		"tops %s with the commit and where it came from",
		async (path) => {
			const res = await sandboxGet(path);
			expect(res.status).toBe(200);
			const page = await res.text();
			const shown = bar(page);
			expect(shown).toContain("Sandbox · not the real app · ");
			expect(shown).toContain(
				`<a href="https://github.com/SaSteffen/RynkePoints/commit/${SHA}">0123456</a>`,
			);
			expect(shown).toContain("PR #296");
			expect(page).toMatch(/\.sandbox-bar\{position:fixed/);
		},
	);

	it.each(["release #12", "develop"])("names the source %s", async (source) => {
		const shown = bar(
			await (await sandboxGet("/", { SANDBOX_SOURCE: source })).text(),
		);
		expect(shown).toContain(source);
	});

	it("escapes what it shows and links only a commit hash", async () => {
		const shown = bar(
			await (
				await sandboxGet("/", {
					SANDBOX_COMMIT: "<b>x",
					SANDBOX_SOURCE: "<i>y</i>",
				})
			).text(),
		);
		expect(shown).toContain("&lt;b&gt;x");
		expect(shown).toContain("&lt;i&gt;y&lt;/i&gt;");
		expect(shown).not.toContain("<a ");
	});

	it("leaves a page that isn't HTML alone", async () => {
		const res = await sandboxGet("/_dev/nothing-here");
		expect(res.status).toBe(404);
		expect(await res.text()).toBe("Not Found");
	});

	it("isn't there in local fake mode", async () => {
		const res = await devFetch(new Request("http://localhost:8789/_dev/"), {
			...makeCtx(),
			env: { ...env, RYNKE_FAKE_STRAVA: "local-only" } as DevEnv,
		});
		expect(res.status).toBe(200);
		expect(await res.text()).not.toContain("sandbox-bar");
	});
});
