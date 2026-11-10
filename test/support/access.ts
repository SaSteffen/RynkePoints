import { env } from "cloudflare:test";
import { vi } from "vitest";
import type { DevEnv } from "../../dev/worker";
import { NOW } from "./fixtures";

// Cloudflare Access for sandbox tests (feature 027 contracts/access-check.md):
// a test key pair, tokens signed with it, and the team domain's certs URL
// answered with its public key. Everything else stays behind test/setup.ts's
// deny-all fetch.

export const SANDBOX_HOST = "sandbox-hamburg.trhh-rynke-coins.link";
export const TEAM_DOMAIN = "example.cloudflareaccess.com";
export const AUD = "test-aud";
export const ISSUER = `https://${TEAM_DOMAIN}`;
export const CERTS = `${ISSUER}/cdn-cgi/access/certs`;

/** A sandbox's environment, behind the test Access application. */
export function sandboxEnv(extra: Partial<DevEnv> = {}): DevEnv {
	return {
		...env,
		RYNKE_FAKE_STRAVA: "sandbox",
		SANDBOX_HOST,
		ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
		ACCESS_AUD: AUD,
		...extra,
	};
}

export type AccessKeys = {
	keys: CryptoKeyPair;
	jwk: JsonWebKey & { kid: string };
};

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

/** A key pair and its public key as Access publishes it, with kid k1. */
export async function accessKeys(): Promise<AccessKeys> {
	const keys = await keyPair();
	const exported = (await crypto.subtle.exportKey(
		"jwk",
		keys.publicKey,
	)) as JsonWebKey;
	return { keys, jwk: { ...exported, kid: "k1", alg: "RS256", use: "sig" } };
}

/** Another key pair, unknown to the certs URL. */
export async function strangerKey(): Promise<CryptoKey> {
	return (await keyPair()).privateKey;
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

export const goodClaims = () => ({
	iss: ISSUER,
	aud: [AUD],
	email: "rider@example.com",
	iat: NOW - 10,
	nbf: NOW - 10,
	exp: NOW + 3600,
});

/** A token signed with `key` (the test key unless given). */
export async function accessToken(
	access: AccessKeys,
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
		options.key ?? access.keys.privateKey,
		new TextEncoder().encode(input),
	);
	return `${input}.${base64url(new Uint8Array(signature))}`;
}

/** Answers the certs URL with the test key; anything else stays blocked. */
export function serveCerts(
	access: AccessKeys,
	answer?: () => Response,
): ReturnType<typeof vi.fn> {
	const certs = vi.fn(
		answer ?? (() => Response.json({ keys: [access.jwk], public_cert: {} })),
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

/** A request to the sandbox carrying `jwt` in Access's header. */
export function sandboxRequest(
	jwt: string | null,
	options: { host?: string; path?: string; init?: RequestInit } = {},
): Request {
	const headers = new Headers(options.init?.headers);
	if (jwt !== null) headers.set("Cf-Access-Jwt-Assertion", jwt);
	return new Request(
		`https://${options.host ?? SANDBOX_HOST}${options.path ?? "/"}`,
		{ ...options.init, headers },
	);
}
