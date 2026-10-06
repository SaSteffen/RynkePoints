import { describe, expect, it } from "vitest";
import { readOAuthState } from "../../src/http/session";
import { handleFetch } from "../../src/index";
import { cookiePair, makeCtx, ORIGIN, request } from "../support/ctx";

const ctx = makeCtx();

describe("GET /connect", () => {
	it("redirects to Strava's authorize page with a random state", async () => {
		const res = await handleFetch(request("/connect"), ctx);
		expect(res.status).toBe(302);
		const location = new URL(res.headers.get("Location") ?? "");
		expect(`${location.origin}${location.pathname}`).toBe(
			"https://www.strava.com/oauth/authorize",
		);
		const params = location.searchParams;
		expect(params.get("client_id")).toBe("10001");
		expect(params.get("redirect_uri")).toBe(`${ORIGIN}/auth/callback`);
		expect(params.get("response_type")).toBe("code");
		expect(params.get("approval_prompt")).toBe("force");
		expect(params.get("scope")).toBe("read,activity:read,activity:read_all");
		expect(params.get("state")).toMatch(/^[A-Za-z0-9_-]{16,}$/);
	});

	it("stores the same state in the rp_oauth_state cookie", async () => {
		const res = await handleFetch(request("/connect"), ctx);
		const state = new URL(res.headers.get("Location") ?? "").searchParams.get(
			"state",
		);
		const setCookie = res.headers.get("Set-Cookie") ?? "";
		expect(setCookie).toMatch(/^rp_oauth_state=.*; Max-Age=600$/);
		const back = request("/auth/callback", { cookies: cookiePair(setCookie) });
		expect(await readOAuthState(back, ctx.env, ctx.now())).toBe(state);
	});

	it("uses a fresh state every time", async () => {
		const states = await Promise.all(
			[1, 2].map(async () => {
				const res = await handleFetch(request("/connect"), ctx);
				return new URL(res.headers.get("Location") ?? "").searchParams.get(
					"state",
				);
			}),
		);
		expect(states[0]).not.toBe(states[1]);
	});
});
