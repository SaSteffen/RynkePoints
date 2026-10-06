import { fromBase64 } from "./encrypt";

// HMAC-SHA256 signed values: `<value>.<expiresAt>.<base64url signature>`.
// Used for the session and OAuth state cookies (research R9). `value` must not
// contain dots.

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

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
	try {
		return fromBase64(value.replaceAll("-", "+").replaceAll("_", "/"));
	} catch {
		return null;
	}
}

export async function signValue(
	value: string,
	expiresAt: number,
	keyB64: string,
): Promise<string> {
	const payload = `${value}.${expiresAt}`;
	const sig = await crypto.subtle.sign(
		"HMAC",
		await importKey(keyB64),
		new TextEncoder().encode(payload),
	);
	return `${payload}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Returns the value if the signature is valid and not expired, else null. */
export async function verifySignedValue(
	signed: string,
	keyB64: string,
	now: number,
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
		new TextEncoder().encode(`${value}.${expires}`),
	);
	if (!valid || Number(expires) < now) return null;
	return value;
}
