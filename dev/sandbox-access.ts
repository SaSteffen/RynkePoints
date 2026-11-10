// A sandbox's own access check (feature 027 contracts/access-check.md, research
// R3, FR-010): Cloudflare Access sits in front of the sandbox, and the Worker
// still refuses any request whose Access token it can't verify itself, so a
// deleted Access application or an added Bypass rule leaves the sandbox closed
// instead of open. Web Crypto only, no library. Nothing under src/ imports it.

/** A sandbox's host and the Access application it sits behind. */
export type AccessSettings = { host: string; teamDomain: string; aud: string };

/** The step a request failed at; the only thing ever logged about it. */
export type RefusalReason =
	| "host"
	| "header"
	| "token"
	| "keys"
	| "signature"
	| "claims";

const SKEW_SECONDS = 60;
const KEYS_TTL_MS = 60 * 60 * 1000;

type Jwk = JsonWebKey & { kid?: unknown };

/** The certs of one Access team domain, kept in the isolate for an hour. */
let cache: {
	teamDomain: string;
	fetchedAt: number;
	keys: Map<string, Jwk>;
} | null = null;

/** Drops the cached keys (for tests). */
export function forgetAccessKeys(): void {
	cache = null;
}

async function fetchKeys(teamDomain: string): Promise<Map<string, Jwk> | null> {
	try {
		const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
		if (!res.ok) return null;
		const body = (await res.json()) as { keys?: unknown };
		if (!Array.isArray(body.keys)) return null;
		const keys = new Map<string, Jwk>();
		for (const key of body.keys as Jwk[]) {
			if (typeof key?.kid === "string") keys.set(key.kid, key);
		}
		cache = { teamDomain, fetchedAt: Date.now(), keys };
		return keys;
	} catch {
		return null;
	}
}

/**
 * The key for `kid`: from the cache while it is under an hour old, otherwise
 * (or for an unknown `kid`) fetched again, at most once per call.
 */
async function keyFor(teamDomain: string, kid: string): Promise<Jwk | null> {
	const fresh =
		cache?.teamDomain === teamDomain &&
		Date.now() - cache.fetchedAt < KEYS_TTL_MS;
	const cached = fresh ? cache?.keys.get(kid) : undefined;
	if (cached) return cached;
	return (await fetchKeys(teamDomain))?.get(kid) ?? null;
}

function base64urlBytes(part: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(part)) return null;
	try {
		const binary = atob(
			part.replace(/-/g, "+").replace(/_/g, "/") +
				"=".repeat((4 - (part.length % 4)) % 4),
		);
		return Uint8Array.from(binary, (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

function jsonPart(part: string): Record<string, unknown> | null {
	const bytes = base64urlBytes(part);
	if (!bytes) return null;
	try {
		const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
		return value !== null && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

async function verifies(
	jwk: Jwk,
	signed: string,
	signature: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
	try {
		const { kty, n, e } = jwk;
		const key = await crypto.subtle.importKey(
			"jwk",
			{ kty, n, e, ext: true },
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["verify"],
		);
		return await crypto.subtle.verify(
			"RSASSA-PKCS1-v1_5",
			key,
			signature,
			new TextEncoder().encode(signed),
		);
	} catch {
		return false;
	}
}

function claimsHold(
	claims: Record<string, unknown>,
	settings: AccessSettings,
	now: number,
): boolean {
	const { iss, aud, exp, nbf } = claims;
	const audiences = typeof aud === "string" ? [aud] : aud;
	return (
		iss === `https://${settings.teamDomain}` &&
		Array.isArray(audiences) &&
		audiences.includes(settings.aud) &&
		typeof exp === "number" &&
		exp > now - SKEW_SECONDS &&
		(nbf === undefined ||
			(typeof nbf === "number" && nbf <= now + SKEW_SECONDS))
	);
}

/**
 * Checks a request in the contract's order: host, header, token, key,
 * signature, claims. `now` is in seconds. Null means it may pass. The
 * `CF_Authorization` cookie is never read: the header is authoritative.
 */
export async function accessRefusal(
	request: Request,
	settings: AccessSettings,
	now: number,
): Promise<RefusalReason | null> {
	if (new URL(request.url).hostname !== settings.host) return "host";
	const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
	if (!jwt) return "header";
	const parts = jwt.split(".");
	if (parts.length !== 3) return "token";
	const [headerPart = "", claimsPart = "", signaturePart = ""] = parts;
	const header = jsonPart(headerPart);
	const claims = jsonPart(claimsPart);
	const signature = base64urlBytes(signaturePart);
	if (
		!header ||
		!claims ||
		!signature ||
		header.alg !== "RS256" ||
		typeof header.kid !== "string" ||
		header.kid === ""
	) {
		return "token";
	}
	const jwk = await keyFor(settings.teamDomain, header.kid);
	if (!jwk) return "keys";
	if (!(await verifies(jwk, `${headerPart}.${claimsPart}`, signature))) {
		return "signature";
	}
	return claimsHold(claims, settings, now) ? null : "claims";
}

/** The refusal: no cookies, no detail, the same for every reason. */
export function refuse(reason: RefusalReason): Response {
	console.log(`sandbox access refused reason=${reason}`);
	return new Response("Sandbox: access required", {
		status: 403,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
