// AES-256-GCM encryption for Strava tokens at rest (research R10). Stored as
// `v1:<base64 iv>:<base64 ciphertext>`; the version prefix leaves room for key
// rotation.

import { fromBase64, toBase64 } from "./base64";

const VERSION = "v1";
const IV_BYTES = 12;

const keys = new Map<string, Promise<CryptoKey>>();

function importKey(keyB64: string): Promise<CryptoKey> {
	let key = keys.get(keyB64);
	if (!key) {
		const raw = fromBase64(keyB64);
		if (raw.length !== 32) {
			throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64");
		}
		key = crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
			"encrypt",
			"decrypt",
		]);
		keys.set(keyB64, key);
	}
	return key;
}

export async function encryptToken(
	plaintext: string,
	keyB64: string,
): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		await importKey(keyB64),
		new TextEncoder().encode(plaintext),
	);
	return `${VERSION}:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptToken(
	value: string,
	keyB64: string,
): Promise<string> {
	const [version, iv, ciphertext, ...rest] = value.split(":");
	if (version !== VERSION || !iv || !ciphertext || rest.length > 0) {
		throw new Error("Unsupported encrypted token format");
	}
	const plaintext = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: fromBase64(iv) },
		await importKey(keyB64),
		fromBase64(ciphertext),
	);
	return new TextDecoder().decode(plaintext);
}
