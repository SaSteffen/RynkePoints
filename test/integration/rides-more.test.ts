import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteActivityStatement } from "../../src/db/activities";
import { RIDE_BATCH_SQL } from "../../src/db/rider-view";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import {
	rideCards,
	riderPage,
	seedBalance,
	seedRide,
	seedRides,
} from "../support/rider-view";

// The next rides of the continuous list (feature 018 contracts/http-routes.md,
// research R1–R3, R9). Synthetic riders and rides only.

const ctx = makeCtx();

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedBalance(ATHLETE_A);
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** The ids of the rides on a page or in a batch, in order. */
function ids(html: string): number[] {
	return [
		...html.matchAll(/class="tap strava-activity" href="[^"]*\/(\d+)"/g),
	].map((m) => Number(m[1]));
}

/** The list's `data-more`, `null` without one. */
function more(html: string): string | null {
	return html.match(/<ol class="ride-list" data-more="([^"]*)">/)?.[1] ?? null;
}

/** `n` consecutive ids from `first`, the order `seedRides` lists them. */
function range(first: number, n: number): number[] {
	return Array.from({ length: n }, (_, i) => first + i);
}

async function batch(
	path: string,
	athleteId = ATHLETE_A,
	options: { acceptLanguage?: string; method?: string } = {},
): Promise<Response> {
	return handleFetch(
		request(path, {
			...options,
			cookies: await sessionCookie(ctx, athleteId),
		}),
		ctx,
	);
}

/** The first page's `data-more`, which every batch chain starts from. */
async function firstMore(): Promise<string> {
	const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides");
	const url = more(html);
	if (url === null) throw new Error("no data-more on the first page");
	return url;
}

describe("GET /me/rides/more reading through (018 US1)", () => {
	it("FR-002, FR-004: continues the list in batches of 20 until the end", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const first = await firstMore();
		expect(first).toBe(
			"/me/rides/more?after=2026-09-17T08%3A00%3A00Z~8000020",
		);

		const second = await batch(first);
		expect(second.status).toBe(200);
		const secondHtml = await second.text();
		expect(ids(secondHtml)).toEqual(range(8_000_021, 20));
		expect(secondHtml).toMatch(/^<ol class="ride-list" data-more="[^"]+">\n/);

		const next = more(secondHtml);
		if (next === null) throw new Error("no data-more after ride 40");
		const third = await (await batch(next)).text();
		expect(ids(third)).toEqual(range(8_000_041, 5));
		expect(more(third)).toBeNull();
		expect(third).toMatch(/^<ol class="ride-list">\n[\s\S]*<\/ol>$/);
	});

	it("FR-006: renders the same cards as the page", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const fromBatch = await (await batch(await firstMore())).text();
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides?page=2");
		expect(rideCards(fromBatch)).toEqual(rideCards(html));
	});

	it("SC-003: neither repeats nor skips a ride when rides come and go", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const first = await firstMore();
		// A new ride on top, the key's own ride and the next one deleted.
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			start_date: "2026-10-07T08:00:00Z",
			result: { counts: true, distanceRynke: 4 },
		});
		await env.DB.batch([
			deleteActivityStatement(env.DB, ATHLETE_A, 8_000_020),
			deleteActivityStatement(env.DB, ATHLETE_A, 8_000_021),
		]);
		const html = await (await batch(first)).text();
		expect(ids(html)).toEqual(range(8_000_022, 20));
	});

	it("orders rides of the same second by id", async () => {
		for (const id of [9_000_001, 9_000_002, 9_000_003]) {
			await seedRide(ATHLETE_A, {
				id,
				start_date: "2026-09-01T08:00:00Z",
				result: { counts: true },
			});
		}
		const html = await (
			await batch("/me/rides/more?after=2026-09-01T08%3A00%3A00Z~9000003")
		).text();
		expect(ids(html)).toEqual([9_000_002, 9_000_001]);
		expect(more(html)).toBeNull();
	});

	it("R5: takes up to the limit asked for", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const first = await firstMore();
		const all = await (await batch(`${first}&limit=25`)).text();
		expect(ids(all)).toEqual(range(8_000_021, 25));
		expect(more(all)).toBeNull();
		const five = await (await batch(`${first}&limit=5`)).text();
		expect(ids(five)).toEqual(range(8_000_021, 5));
		expect(more(five)).toBe(
			"/me/rides/more?after=2026-09-12T08%3A00%3A00Z~8000025",
		);
	});

	it("answers an empty list after the last ride", async () => {
		await seedRides(ATHLETE_A, 3, "2026-10-06");
		const res = await batch(
			"/me/rides/more?after=2026-10-04T08%3A00%3A00Z~8000003",
		);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe('<ol class="ride-list">\n</ol>');
	});

	it("speaks the rider's language", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const res = await batch(await firstMore(), ATHLETE_A, {
			acceptLanguage: "en",
		});
		expect(res.headers.get("Content-Language")).toBe("en");
		expect(await res.text()).toContain(">View on Strava</a>");
	});
});

