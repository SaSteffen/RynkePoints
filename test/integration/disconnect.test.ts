import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { handleFetch } from "../../src/index";
import { toActivityRecord } from "../../src/strava/activity";
import { setCookies } from "../support/callback";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
} from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => fake.restore());

async function seedConnected() {
	fake.addAthlete({ id: ATHLETE_A });
	const rider = await seedRider(ctx, { consentVersion: 1 });
	const record = toActivityRecord(makeStravaActivity(), ATHLETE_A, NOW);
	if (!record) throw new Error("fixture is not a cycling activity");
	await upsertActivity(env.DB, record);
	return rider;
}

async function page(path: string, cookies: Record<string, string> = {}) {
	const res = await handleFetch(request(path, { cookies }), ctx);
	return { res, text: await res.text() };
}

async function disconnect(
	options: { session?: boolean; origin?: string | null } = {},
) {
	const cookies =
		options.session === false ? {} : await sessionCookie(ctx, ATHLETE_A);
	return handleFetch(
		request("/me/disconnect", {
			method: "POST",
			cookies,
			origin: options.origin,
		}),
		ctx,
	);
}

async function expectNothingDeleted() {
	expect(await tableCounts()).toMatchObject({
		riders: 1,
		strava_credentials: 1,
		activities: 1,
		consent_records: 1,
	});
	expect(fake.callsTo("revoke")).toEqual([]);
}

