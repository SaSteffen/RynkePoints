import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../../src/crypto/encrypt";

const KEY = env.TOKEN_ENCRYPTION_KEY;
// A different synthetic 32-byte key (bytes 0x40..0x5f).
const OTHER_KEY = "QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8=";
const PLAINTEXT = "synthetic-refresh-token-900001";

describe("encryptToken / decryptToken", () => {
	it("round-trips", async () => {
		const encrypted = await encryptToken(PLAINTEXT, KEY);
		expect(await decryptToken(encrypted, KEY)).toBe(PLAINTEXT);
	});

	it("writes the v1:<iv>:<ciphertext> format", async () => {
		const encrypted = await encryptToken(PLAINTEXT, KEY);
		expect(encrypted).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
	});

	it("uses a fresh random IV for every encryption", async () => {
		const a = await encryptToken(PLAINTEXT, KEY);
		const b = await encryptToken(PLAINTEXT, KEY);
		expect(a).not.toBe(b);
		expect(a.split(":")[1]).not.toBe(b.split(":")[1]);
	});

	it("rejects a tampered ciphertext", async () => {
		const [version, iv, ciphertext] = (
			await encryptToken(PLAINTEXT, KEY)
		).split(":") as [string, string, string];
		const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
		bytes[0] = (bytes[0] ?? 0) ^ 0xff;
		const tampered = `${version}:${iv}:${btoa(String.fromCharCode(...bytes))}`;
		await expect(decryptToken(tampered, KEY)).rejects.toThrow();
	});

	it("rejects the wrong key", async () => {
		const encrypted = await encryptToken(PLAINTEXT, KEY);
		await expect(decryptToken(encrypted, OTHER_KEY)).rejects.toThrow();
	});

	it("never contains the plaintext", async () => {
		const encrypted = await encryptToken(PLAINTEXT, KEY);
		expect(encrypted).not.toContain(PLAINTEXT);
		expect(encrypted).not.toContain(btoa(PLAINTEXT));
	});
});
