import { env } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sampleFingerprint } from "../../dev/fake-strava/seed";
import { ensureTable, markSeeded } from "../../dev/fake-strava/store";
import { forgetAccessKeys } from "../../dev/sandbox-access";
import {
	type DevEnv,
	devFetch,
	removeStravaInterceptor,
} from "../../dev/worker";
import { makeCtx, type TestCtx, tableCounts } from "../support/ctx";
import { NOW } from "../support/fixtures";

// The Worker's own access check (feature 027 contracts/access-check.md, FR-010):
// in a sandbox, a request that didn't come through Cloudflare Access gets a 403
// before the app, the fake Strava or /_dev/ sees it, even with Access removed.

const HOST = "sandbox-hamburg.trhh-rynke-coins.link";
const TEAM_DOMAIN = "example.cloudflareaccess.com";
const AUD = "test-aud";
const ISSUER = `https://${TEAM_DOMAIN}`;
const CERTS = `${ISSUER}/cdn-cgi/access/certs`;
const REFUSAL = "Sandbox: access required";

const sandboxEnv: DevEnv = {
	...env,
	RYNKE_FAKE_STRAVA: "sandbox",
	SANDBOX_HOST: HOST,
	ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
	ACCESS_AUD: AUD,
};

function sandboxCtx(): TestCtx {
	return { ...makeCtx(), env: sandboxEnv };
}

let keys: CryptoKeyPair;
let otherKeys: CryptoKeyPair;
let jwk: JsonWebKey & { kid: string };

async function keyPair(): Promise<CryptoKeyPair> {
	return (await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
}

function base64url(bytes: Uint8Array | string): string {
	const raw =
		typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
	let binary = "";
	for (const b of raw) binary += String.fromCharCode(b);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

const goodClaims = () => ({
	iss: ISSUER,
	aud: [AUD],
	email: "rider@example.com",
	iat: NOW - 10,
	nbf: NOW - 10,
	exp: NOW + 3600,
});

async function token(
	options: {
		header?: Record<string, unknown>;
		claims?: Record<string, unknown>;
		key?: CryptoKey;
	} = {},
): Promise<string> {
	const header = options.header ?? { alg: "RS256", kid: "k1", typ: "JWT" };
	const claims = options.claims ?? goodClaims();
	const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		options.key ?? keys.privateKey,
		new TextEncoder().encode(input),
	);
	return `${input}.${base64url(new Uint8Array(signature))}`;
}

/** Answers the certs URL with the test key; anything else stays blocked. */
function serveCerts(answer?: () => Response): ReturnType<typeof vi.fn> {
	const certs = vi.fn(
		answer ?? (() => Response.json({ keys: [jwk], public_cert: {} })),
	);
	const blocked = vi.mocked(globalThis.fetch).getMockImplementation();
	vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
		const url = new Request(input, init).url;
		if (url === CERTS) return certs();
		if (!blocked) throw new Error(`unexpected request ${url}`);
		return blocked(input, init);
	});
	return certs;
}

function request(
	jwt: string | null,
	options: { host?: string; path?: string } = {},
): Request {
	const headers = new Headers();
	if (jwt !== null) headers.set("Cf-Access-Jwt-Assertion", jwt);
	return new Request(`https://${options.host ?? HOST}${options.path ?? "/"}`, {
		headers,
	});
}

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
	keys = await keyPair();
	otherKeys = await keyPair();
	const exported = (await crypto.subtle.exportKey(
		"jwk",
		keys.publicKey,
	)) as JsonWebKey;
	jwk = { ...exported, kid: "k1", alg: "RS256", use: "sig" };
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
			async () => request(await token({ key: otherKeys.privateKey })),
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
			new Request(`https://${HOST}/`, {
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
