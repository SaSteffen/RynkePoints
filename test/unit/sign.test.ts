import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signValue, verifySignedValue } from "../../src/crypto/sign";

const KEY = env.SESSION_SIGNING_KEY;
const NOW = 1_791_000_000;

describe("signValue / verifySignedValue", () => {
	it("verifies a valid value", async () => {
		const signed = await signValue("900001", NOW + 60, KEY);
		expect(signed).toMatch(/^900001\.\d+\.[A-Za-z0-9_-]+$/);
		expect(await verifySignedValue(signed, KEY, NOW)).toEqual({
			value: "900001",
			expiresAt: NOW + 60,
		});
	});

	it("rejects a tampered payload", async () => {
		const signed = await signValue("900001", NOW + 60, KEY);
		const tampered = signed.replace(/^900001/, "900002");
		expect(await verifySignedValue(tampered, KEY, NOW)).toBeNull();
	});

	it("rejects a tampered expiry", async () => {
		const signed = await signValue("900001", NOW + 60, KEY);
		const [value, , sig] = signed.split(".");
		expect(
			await verifySignedValue(`${value}.${NOW + 99999}.${sig}`, KEY, NOW),
		).toBeNull();
	});

	it("rejects a tampered signature", async () => {
		const signed = await signValue("900001", NOW + 60, KEY);
		const [payload, sig] = [
			signed.slice(0, signed.lastIndexOf(".") + 1),
			signed.slice(signed.lastIndexOf(".") + 1),
		];
		const mid = Math.floor(sig.length / 2);
		const flipped = sig[mid] === "A" ? "B" : "A";
		const tampered = `${payload}${sig.slice(0, mid)}${flipped}${sig.slice(mid + 1)}`;
		expect(await verifySignedValue(tampered, KEY, NOW)).toBeNull();
	});

	it("rejects a non-canonical spelling of a valid signature", async () => {
		const signed = await signValue("900001", NOW + 60, KEY);
		// 32 bytes → 43 chars; the last char carries 2 unused bits.
		const last = signed.at(-1) ?? "A";
		const alphabet =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
		const sibling = alphabet[alphabet.indexOf(last) ^ 1] ?? "A";
		expect(
			await verifySignedValue(`${signed.slice(0, -1)}${sibling}`, KEY, NOW),
		).toBeNull();
	});

	it("binds the signature to its context", async () => {
		const signed = await signValue("900001", NOW + 60, KEY, "rp_oauth_state");
		expect(await verifySignedValue(signed, KEY, NOW, "rp_oauth_state")).toEqual(
			{ value: "900001", expiresAt: NOW + 60 },
		);
		expect(await verifySignedValue(signed, KEY, NOW, "rp_session")).toBeNull();
		expect(await verifySignedValue(signed, KEY, NOW)).toBeNull();
	});

	it("rejects an expired value", async () => {
		const signed = await signValue("900001", NOW - 1, KEY);
		expect(await verifySignedValue(signed, KEY, NOW)).toBeNull();
	});

	it("rejects garbage", async () => {
		expect(await verifySignedValue("", KEY, NOW)).toBeNull();
		expect(await verifySignedValue("abc", KEY, NOW)).toBeNull();
		expect(await verifySignedValue("a.b.c", KEY, NOW)).toBeNull();
	});
});
