import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { writeSeen } from "../../src/db/rynke-seen";
import { handleFetch } from "../../src/index";
import { toActivityRecord } from "../../src/strava/activity";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { countTrips } from "../support/d1-trips";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";
import { seedBalance } from "../support/rider-view";

// How many D1 round trips a page waits on (issues #184, #185): the rider and
// their consent in one batch, then the section's reads in one more, with the
// organisers' count alongside. Writes (the seen Rynke, a reveal, a quote) come
// on top, as before.

const { ctx, counter } = countTrips(makeCtx());

/** The round trips `path` took for rider A, after a 200 or a redirect. */
async function tripsOf(path: string, status = 200): Promise<number> {
	const cookies = await sessionCookie(ctx, ATHLETE_A);
	counter.reset();
	const res = await handleFetch(request(path, { cookies }), ctx);
	expect(res.status).toBe(status);
	await res.arrayBuffer();
	return counter.trips();
}

async function seedReadyRider(options: { organiser?: boolean } = {}) {
	await seedRider(ctx, options);
	// The tours are done, so no page holds a tour hint (feature 020).
	await env.DB.prepare(
		"UPDATE riders SET onboarded_at = ?1, organiser_onboarded_at = ?1 WHERE athlete_id = ?2",
	)
		.bind(NOW, ATHLETE_A)
		.run();
	const ride = toActivityRecord(makeStravaActivity(), ATHLETE_A, NOW);
	if (!ride) throw new Error("fixture is not a cycling activity");
	await upsertActivity(env.DB, ride);
	await seedBalance(ATHLETE_A, { trainingRynke: 30 });
}

beforeEach(resetDb);

describe("D1 round trips per page (#184, #185)", () => {
	it("serves /me in two, and three when it marks new Rynke as seen", async () => {
		await seedReadyRider();
		expect(await tripsOf("/me")).toBe(3);
		expect(await tripsOf("/me")).toBe(2);
	});

	it("counts an organiser's open requests alongside the section", async () => {
		await seedReadyRider({ organiser: true });
		await writeSeen(env.DB, ATHLETE_A, { training: 30, team: 0 });
		expect(await tripsOf("/me")).toBe(2);
	});

	it("serves the rides page in two", async () => {
		await seedReadyRider({ organiser: true });
		expect(await tripsOf("/me/rides")).toBe(2);
	});

	it("serves /me/badges in two", async () => {
		await seedReadyRider();
		expect(await tripsOf("/me/badges")).toBe(2);
	});

	it("serves /team in two, and three when it marks a quote as seen", async () => {
		await seedReadyRider();
		// The rider's first view shows them a quote and marks it as seen.
		expect(await tripsOf("/team")).toBe(3);
		counter.reset();
		const cookies = await sessionCookie(ctx, ATHLETE_A);
		const head = await handleFetch(
			request("/team", { cookies, method: "HEAD" }),
			ctx,
		);
		expect(head.status).toBe(200);
		expect(counter.trips()).toBe(2);
	});

	it("decides where the app opens in one", async () => {
		await seedReadyRider();
		expect(await tripsOf("/", 302)).toBe(1);
	});

	it("answers the notification text in one", async () => {
		await seedReadyRider();
		expect(await tripsOf("/me/notification-text", 204)).toBe(1);
		await env.DB.prepare(
			"INSERT INTO rynke_rises (athlete_id, training_rynke, team_rynke, risen_at) VALUES (?, 5, 0, ?)",
		)
			.bind(ATHLETE_A, NOW)
			.run();
		expect(await tripsOf("/me/notification-text")).toBe(1);
	});
});
