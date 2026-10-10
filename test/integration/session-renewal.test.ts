import { beforeEach, describe, expect, it } from "vitest";
import { signValue } from "../../src/crypto/sign";
import {
	clearSessionCookie,
	createSessionCookie,
	readSession,
} from "../../src/http/session";
import { handleFetch } from "../../src/index";
import {
	cookiePair,
	makeCtx,
	request,
	resetDb,
	seedRider,
} from "../support/ctx";
import { ATHLETE_A, NOW } from "../support/fixtures";

// The sign-in lasts 180 days after the last visit: a GET or HEAD with a valid
// session renews the cookie, at most once a day (feature 010 FR-007, research
// R10, contracts/http-routes.md "Session renewal").

const DAY = 86400;
const ctx = makeCtx();

/** A session cookie issued `age` seconds before NOW. */
async function issuedAgo(age: number) {
	return cookiePair(await createSessionCookie(ATHLETE_A, NOW - age, ctx.env));
}

/** A session signed to expire at `expiresAt`, like one from older code. */
async function expiringAt(expiresAt: number) {
	const value = await signValue(
		String(ATHLETE_A),
		expiresAt,
		ctx.env.SESSION_SIGNING_KEY,
		"rp_session",
	);
	return { rp_session: value };
}

function sessionSetCookies(res: Response) {
	return res.headers.getSetCookie().filter((c) => c.startsWith("rp_session="));
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
});

describe("session renewal", () => {
	it("renews a 10-day-old cookie on GET /me to 180 days", async () => {
		const res = await handleFetch(
			request("/me", { cookies: await issuedAgo(10 * DAY) }),
			ctx,
		);
		expect(res.status).toBe(200);
		const [renewed, ...rest] = sessionSetCookies(res);
		expect(rest).toEqual([]);
		expect(renewed).toBe(await createSessionCookie(ATHLETE_A, NOW, ctx.env));
		expect(renewed).toContain("Max-Age=15552000");
		const next = request("/me", { cookies: cookiePair(renewed ?? "") });
		expect(await readSession(next, ctx.env, NOW + 179 * DAY)).toBe(ATHLETE_A);
	});

	it("renews on HEAD too", async () => {
		const res = await handleFetch(
			request("/me", { method: "HEAD", cookies: await issuedAgo(10 * DAY) }),
			ctx,
		);
		expect(sessionSetCookies(res)).toHaveLength(1);
	});

	it("doesn't renew a cookie issued 2 hours ago", async () => {
		const res = await handleFetch(
			request("/me", { cookies: await issuedAgo(2 * 3600) }),
			ctx,
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("Set-Cookie")).toBeNull();
	});

	it("renews a 30-day cookie of the old code with 1 day left", async () => {
		const res = await handleFetch(
			request("/me", { cookies: await expiringAt(NOW + DAY) }),
			ctx,
		);
		expect(sessionSetCookies(res)).toHaveLength(1);
	});

	it("renews on GET / for a signed-in rider, who is sent to /team", async () => {
		const res = await handleFetch(
			request("/", { cookies: await issuedAgo(10 * DAY) }),
			ctx,
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/team");
		expect(sessionSetCookies(res)).toHaveLength(1);
	});

	it.each([
		["expired", () => expiringAt(NOW - 1)],
		[
			"tampered",
			async () => {
				const { rp_session = "" } = await issuedAgo(10 * DAY);
				return { rp_session: rp_session.replace(/^900001/, "900002") };
			},
		],
	])("doesn't renew an %s cookie, and /me sends to /", async (_, cookie) => {
		const res = await handleFetch(
			request("/me", { cookies: await cookie() }),
			ctx,
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
		expect(res.headers.get("Set-Cookie")).toBeNull();
	});

	it.each([
		["GET", "/offline?lang=de"],
		["GET", "/notification-text?lang=de"],
		["GET", "/health"],
	])("never renews on %s %s", async (method, path) => {
		const res = await handleFetch(
			request(path, { method, cookies: await issuedAgo(10 * DAY) }),
			ctx,
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("Set-Cookie")).toBeNull();
	});

	it("never renews on POST /lang", async () => {
		const res = await handleFetch(
			request("/lang", {
				form: { lang: "en", next: "/me" },
				cookies: await issuedAgo(10 * DAY),
			}),
			ctx,
		);
		expect(sessionSetCookies(res)).toEqual([]);
	});

	it("still only clears the cookie on POST /logout", async () => {
		const res = await handleFetch(
			request("/logout", { form: {}, cookies: await issuedAgo(10 * DAY) }),
			ctx,
		);
		expect(res.status).toBe(302);
		expect(res.headers.getSetCookie()).toEqual([clearSessionCookie()]);
	});
});
