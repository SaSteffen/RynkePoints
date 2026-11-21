import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { signValue } from "../../src/crypto/sign";
import { deleteRider, insertRider } from "../../src/db/riders";
import { handleFetch } from "../../src/index";
import { setCookies } from "../support/callback";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";

// Sign out everywhere (issue #314): the session cookie carries the rider's
// epoch, and raising it ends every session, also on routes that read the
// session without the rider. Synthetic athlete IDs only.

let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

async function epochOf(athleteId: string) {
	return env.DB.prepare("SELECT session_epoch FROM riders WHERE athlete_id = ?")
		.bind(athleteId)
		.first<number>("session_epoch");
}

async function endpoints() {
	const { results } = await env.DB.prepare(
		"SELECT endpoint FROM push_subscriptions ORDER BY subscription_id",
	).all<{ endpoint: string }>();
	return results.map((r) => r.endpoint);
}

function signOutEverywhere(cookies: Record<string, string>, origin?: string) {
	return handleFetch(
		request("/logout/everywhere", { form: {}, cookies, origin }),
		ctx,
	);
}

/** A cookie from before issues #314 and #316: the ID alone, signed without the team. */
async function legacyCookie(athleteId: string) {
	const value = await signValue(
		String(athleteId),
		NOW + 100 * 86400,
		ctx.env.SESSION_SIGNING_KEY,
		"rp_session",
	);
	return { rp_session: value };
}

/** Each route that reads the session answers as for a visitor. */
async function expectSignedOut(cookies: Record<string, string>) {
	const get = (path: string) => handleFetch(request(path, { cookies }), ctx);
	const me = await get("/me");
	expect(me.status).toBe(302);
	expect(me.headers.get("Location")).toBe("/");
	// The start page shows itself instead of sending the rider home.
	expect((await get("/")).status).toBe(200);
	expect((await get("/me/ready")).status).toBe(401);
	expect((await get("/me/fetching")).status).toBe(401);
	expect((await get("/me/notification-text")).status).toBe(401);
	expect((await get("/connect")).headers.get("Location")).toBe("/");
}

describe("POST /logout/everywhere", () => {
	it("is a button on the settings page", async () => {
		const res = await handleFetch(
			request("/me/settings", {
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(await res.text()).toContain(
			'<form method="post" action="/logout/everywhere"><button class="settings-row" aria-labelledby="settings-logout-everywhere" aria-describedby="settings-logout-everywhere-sub">',
		);
	});

	it("signs out here, raises the epoch and ends every device's notifications", async () => {
		await seedSubscription(ATHLETE_A, pushEndpoint(1));
		await seedSubscription(ATHLETE_A, pushEndpoint(2));
		await seedSubscription(ATHLETE_B, pushEndpoint(3));
		const res = await signOutEverywhere(await sessionCookie(ctx, ATHLETE_A));
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
		expect(setCookies(res).rp_session).toMatch(/^rp_session=;.*Max-Age=0/);
		// At least the time, so connecting again later can't land on it.
		expect(await epochOf(ATHLETE_A)).toBe(NOW);
		expect(await epochOf(ATHLETE_B)).toBe(0);
		expect(await endpoints()).toEqual([pushEndpoint(3)]);
	});

	it("ends the rider's other sessions, and only theirs", async () => {
		const otherDevice = await sessionCookie(ctx, ATHLETE_A);
		await signOutEverywhere(await sessionCookie(ctx, ATHLETE_A));
		await expectSignedOut(otherDevice);
		await expectSignedOut(await legacyCookie(ATHLETE_A));
		const other = await handleFetch(
			request("/me", { cookies: await sessionCookie(ctx, ATHLETE_B) }),
			ctx,
		);
		expect(other.status).toBe(200);
		// A sign-in afterwards carries the new epoch.
		const again = await handleFetch(
			request("/me", { cookies: await sessionCookie(ctx, ATHLETE_A) }),
			ctx,
		);
		expect(again.status).toBe(200);
	});

	it("raises the epoch again when pressed twice in a second", async () => {
		await signOutEverywhere(await sessionCookie(ctx, ATHLETE_A));
		await signOutEverywhere(await sessionCookie(ctx, ATHLETE_A));
		expect(await epochOf(ATHLETE_A)).toBe(NOW + 1);
	});

	it("only clears the cookie of a session already ended", async () => {
		await signOutEverywhere(await sessionCookie(ctx, ATHLETE_A));
		const res = await signOutEverywhere(await sessionCookie(ctx, ATHLETE_A, 0));
		expect(setCookies(res).rp_session).toMatch(/^rp_session=;.*Max-Age=0/);
		expect(await epochOf(ATHLETE_A)).toBe(NOW);
	});

	it("is refused from a foreign Origin", async () => {
		const res = await signOutEverywhere(
			await sessionCookie(ctx, ATHLETE_A),
			"https://evil.example",
		);
		expect(res.status).toBe(403);
		expect(res.headers.get("Set-Cookie")).toBeNull();
		expect(await epochOf(ATHLETE_A)).toBe(0);
	});
});

describe("connecting again after a disconnect", () => {
	it("doesn't bring back a cookie from before", async () => {
		const before = await sessionCookie(ctx, ATHLETE_A);
		const legacy = await legacyCookie(ATHLETE_A);
		await deleteRider(env.DB, ATHLETE_A);
		await insertRider(
			env.DB,
			{
				athleteId: ATHLETE_A,
				firstName: "Testrider A",
				scopes: "read,activity:read",
				scopeReadAll: false,
				now: NOW,
				guest: false,
			},
			{ version: 1, acceptedAt: NOW },
		);
		expect(await epochOf(ATHLETE_A)).toBe(NOW);
		await expectSignedOut(before);
		await expectSignedOut(legacy);
	});
});
