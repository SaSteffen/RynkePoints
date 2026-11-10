import { env } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sampleFingerprint } from "../../dev/fake-strava/seed";
import { ensureTable, markSeeded } from "../../dev/fake-strava/store";
import { forgetAccessKeys } from "../../dev/sandbox-access";
import { devFetch, removeStravaInterceptor } from "../../dev/worker";
import {
	type AccessKeys,
	AUD,
	accessKeys,
	accessToken,
	goodClaims,
	SANDBOX_HOST,
	sandboxEnv,
	sandboxRequest,
	serveCerts as serveAccessCerts,
	strangerKey,
} from "../support/access";
import { makeCtx, type TestCtx, tableCounts } from "../support/ctx";
import { NOW } from "../support/fixtures";

// The Worker's own access check (feature 027 contracts/access-check.md, FR-010):
// in a sandbox, a request that didn't come through Cloudflare Access gets a 403
// before the app, the fake Strava or /_dev/ sees it, even with Access removed.

const REFUSAL = "Sandbox: access required";

function sandboxCtx(): TestCtx {
	return { ...makeCtx(), env: sandboxEnv() };
}

let access: AccessKeys;
let otherKey: CryptoKey;

const token = (options: Parameters<typeof accessToken>[1] = {}) =>
	accessToken(access, options);
const serveCerts = (answer?: () => Response) =>
	serveAccessCerts(access, answer);
const request = sandboxRequest;

async function expectRefused(
	res: Response,
	logs: ReturnType<typeof vi.spyOn>,
	reason: string,
) {
	expect(res.status).toBe(403);
	expect(res.headers.get("Content-Type")).toMatch(/^text\/plain/);
	expect(res.headers.get("Set-Cookie")).toBeNull();
	expect(await res.text()).toBe(REFUSAL);
	expect(logs.mock.calls).toEqual([
		[`sandbox access refused reason=${reason}`],
	]);
}

beforeAll(async () => {
	access = await accessKeys();
	otherKey = await strangerKey();
	// Marked as seeded, so no request here seeds sample data.
	await ensureTable(env.DB);
	await markSeeded(env.DB, await sampleFingerprint(env.TEAM_ID));
});

afterEach(() => {
	removeStravaInterceptor();
	forgetAccessKeys();
	vi.restoreAllMocks();
});

function spyLogs() {
	const log = vi.spyOn(console, "log").mockImplementation(() => {});
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const error = vi.spyOn(console, "error").mockImplementation(() => {});
	return { log, warn, error };
}

