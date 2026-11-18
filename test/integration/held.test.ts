import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";

// Feature 041 research R14, contracts/withdrawal.md: the gateway asks, for
// another team about to withdraw a grant, whether this team holds the person.

const ctx = makeCtx();

function ask(token: string, body: unknown = { athleteId: ATHLETE_A }) {
	return handleFetch(
		new Request(`https://rynke.test/strava/held/${token}`, {
			method: "POST",
			body: JSON.stringify(body),
		}),
		ctx,
	);
}

const TOKEN = env.STRAVA_WEBHOOK_VERIFY_TOKEN;

beforeEach(resetDb);

describe("POST /strava/held/<token>", () => {
	it("answers none for nobody here", async () => {
		expect(await (await ask(TOKEN)).json()).toEqual({ held: "none" });
	});

	it("answers connected for a connected rider", async () => {
		await seedRider(ctx);
		expect(await (await ask(TOKEN)).json()).toEqual({ held: "connected" });
	});

	it("answers connected for a guest alike", async () => {
		await seedRider(ctx, { guest: true });
		expect(await (await ask(TOKEN)).json()).toEqual({ held: "connected" });
	});

	it("answers reconnect for a rider whose connection is broken", async () => {
		await seedRider(ctx);
		await env.DB.prepare(
			"UPDATE riders SET status = 'needs_reconnect', reconnect_requested_at = 1",
		).run();
		expect(await (await ask(TOKEN)).json()).toEqual({ held: "reconnect" });
	});

	it("is not found with a wrong token", async () => {
		expect((await ask("wrong")).status).toBe(404);
	});

	it("refuses a body without an athlete", async () => {
		expect((await ask(TOKEN, { athleteId: "x" })).status).toBe(400);
		expect((await ask(TOKEN, "junk")).status).toBe(400);
	});
});
