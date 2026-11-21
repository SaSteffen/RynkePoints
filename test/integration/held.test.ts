import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, LARGE_ATHLETE } from "../support/fixtures";
import { stravaJson } from "../support/strava-json";

// Feature 041 research R14, contracts/withdrawal.md: the gateway asks, for
// another team about to withdraw a grant, whether this team holds the person.

const ctx = makeCtx();

function ask(token: string, body: unknown = { athleteId: ATHLETE_A }) {
	return handleFetch(
		new Request(`https://rynke.test/strava/held/${token}`, {
			method: "POST",
			// The athlete ID a JSON number with every digit (feature 042 R3).
			body: typeof body === "string" ? body : stravaJson(body),
		}),
		ctx,
	);
}

const TOKEN = env.STRAVA_WEBHOOK_VERIFY_TOKEN;

beforeEach(resetDb);

describe("POST /strava/held/<token>", () => {
	it("answers none for nobody here", async () => {
		expect(await (await ask(TOKEN)).json()).toEqual({
			held: "none",
			rider: false,
		});
	});

	it("answers connected for a connected rider", async () => {
		await seedRider(ctx);
		expect(await (await ask(TOKEN)).json()).toEqual({
			held: "connected",
			rider: true,
		});
	});

	it("answers for an athlete ID past 2^53 exactly (feature 042)", async () => {
		await seedRider(ctx, { athleteId: LARGE_ATHLETE });
		expect(
			await (await ask(TOKEN, { athleteId: LARGE_ATHLETE })).json(),
		).toEqual({ held: "connected", rider: true });
		// One past it differs only beyond 2^53: nobody here.
		expect(
			await (await ask(TOKEN, '{"athleteId":9223372036854775806}')).json(),
		).toEqual({ held: "none", rider: false });
	});

	it("refuses an athlete ID sent as text", async () => {
		const res = await ask(TOKEN, JSON.stringify({ athleteId: ATHLETE_A }));
		expect(res.status).toBe(400);
	});

	// Feature 044 R2: a guest is held, but isn't a rider.
	it("answers connected for a guest alike, but not as a rider", async () => {
		await seedRider(ctx, { guest: true });
		expect(await (await ask(TOKEN)).json()).toEqual({
			held: "connected",
			rider: false,
		});
	});

	it("answers reconnect for a rider whose connection is broken", async () => {
		await seedRider(ctx);
		await env.DB.prepare(
			"UPDATE riders SET status = 'needs_reconnect', reconnect_requested_at = 1",
		).run();
		expect(await (await ask(TOKEN)).json()).toEqual({
			held: "reconnect",
			rider: true,
		});
	});

	it("is not found with a wrong token", async () => {
		expect((await ask("wrong")).status).toBe(404);
	});

	it("refuses a body without an athlete", async () => {
		expect((await ask(TOKEN, { athleteId: "x" })).status).toBe(400);
		expect((await ask(TOKEN, "junk")).status).toBe(400);
	});
});
