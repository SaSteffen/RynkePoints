import { beforeEach, describe, expect, it } from "vitest";
import { seasonStart } from "../../src/config";
import { notFound } from "../../src/http/errors";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	ORIGIN,
	resetDb,
	seedRider,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";

// POST /admin/catch-up?since=<epoch> (feature 026 FR-011, docs/gateway-switch.md):
// re-reads every connected rider's rides since a moment, for events Strava
// never sent. Anything without the admin token looks like an unknown address.

const PATH = "/admin/catch-up";
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B, status: "needs_reconnect" });
});

function call(query: string, authorization?: string, method = "POST") {
	const headers = new Headers();
	if (authorization) headers.set("Authorization", authorization);
	return handleFetch(
		new Request(`${ORIGIN}${PATH}${query}`, { method, headers }),
		ctx,
	);
}

const TOKEN = "Bearer test-admin-token";

describe("POST /admin/catch-up", () => {
	it("queues one re-read per connected rider since the moment", async () => {
		const since = NOW - 3600;
		const res = await call(`?since=${since}`, TOKEN);
		expect(res.status).toBe(202);
		expect(await res.text()).toBe("queued 1");
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{
				kind: "reread-page",
				athleteId: ATHLETE_A,
				page: 1,
				after: Math.max(since, seasonStart(ctx.env)),
			},
		]);
	});

	it.each([
		"",
		"?since=abc",
		`?since=${NOW + 60}`,
		`?since=${NOW - 31 * 86400}`,
	])("refuses %s", async (query) => {
		expect((await call(query, TOKEN)).status).toBe(400);
		expect(ctx.queue.sent).toEqual([]);
	});

	it.each([
		["no token", undefined, "POST"],
		["a wrong token", "Bearer wrong", "POST"],
		["a GET", TOKEN, "GET"],
	])("looks like an unknown address with %s", async (_, auth, method) => {
		const res = await call(`?since=${NOW - 60}`, auth, method);
		expect(res.status).toBe(404);
		expect(await res.text()).toBe(
			await notFound(createI18n("de", CATALOGS), PATH).text(),
		);
		expect(ctx.queue.sent).toEqual([]);
	});
});
