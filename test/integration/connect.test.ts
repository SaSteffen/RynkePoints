import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_VERSIONS } from "../../src/consent";
import { readOAuthState } from "../../src/http/session";
import { handleFetch } from "../../src/index";
import {
	cookiePair,
	makeCtx,
	ORIGIN,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";

// The consent form's target and the signed-in reconnect link
// (contracts/http-routes.md, research R21).

const ctx = makeCtx();
const SCOPE = "read,activity:read,activity:read_all,activity:write";

beforeEach(resetDb);

function connectForm(
	form: Record<string, string>,
	origin?: string | null,
): Promise<Response> {
	return handleFetch(
		request("/connect", { method: "POST", form, origin }),
		ctx,
	);
}

function expectAuthorize(res: Response): URLSearchParams {
	expect(res.status).toBe(302);
	const location = new URL(res.headers.get("Location") ?? "");
	expect(`${location.origin}${location.pathname}`).toBe(
		"https://www.strava.com/oauth/authorize",
	);
	return location.searchParams;
}

async function stateCookie(res: Response) {
	const setCookie = res.headers.get("Set-Cookie") ?? "";
	expect(setCookie).toMatch(/^rp_oauth_state=.*; Max-Age=600$/);
	const back = request("/auth/callback", { cookies: cookiePair(setCookie) });
	return readOAuthState(back, ctx.env, ctx.now());
}

describe("POST /connect with the box ticked", () => {
	it("redirects to Strava's authorize page with all four scopes", async () => {
		const params = expectAuthorize(await connectForm({ consent: "1" }));
		expect(params.get("client_id")).toBe("10001");
		expect(params.get("redirect_uri")).toBe(`${ORIGIN}/auth/callback`);
		expect(params.get("response_type")).toBe("code");
		expect(params.get("approval_prompt")).toBe("force");
		expect(params.get("scope")).toBe(SCOPE);
		expect(params.get("state")).toMatch(/^[A-Za-z0-9_-]{16,}$/);
	});

	it("stores the same state and consent version 1 in rp_oauth_state", async () => {
		const res = await connectForm({ consent: "1" });
		const state = expectAuthorize(res).get("state");
		expect(await stateCookie(res)).toEqual({
			state,
			consentVersion: 1,
			next: "/me",
		});
	});

	it.each([
		["/team", "/team"],
		["/me/rides?page=2", "/me/rides?page=2"],
		["/", "/me"],
		["https://evil.example/", "/me"],
		["/me:evil", "/me"],
	])("stores next=%s as %s (011 R9)", async (next, stored) => {
		const res = await connectForm({ consent: "1", next });
		const state = expectAuthorize(res).get("state");
		expect(await stateCookie(res)).toEqual({
			state,
			consentVersion: 1,
			next: stored,
		});
		const raw = res.headers.get("Set-Cookie") ?? "";
		expect(raw).toContain(`rp_oauth_state=${state}:1:${stored}.`);
	});

	it("uses a fresh state every time", async () => {
		const states = await Promise.all(
			[1, 2].map(async () =>
				expectAuthorize(await connectForm({ consent: "1" })).get("state"),
			),
		);
		expect(states[0]).not.toBe(states[1]);
	});
});

describe("POST /connect without agreement", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => fetchSpy.mockRestore());

	it.each([
		["no consent field", {}],
		["consent=0", { consent: "0" }],
		["consent=2", { consent: "2" }],
	])("sends %s to /notice/consent-required", async (_name, form) => {
		const res = await connectForm(form);
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/notice/consent-required");
		expect(res.headers.get("Set-Cookie")).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it.each([
		["a foreign", "https://evil.example"],
		["no", null],
	])(
		"refuses %s Origin with the German forbidden page",
		async (_name, origin) => {
			const res = await connectForm({ consent: "1" }, origin);
			expect(res.status).toBe(403);
			expect(await res.text()).toContain("Anfrage abgelehnt");
			expect(res.headers.get("Set-Cookie")).toBeNull();
		},
	);
});

describe("POST /connect after a new consent version (004 research R11)", () => {
	const v2Ctx = makeCtx({
		consentVersions: [
			...CONSENT_VERSIONS,
			{
				version: 2,
				published: "2026-11-01",
				requiredScopes: ["read", "activity:read"],
				changes: ["consent.team"],
			},
		],
	});

	function post(consent: string) {
		return handleFetch(
			request("/connect", { method: "POST", form: { consent } }),
			v2Ctx,
		);
	}

	it("accepts the current version", async () => {
		const res = await post("2");
		expectAuthorize(res);
		const back = request("/auth/callback", {
			cookies: cookiePair(res.headers.get("Set-Cookie") ?? ""),
		});
		expect(
			(await readOAuthState(back, v2Ctx.env, v2Ctx.now()))?.consentVersion,
		).toBe(2);
	});

	it("refuses an older version like a missing tick", async () => {
		const res = await post("1");
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/notice/consent-required");
	});
});

describe("GET /connect", () => {
	it("sends a signed-out visitor to the start page", async () => {
		const res = await handleFetch(request("/connect"), ctx);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
		expect(res.headers.get("Set-Cookie")).toBeNull();
	});

	it("treats a session for a deleted rider as signed out", async () => {
		const res = await handleFetch(
			request("/connect", { cookies: await sessionCookie(ctx, ATHLETE_A) }),
			ctx,
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it("sends a signed-in rider to Strava without a new agreement", async () => {
		await seedRider(ctx);
		const res = await handleFetch(
			request("/connect", { cookies: await sessionCookie(ctx, ATHLETE_A) }),
			ctx,
		);
		const params = expectAuthorize(res);
		expect(params.get("scope")).toBe(SCOPE);
		expect(await stateCookie(res)).toEqual({
			state: params.get("state"),
			consentVersion: 0,
			next: "/me",
		});
	});
});
