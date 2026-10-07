import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { vapidAuthorization, vapidPublicKey } from "../../src/push/vapid";
import { NOW } from "../support/fixtures";

// VAPID with the synthetic test key of vitest.config.ts (feature 010 research
// R4, contracts/push-delivery.md "Push request").

const ORIGIN = "https://fcm.googleapis.com";

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const decodeJson = (part: string) =>
	JSON.parse(new TextDecoder().decode(fromBase64Url(part)));

function parse(header: string) {
	const match = /^vapid t=([^,]+), k=(.+)$/.exec(header);
	if (!match?.[1] || !match[2])
		throw new Error(`not a VAPID header: ${header}`);
	return { token: match[1], key: match[2] };
}

describe("vapidPublicKey", () => {
	it("is the uncompressed point 0x04‖x‖y of the JWK", () => {
		const { x, y } = JSON.parse(env.PUSH_VAPID_KEY);
		const bytes = fromBase64Url(vapidPublicKey(env));
		expect(bytes).toHaveLength(65);
		expect(bytes[0]).toBe(0x04);
		expect(bytes.slice(1, 33)).toEqual(fromBase64Url(x));
		expect(bytes.slice(33)).toEqual(fromBase64Url(y));
	});
});

describe("vapidAuthorization", () => {
	it("is an ES256 JWT for the origin that verifies with the public key", async () => {
		const { token, key } = parse(await vapidAuthorization(ORIGIN, env, NOW));
		expect(key).toBe(vapidPublicKey(env));
		const [header = "", claims = "", signature = ""] = token.split(".");
		expect(decodeJson(header)).toEqual({ typ: "JWT", alg: "ES256" });
		expect(decodeJson(claims)).toEqual({
			aud: ORIGIN,
			exp: NOW + 43200,
			sub: env.PUSH_SUBJECT,
		});

		const publicKey = await crypto.subtle.importKey(
			"raw",
			fromBase64Url(key),
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["verify"],
		);
		const valid = await crypto.subtle.verify(
			{ name: "ECDSA", hash: "SHA-256" },
			publicKey,
			fromBase64Url(signature),
			new TextEncoder().encode(`${header}.${claims}`),
		);
		expect(valid).toBe(true);
	});

	it("reuses the token within the hour, per origin", async () => {
		const first = await vapidAuthorization(ORIGIN, env, NOW);
		expect(await vapidAuthorization(ORIGIN, env, NOW + 3000)).toBe(first);
		const other = await vapidAuthorization(
			"https://web.push.apple.com",
			env,
			NOW,
		);
		expect(parse(other).token).not.toBe(parse(first).token);
	});
});
