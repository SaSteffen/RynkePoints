import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { handleFetch } from "../../src/index";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, LARGE_ATHLETE } from "../support/fixtures";
import { seedRide } from "../support/rider-view";
import { stravaJson } from "../support/strava-json";

// Feature 044 research R4, contracts/one-team.md: the gateway asks a team to
// let a rider go who chose to switch to another team. A rider's row goes with
// everything that cascades from it; a guest's stays; nothing else happens.

const ctx = makeCtx();
const TOKEN = env.STRAVA_WEBHOOK_VERIFY_TOKEN;

function letGo(
	token: string,
	body: unknown = { athleteId: ATHLETE_A },
	method = "POST",
) {
	return handleFetch(
		new Request(`https://rynke.test/strava/let-go/${token}`, {
			method,
			// The athlete ID a JSON number with every digit (feature 042 R3).
			...(method === "POST"
				? { body: typeof body === "string" ? body : stravaJson(body) }
				: {}),
		}),
		ctx,
	);
}

async function count(table: string): Promise<number> {
	const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{
		n: number;
	}>();
	return row?.n ?? 0;
}

beforeEach(resetDb);

describe("POST /strava/let-go/<token>", () => {
	it("lets a rider go with everything they own, without a block", async () => {
		await seedRider(ctx);
		await seedRide(ATHLETE_A, { id: "880001" });
		const res = await letGo(TOKEN);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ letGo: true });
		expect(await getRider(env.DB, ATHLETE_A)).toBeNull();
		expect(await count("activities")).toBe(0);
		expect(await count("strava_credentials")).toBe(0);
		expect(await count("blocked_athletes")).toBe(0);
		expect(await count("pending_revocations")).toBe(0);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("lets go of an athlete ID past 2^53 exactly (feature 042)", async () => {
		await seedRider(ctx, { athleteId: LARGE_ATHLETE });
		await seedRider(ctx);
		await letGo(TOKEN, { athleteId: LARGE_ATHLETE });
		expect(await getRider(env.DB, LARGE_ATHLETE)).toBeNull();
		expect(await getRider(env.DB, ATHLETE_A)).not.toBeNull();
	});

	it("keeps a guest", async () => {
		await seedRider(ctx, { guest: true });
		expect(await (await letGo(TOKEN)).json()).toEqual({ letGo: true });
		expect(await getRider(env.DB, ATHLETE_A)).not.toBeNull();
	});

	it("confirms for nobody here", async () => {
		expect(await (await letGo(TOKEN)).json()).toEqual({ letGo: true });
	});

	it("is not found with a wrong token, and lets nobody go", async () => {
		await seedRider(ctx);
		expect((await letGo("wrong")).status).toBe(404);
		expect(await getRider(env.DB, ATHLETE_A)).not.toBeNull();
	});

	it("refuses a body without an athlete and any other method", async () => {
		expect((await letGo(TOKEN, { athleteId: "x" })).status).toBe(400);
		expect((await letGo(TOKEN, undefined, "GET")).status).toBe(405);
	});
});
