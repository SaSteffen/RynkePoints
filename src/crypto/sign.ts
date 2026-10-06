import { fromBase64 } from "./encrypt";

// HMAC-SHA256 signed values: `<value>.<expiresAt>.<base64url signature>`.
// Used for the session and OAuth state cookies (research R9). `value` must not
// contain dots. `context` (e.g. the cookie name) is part of the MAC but not of
// the output, so a value signed for one purpose never verifies for another.

const keys = new Map<string, Promise<CryptoKey>>();

function importKey(keyB64: string): Promise<CryptoKey> {
	let key = keys.get(keyB64);
	if (!key) {
		key = crypto.subtle.importKey(
			"raw",
			fromBase64(keyB64),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign", "verify"],
		);
		keys.set(keyB64, key);
	}
	return key;
}

function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

/** Decodes canonical base64url only, so each signature has one spelling. */
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
	try {
		const bytes = fromBase64(value.replaceAll("-", "+").replaceAll("_", "/"));
		return toBase64Url(bytes) === value ? bytes : null;
	} catch {
		return null;
	}
}

function macInput(context: string, payload: string) {
	return new TextEncoder().encode(`${context}\n${payload}`);
}

export async function signValue(
	value: string,
	expiresAt: number,
	keyB64: string,
	context = "",
): Promise<string> {
	const payload = `${value}.${expiresAt}`;
	const sig = await crypto.subtle.sign(
		"HMAC",
		await importKey(keyB64),
		macInput(context, payload),
	);
	return `${payload}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Returns the value if the signature is valid and not expired, else null. */
export async function verifySignedValue(
	signed: string,
	keyB64: string,
	now: number,
	context = "",
): Promise<string | null> {
	const parts = signed.split(".");
	if (parts.length !== 3) return null;
	const [value, expires, sigText] = parts as [string, string, string];
	if (!value || !/^\d+$/.test(expires)) return null;
	const sig = fromBase64Url(sigText);
	if (!sig) return null;
	// subtle.verify compares in constant time.
	const valid = await crypto.subtle.verify(
		"HMAC",
		await importKey(keyB64),
		sig,
		macInput(context, `${value}.${expires}`),
	);
	if (!valid || Number(expires) < now) return null;
	return value;
}