describe("GET /me/disconnect", () => {
	it("shows the German confirmation page", async () => {
		await seedConnected();
		const { res, text } = await page(
			"/me/disconnect",
			await sessionCookie(ctx, ATHLETE_A),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Language")).toBe("de");
		expect(text).toContain("<title>Daten löschen?</title>");
		expect(text).toContain("<h1>Daten löschen?</h1>");
		expect(text).toContain(
			"RynkePoints gibt den Zugriff auf dein Strava-Konto zurück und löscht sofort alle Daten über dich.",
		);
		expect(text).toMatch(
			/<form method="post" action="\/me\/disconnect"><button class="danger">Ja, alles löschen<\/button><\/form>/,
		);
		expect(text).toContain(
			'<a class="button-outlined" href="/me">Abbrechen</a>',
		);
		expect(text).toContain('name="next" value="/me/disconnect"');
		expect(fake.calls).toEqual([]);
	});

	it("redirects when signed out", async () => {
		const { res } = await page("/me/disconnect");
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});
});

describe("GET /me/settings links to the disconnect page", () => {
	it("shows the disconnect button", async () => {
		await seedConnected();
		const { text } = await page(
			"/me/settings",
			await sessionCookie(ctx, ATHLETE_A),
		);
		expect(text).toContain(
			'<a href="/me/disconnect">Verbindung trennen und meine Daten löschen</a>',
		);
	});
});

describe("POST /me/disconnect refused", () => {
	it.each([
		["without a session", { session: false }],
		["without an Origin", { origin: null }],
		["with a foreign Origin", { origin: "https://evil.example" }],
	] as const)("is refused %s", async (_name, options) => {
		await seedConnected();
		const res = await disconnect(options);
		expect(res.status).toBe(403);
		expect(res.headers.get("Content-Language")).toBe("de");
		expect(await res.text()).toContain("Anfrage abgelehnt");
		await expectNothingDeleted();
	});
});

describe("POST /me/disconnect", () => {
	it("revokes, deletes everything, signs out and confirms", async () => {
		const rider = await seedConnected();
		const res = await disconnect();
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/notice/deleted");
		expect(setCookies(res).rp_session).toMatch(/^rp_session=;.*Max-Age=0/);
		expect(fake.revocations).toEqual([
			{ token: rider.refreshToken, kind: "refresh" },
		]);
		expect(await tableCounts()).toMatchObject({
			riders: 0,
			strava_credentials: 0,
			activities: 0,
			consent_records: 0,
			failed_work: 0,
		});

		const { text } = await page("/notice/deleted");
		expect(text).toContain("Deine Daten wurden gelöscht");
		expect(text).toContain("spätestens nach 7 Tagen");
	});

	it("retries a 503 once", async () => {
		await seedConnected();
		fake.failNext("revoke", { status: 503 });
		const res = await disconnect();
		expect(res.headers.get("Location")).toBe("/notice/deleted");
		expect(fake.callsTo("revoke")).toHaveLength(2);
		expect((await tableCounts()).riders).toBe(0);
	});

	it("still deletes when the revoke fails twice, and says so", async () => {
		await seedConnected();
		fake.failNext("revoke", { status: 503 });
		fake.failNext("revoke", { status: 503 });
		const res = await disconnect();
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/notice/deleted-revoke-failed");
		expect(fake.callsTo("revoke")).toHaveLength(2);
		expect(await tableCounts()).toMatchObject({
			riders: 0,
			strava_credentials: 0,
			activities: 0,
			consent_records: 0,
		});

		const { text } = await page("/notice/deleted-revoke-failed");
		expect(text).toContain("Deine Daten wurden gelöscht");
		expect(text).toContain("„Meine Apps“");
	});

	it("shows the confirmation in English after a language switch", async () => {
		await seedConnected();
		await disconnect();
		const revokes = fake.callsTo("revoke").length;
		const switched = await handleFetch(
			request("/lang", { form: { lang: "en", next: "/notice/deleted" } }),
			ctx,
		);
		expect(switched.status).toBe(303);
		expect(switched.headers.get("Location")).toBe("/notice/deleted");
		const { text } = await page("/notice/deleted", { rp_lang: "en" });
		expect(text).toContain("Your data has been deleted");
		// Nothing was re-submitted.
		expect(fake.callsTo("revoke")).toHaveLength(revokes);
	});
});

describe("POST /logout", () => {
	it("clears the session and goes home", async () => {
		await seedConnected();
		const res = await handleFetch(
			request("/logout", {
				method: "POST",
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
		expect(setCookies(res).rp_session).toMatch(/^rp_session=;.*Max-Age=0/);
		// Signing out deletes nothing.
		expect((await tableCounts()).riders).toBe(1);
	});

	describe("with this device's push endpoint (FR-013, research R9)", () => {
		async function logout(form: Record<string, string>) {
			const res = await handleFetch(
				request("/logout", {
					form,
					cookies: await sessionCookie(ctx, ATHLETE_A),
				}),
				ctx,
			);
			expect(res.status).toBe(302);
			expect(setCookies(res).rp_session).toMatch(/^rp_session=;.*Max-Age=0/);
		}

		async function endpoints() {
			const { results } = await env.DB.prepare(
				"SELECT endpoint FROM push_subscriptions ORDER BY subscription_id",
			).all<{ endpoint: string }>();
			return results.map((r) => r.endpoint);
		}

		beforeEach(async () => {
			await seedConnected();
			await seedRider(ctx, { athleteId: ATHLETE_B });
			await seedSubscription(ATHLETE_A, pushEndpoint(1));
			await seedSubscription(ATHLETE_A, pushEndpoint(2));
			await seedSubscription(ATHLETE_B, pushEndpoint(3));
		});

		it("deletes that device only", async () => {
			await logout({ push_endpoint: pushEndpoint(1) });
			expect(await endpoints()).toEqual([pushEndpoint(2), pushEndpoint(3)]);
		});

		it("deletes nothing for another rider's endpoint", async () => {
			await logout({ push_endpoint: pushEndpoint(3) });
			expect(await endpoints()).toHaveLength(3);
		});

		it.each<[string, Record<string, string>]>([
			["without the field", {}],
			["with an empty field", { push_endpoint: "" }],
		])("only signs out %s", async (_, form) => {
			await logout(form);
			expect(await endpoints()).toHaveLength(3);
		});
	});

	it("is refused from a foreign Origin", async () => {
		await seedConnected();
		const res = await handleFetch(
			request("/logout", {
				method: "POST",
				cookies: await sessionCookie(ctx, ATHLETE_A),
				origin: "https://evil.example",
			}),
			ctx,
		);
		expect(res.status).toBe(403);
		expect(res.headers.get("Set-Cookie")).toBeNull();
	});
});
