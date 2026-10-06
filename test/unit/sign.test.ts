import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signValue, verifySignedValue } from "../../src/crypto/sign";

const KEY = env.SESSION_SIGNING_KEY;
const NOW = 1_791_000_000;

describe("signValue / verifySignedValue", () => {
	it("verifies a valid value", async () => {
		const signed = await signValue("900001", NOW + 60, KEY);
		expect(signed).toMatch(/^900001\.\d+\.[A-Za-z0-9_-]+$/);
		expect(await verifySignedValue(signed, KEY, NOW)).toBe("900001");
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
		const last = signed.at(-1) === "A" ? "B" : "A";
		expect(
			await verifySignedValue(`${signed.slice(0, -1)}${last}`, KEY, NOW),
		).toBeNull();
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