describe("GET /me/rides/more access (018 FR-010, R3)", () => {
	const PATH = "/me/rides/more?after=2026-09-17T08%3A00%3A00Z~8000020";

	it("refuses a request without a session", async () => {
		const res = await handleFetch(request(PATH), ctx);
		expect(res.status).toBe(401);
		expect(await res.text()).toBe("");
	});

	it("refuses a rider who hasn't agreed", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, consentVersion: null });
		await seedBalance(ATHLETE_B);
		const res = await batch(PATH, ATHLETE_B);
		expect(res.status).toBe(403);
		expect(await res.text()).toBe("");
	});

	it("answers 409 in the waiting state", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		const res = await batch(PATH, ATHLETE_B);
		expect(res.status).toBe(409);
		expect(await res.text()).toBe("");
	});

	it.each([
		"/me/rides/more",
		"/me/rides/more?after=",
		"/me/rides/more?after=8000020",
		"/me/rides/more?after=2026-09-17~8000020",
		`${PATH}&after=2026-09-17T08%3A00%3A00Z~8000020`,
		`${PATH}&limit=0`,
		`${PATH}&limit=1001`,
		`${PATH}&limit=abc`,
	])("refuses %s", async (path) => {
		const res = await batch(path);
		expect(res.status).toBe(400);
		expect(await res.text()).toBe("");
	});

	it("only ever returns the rider's own rides", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedBalance(ATHLETE_B);
		await seedRides(ATHLETE_A, 30, "2026-10-06");
		await seedRides(ATHLETE_B, 30, "2026-10-06", 7_000_001);
		// Ride 10 of the other rider as the key.
		const html = await (
			await batch("/me/rides/more?after=2026-09-27T08%3A00%3A00Z~7000010")
		).text();
		expect(ids(html)).toEqual(range(8_000_011, 20));
		expect(html).not.toContain("/70000");
	});

	it("is HTML, never cached, and calls no one (FR-011)", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const first = await firstMore();
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const res = await batch(first);
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(res.headers.get("Vary")).toBe("Accept-Language, Cookie");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("answers HEAD like GET", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const res = await batch(await firstMore(), ATHLETE_A, { method: "HEAD" });
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});
});

describe("GET /me/rides/more cost (018 R9)", () => {
	it("reads the rider's index, never a whole table", async () => {
		await seedRides(ATHLETE_A, 500, "2026-10-06");
		const { results } = await env.DB.prepare(
			`EXPLAIN QUERY PLAN ${RIDE_BATCH_SQL}`,
		)
			.bind(ATHLETE_A, "2026-09-17T08:00:00Z", 8_000_020, 21)
			.all<{ detail: string }>();
		const plan = results.map((row) => row.detail);
		expect(plan.some((step) => step.includes("activities_by_rider"))).toBe(
			true,
		);
		expect(
			plan.filter(
				(step) =>
					/^SCAN (a|c|activities)\b/.test(step) && !step.includes("USING"),
			),
		).toEqual([]);
	});
});

describe("GET /me/rides lazy markup (018 US3, FR-014)", () => {
	it("links a later page to the newest rides and continues below it", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides?page=2");
		expect(html).toContain('<section id="rides" data-lazy>');
		expect(html).toContain(
			'<p class="rides-newest" hidden><a class="tap" href="/me/rides">Zu den neuesten Fahrten</a></p>',
		);
		expect(html).toContain(
			'<p class="rides-total" hidden>45 Fahrten in dieser Saison</p>',
		);
		expect(more(html)).toBe(
			"/me/rides/more?after=2026-08-28T08%3A00%3A00Z~8000040",
		);
	});

	it("has no next batch on the last page", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides?page=3");
		expect(html).toContain('<ol class="ride-list">\n');
		expect(html).not.toContain("data-more");
	});
});
