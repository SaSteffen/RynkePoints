// Base64 and base64url (RFC 4648 §4, §5) for the keys, tokens and signatures
// the Worker stores or sends; base64url without padding, as JWTs and cookies
// carry it.

export function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

/** Throws on input that isn't base64. */
export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export function toBase64Url(bytes: Uint8Array): string {
	return toBase64(bytes)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

/** Throws on input that isn't base64url. */
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
	return fromBase64(value.replaceAll("-", "+").replaceAll("_", "/"));
}