describe("a sandbox's access check", () => {
	it("lets a valid Access token through to the app", async () => {
		serveCerts();
		const res = await devFetch(request(await token()), sandboxCtx());
		expect(res.status).toBe(200);
		expect(await res.text()).not.toBe(REFUSAL);
	});

	it("takes an aud given as a string", async () => {
		serveCerts();
		const jwt = await token({ claims: { ...goodClaims(), aud: AUD } });
		const res = await devFetch(request(jwt), sandboxCtx());
		expect(res.status).toBe(200);
	});

	it("takes an aud list that contains its application among others", async () => {
		serveCerts();
		const jwt = await token({
			claims: { ...goodClaims(), aud: ["other-aud", AUD] },
		});
		const res = await devFetch(request(jwt), sandboxCtx());
		expect(res.status).toBe(200);
	});

	it("allows 60 seconds of clock skew", async () => {
		serveCerts();
		const jwt = await token({
			claims: { ...goodClaims(), exp: NOW - 59, nbf: NOW + 60 },
		});
		const res = await devFetch(request(jwt), sandboxCtx());
		expect(res.status).toBe(200);
	});

	it("fetches the keys once an hour, not per request", async () => {
		const certs = serveCerts();
		const jwt = await token();
		await devFetch(request(jwt), sandboxCtx());
		await devFetch(request(jwt), sandboxCtx());
		expect(certs).toHaveBeenCalledTimes(1);
	});

	const cases: [string, () => Promise<Request>, string][] = [
		["no header", async () => request(null), "header"],
		["an empty header", async () => request(""), "header"],
		["a malformed token", async () => request("not.a-token"), "token"],
		["a token of two parts", async () => request("a.b"), "token"],
		[
			"alg none",
			async () => request(await token({ header: { alg: "none", kid: "k1" } })),
			"token",
		],
		[
			"HS256",
			async () => request(await token({ header: { alg: "HS256", kid: "k1" } })),
			"token",
		],
		[
			"no kid",
			async () => request(await token({ header: { alg: "RS256" } })),
			"token",
		],
		[
			"an unknown kid",
			async () => request(await token({ header: { alg: "RS256", kid: "k2" } })),
			"keys",
		],
		[
			"a bad signature",
			async () => request(await token({ key: otherKey })),
			"signature",
		],
		[
			"another aud",
			async () =>
				request(
					await token({ claims: { ...goodClaims(), aud: ["other-aud"] } }),
				),
			"claims",
		],
		[
			"no aud",
			async () => {
				const { aud: _, ...claims } = goodClaims();
				return request(await token({ claims }));
			},
			"claims",
		],
		[
			"another iss",
			async () =>
				request(
					await token({
						claims: {
							...goodClaims(),
							iss: "https://other.cloudflareaccess.com",
						},
					}),
				),
			"claims",
		],
		[
			"an expired token",
			async () =>
				request(await token({ claims: { ...goodClaims(), exp: NOW - 60 } })),
			"claims",
		],
		[
			"no exp",
			async () => {
				const { exp: _, ...claims } = goodClaims();
				return request(await token({ claims }));
			},
			"claims",
		],
		[
			"a future nbf",
			async () =>
				request(await token({ claims: { ...goodClaims(), nbf: NOW + 61 } })),
			"claims",
		],
		[
			"another host",
			async () =>
				request(await token(), {
					host: "sandbox-europe.trhh-rynke-coins.link",
				}),
			"host",
		],
	];

	it.each(cases)("refuses %s before the app runs", async (_, make, reason) => {
		serveCerts();
		const before = await tableCounts();
		const logs = spyLogs();
		const res = await devFetch(await make(), sandboxCtx());
		await expectRefused(res, logs.log, reason);
		expect(logs.warn).not.toHaveBeenCalled();
		expect(logs.error).not.toHaveBeenCalled();
		expect(await tableCounts()).toEqual(before);
	});

	it.each(cases)("refuses %s on /_dev/ too", async (_, make, reason) => {
		serveCerts();
		const logs = spyLogs();
		const req = await make();
		const url = new URL(req.url);
		const res = await devFetch(
			new Request(`${url.origin}/_dev/`, { headers: req.headers }),
			sandboxCtx(),
		);
		await expectRefused(res, logs.log, reason);
	});

	it("refuses when the certs URL fails", async () => {
		serveCerts(() => new Response("down", { status: 500 }));
		const logs = spyLogs();
		const res = await devFetch(request(await token()), sandboxCtx());
		await expectRefused(res, logs.log, "keys");
	});

	it("refuses when the certs URL can't be reached", async () => {
		serveCerts(() => {
			throw new Error("network down");
		});
		const logs = spyLogs();
		const res = await devFetch(request(await token()), sandboxCtx());
		await expectRefused(res, logs.log, "keys");
	});

	it("ignores the CF_Authorization cookie", async () => {
		serveCerts();
		const logs = spyLogs();
		const res = await devFetch(
			new Request(`https://${SANDBOX_HOST}/`, {
				headers: { Cookie: `CF_Authorization=${await token()}` },
			}),
			sandboxCtx(),
		);
		await expectRefused(res, logs.log, "header");
	});

	it("never logs the token or its claims", async () => {
		serveCerts();
		const logs = spyLogs();
		const jwt = await token({
			claims: { ...goodClaims(), aud: ["other-aud"] },
		});
		await devFetch(request(jwt), sandboxCtx());
		const written = JSON.stringify([
			logs.log.mock.calls,
			logs.warn.mock.calls,
			logs.error.mock.calls,
		]);
		expect(written).not.toContain(jwt.split(".")[1]);
		expect(written).not.toContain("rider@example.com");
		expect(written).not.toContain("other-aud");
	});
});
