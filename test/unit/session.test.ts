import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
	clearSessionCookie,
	createOAuthStateCookie,
	createSessionCookie,
	isSameOrigin,
	readOAuthState,
	readSession,
} from "../../src/http/session";

const NOW = 1_791_000_000;

function withCookie(setCookie: string) {
	const pair = setCookie.split(";")[0] ?? "";
	return new Request("https://rynke.test/me", { headers: { Cookie: pair } });
}

describe("session cookie", () => {
	it("is signed and long-lived", async () => {
		const cookie = await createSessionCookie(900001, NOW, env);
		expect(cookie).toMatch(
			new RegExp(
				`^rp_session=900001\\.${NOW + 2592000}\\.[A-Za-z0-9_-]+; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000$`,
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
			await readSession(withCookie(cookie), env, NOW + 2592001),
		).toBeNull();
		expect(
			await readSession(new Request("https://rynke.test/"), env, NOW),
		).toBeNull();
	});

	it("can be cleared", () => {
		expect(clearSessionCookie()).toBe(
			"rp_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
		);
	});
});

describe("OAuth state cookie", () => {
	it("lasts 10 minutes", async () => {
		const cookie = await createOAuthStateCookie("abc123", NOW, env);
		expect(cookie).toMatch(/^rp_oauth_state=abc123\.\d+\.[A-Za-z0-9_-]+;/);
		expect(cookie).toContain("Max-Age=600");
		expect(cookie).toContain("HttpOnly");
		expect(await readOAuthState(withCookie(cookie), env, NOW + 599)).toBe(
			"abc123",
		);
		expect(await readOAuthState(withCookie(cookie), env, NOW + 601)).toBeNull();
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
