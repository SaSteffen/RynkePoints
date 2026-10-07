import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signValue } from "../../src/crypto/sign";
import {
	clearSessionCookie,
	createOAuthStateCookie,
	createSessionCookie,
	isSameOrigin,
	readOAuthState,
	readSession,
	readSessionExpiry,
} from "../../src/http/session";

const NOW = 1_791_000_000;

function withCookie(setCookie: string) {
	const pair = setCookie.split(";")[0] ?? "";
	return new Request("https://rynke.test/me", { headers: { Cookie: pair } });
}

describe("session cookie", () => {
	it("is signed and lasts 180 days (010 FR-007)", async () => {
		const cookie = await createSessionCookie(900001, NOW, env);
		expect(cookie).toMatch(
			new RegExp(
				`^rp_session=900001\\.${NOW + 15552000}\\.[A-Za-z0-9_-]+; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=15552000$`,
			),
		);
	});

	it("reads back the athlete ID", async () => {
		const cookie = await createSessionCookie(900001, NOW, env);
		expect(await readSession(withCookie(cookie), env, NOW + 10)).toBe(900001);
	});

	it("rejects tampered, expired and missing sessions", async () => {
		const cookie = await createSessionCookie(900001, NOW, env);
		const tampered = cookie.replace("rp_session=900001", "rp_session=900002");
		expect(await readSession(withCookie(tampered), env, NOW)).toBeNull();
		expect(
			await readSession(withCookie(cookie), env, NOW + 15552001),
		).toBeNull();
		expect(
			await readSession(new Request("https://rynke.test/"), env, NOW),
		).toBeNull();
	});

	it("reads back the athlete ID with the expiry", async () => {
		const cookie = await createSessionCookie(900001, NOW, env);
		expect(await readSessionExpiry(withCookie(cookie), env, NOW + 10)).toEqual({
			athleteId: 900001,
			expiresAt: NOW + 15552000,
		});
	});

	it("reads no expiry of a missing, tampered or expired session", async () => {
		const cookie = await createSessionCookie(900001, NOW, env);
		const tampered = cookie.replace("rp_session=900001", "rp_session=900002");
		expect(
			await readSessionExpiry(new Request("https://rynke.test/"), env, NOW),
		).toBeNull();
		expect(await readSessionExpiry(withCookie(tampered), env, NOW)).toBeNull();
		expect(
			await readSessionExpiry(withCookie(cookie), env, NOW + 15552001),
		).toBeNull();
	});

	it("does not accept an OAuth state cookie as a session", async () => {
		const state = await createOAuthStateCookie("900001", 1, NOW, env);
		const value = (state.split(";")[0] ?? "").split("=")[1] ?? "";
		const forged = new Request("https://rynke.test/me", {
			headers: { Cookie: `rp_session=${value}` },
		});
		expect(await readSession(forged, env, NOW)).toBeNull();
	});

	it("can be cleared", () => {
		expect(clearSessionCookie()).toBe(
			"rp_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
		);
	});
});

describe("OAuth state cookie", () => {
	/** A cookie whose value is signed as given, like one from an older deploy. */
	async function rawStateCookie(value: string) {
		const signed = await signValue(
			value,
			NOW + 600,
			env.SESSION_SIGNING_KEY,
			"rp_oauth_state",
		);
		return `rp_oauth_state=${signed}; Max-Age=600`;
	}

	it("lasts 10 minutes", async () => {
		const cookie = await createOAuthStateCookie("abc123", 1, NOW, env);
		expect(cookie).toContain("Max-Age=600");
		expect(cookie).toContain("HttpOnly");
		expect(await readOAuthState(withCookie(cookie), env, NOW + 599)).toEqual({
			state: "abc123",
			consentVersion: 1,
		});
		expect(await readOAuthState(withCookie(cookie), env, NOW + 601)).toBeNull();
	});

	it("signs the state and the consent version, separated by a colon", async () => {
		const cookie = await createOAuthStateCookie("abc", 1, NOW, env);
		expect(cookie).toMatch(/^rp_oauth_state=abc:1\.\d+\.[A-Za-z0-9_-]+;/);
	});

	it("carries consent version 0 for a rider who didn't agree", async () => {
		const cookie = await createOAuthStateCookie("abc", 0, NOW, env);
		expect(await readOAuthState(withCookie(cookie), env, NOW)).toEqual({
			state: "abc",
			consentVersion: 0,
		});
	});

	it.each(["abc", "abc:x", "abc:", "abc:-1"])(
		"rejects the signed value %s",
		async (value) => {
			const cookie = await rawStateCookie(value);
			expect(await readOAuthState(withCookie(cookie), env, NOW)).toBeNull();
		},
	);

	it("rejects a tampered cookie", async () => {
		const cookie = await createOAuthStateCookie("abc", 0, NOW, env);
		const tampered = cookie.replace("abc:0", "abc:1");
		expect(await readOAuthState(withCookie(tampered), env, NOW)).toBeNull();
	});
});

describe("isSameOrigin", () => {
	const post = (origin?: string) =>
		new Request("https://rynke.test/lang", {
			method: "POST",
			headers: origin ? { Origin: origin } : {},
		});

	it("accepts the request's own origin", () => {
		expect(isSameOrigin(post("https://rynke.test"))).toBe(true);
	});

	it("rejects missing and foreign origins", () => {
		expect(isSameOrigin(post())).toBe(false);
		expect(isSameOrigin(post("https://evil.example"))).toBe(false);
		expect(isSameOrigin(post("http://rynke.test"))).toBe(false);
		expect(isSameOrigin(post("null"))).toBe(false);
	});
});
