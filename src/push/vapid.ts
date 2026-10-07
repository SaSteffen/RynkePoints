// VAPID (RFC 8292): the Worker proves to a push service that a push comes from
// RynkePoints (research R4). `PUSH_VAPID_KEY` is an EC P-256 JWK with `d`; the
// public part is the `applicationServerKey` the page subscribes with.

type VapidEnv = Pick<Env, "PUSH_VAPID_KEY" | "PUSH_SUBJECT">;

interface VapidJwk {
	x: string;
	y: string;
}

/** A token is reused while it stays valid for more than an hour. */
const TOKEN_LIFETIME = 12 * 3600;
const TOKEN_MIN_LEFT = 3600;

const keys = new Map<string, Promise<CryptoKey>>();
const tokens = new Map<string, { token: string; exp: number }>();

function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
	const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const encodeJson = (value: unknown) =>
	toBase64Url(new TextEncoder().encode(JSON.stringify(value)));

/** The uncompressed public point `0x04‖x‖y`, base64url. */
export function vapidPublicKey(env: Pick<Env, "PUSH_VAPID_KEY">): string {
	const { x, y } = JSON.parse(env.PUSH_VAPID_KEY) as VapidJwk;
	return toBase64Url(
		new Uint8Array([0x04, ...fromBase64Url(x), ...fromBase64Url(y)]),
	);
}

function importKey(jwk: string): Promise<CryptoKey> {
	let key = keys.get(jwk);
	if (!key) {
		key = crypto.subtle.importKey(
			"jwk",
			JSON.parse(jwk) as JsonWebKey,
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["sign"],
		);
		keys.set(jwk, key);
	}
	return key;
}

/** The `Authorization` header for a push to `origin`. */
export async function vapidAuthorization(
	origin: string,
	env: VapidEnv,
	now: number,
): Promise<string> {
	const cacheKey = `${env.PUSH_VAPID_KEY}\n${env.PUSH_SUBJECT}\n${origin}`;
	const cached = tokens.get(cacheKey);
	let token = cached && cached.exp - now > TOKEN_MIN_LEFT ? cached.token : null;
	if (!token) {
		const exp = now + TOKEN_LIFETIME;
		const unsigned = `${encodeJson({ typ: "JWT", alg: "ES256" })}.${encodeJson({
			aud: origin,
			exp,
			sub: env.PUSH_SUBJECT,
		})}`;
		const signature = await crypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			await importKey(env.PUSH_VAPID_KEY),
			new TextEncoder().encode(unsigned),
		);
		token = `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
		tokens.set(cacheKey, { token, exp });
	}
	return `vapid t=${token}, k=${vapidPublicKey(env)}`;
}
