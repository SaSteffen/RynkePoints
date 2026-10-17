import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { handleFetch } from "../../src/index";
import { toActivityRecord } from "../../src/strava/activity";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";
import { riderPage, seedBalance } from "../support/rider-view";
import { attendRaw, insertEvent } from "../support/rynke";

// The app opens on the badges page while it has a new badge to reveal, so the
// rider sees it (issue #150). Synthetic badges, stored straight in D1.

const ctx = makeCtx();

async function earn(id: string, date: string) {
	await env.DB.prepare(
		"INSERT INTO rider_badges (athlete_id, badge_id, earned_on) VALUES (?, ?, ?)",
	)
		.bind(ATHLETE_A, id, date)
		.run();
}

/** Where opening the app (`/`) sends the signed-in rider. */
async function open(): Promise<string | null> {
	const res = await handleFetch(
		request("/", { cookies: await sessionCookie(ctx, ATHLETE_A) }),
		ctx,
	);
	expect(res.status).toBe(302);
	return res.headers.get("Location");
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx);
	// A rider with a ride opens on the Team page otherwise (#73).
	const ride = toActivityRecord(makeStravaActivity(), ATHLETE_A, NOW);
	if (!ride) throw new Error("fixture is not a cycling activity");
	await upsertActivity(env.DB, ride);
});

describe("opening the app with a new badge (#150)", () => {
	it("opens on the badges page, once", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 30 });
		await earn("distance-100", "2026-05-03");

		expect(await open()).toBe("/me/badges");
		// Seeing the badges page reveals it; the next open is the usual one.
		await riderPage(ctx, ATHLETE_A, "/me/badges");
		expect(await open()).toBe("/team");
	});

	it("opens as usual without a new badge", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 30 });
		expect(await open()).toBe("/team");
	});

	it("opens as usual while the waiting state shows, which reveals nothing", async () => {
		await earn("distance-100", "2026-05-03");
		expect(await open()).toBe("/team");
	});

	it("opens on the badges page for a team badge earned since connecting", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 30 });
		const team = [900011, 900012, 900013, 900014, 900015];
		for (const athleteId of team) await seedRider(ctx, { athleteId });
		// The rider connected on 6 October 2026 (NOW).
		await attendRaw(await insertEvent("team_training", "2026-10-06"), team);

		expect(await open()).toBe("/me/badges");
		await riderPage(ctx, ATHLETE_A, "/me/badges");
		expect(await open()).toBe("/team");
	});
});
