import { createScheduledController } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { notFound } from "../../src/http/errors";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { handleFetch, handleScheduled } from "../../src/index";
import {
	makeCtx,
	ORIGIN,
	resetDb,
	seedRider,
	type TestCtx,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { NOW } from "../support/fixtures";

// POST /admin/run-daily (contracts/run-daily.md): the right bearer token starts
// the daily run in the background; anything else looks like an unknown address.

const PATH = "/admin/run-daily";

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
	await seedRider(ctx);
});

afterEach(() => {
	// The route only queues work; Strava is called later by the consumer.
	expect(fake.calls).toEqual([]);
	fake.restore();
});

function call(
	init: { method?: string; authorization?: string } = {},
	target: TestCtx = ctx,
) {
	const headers = new Headers();
	if (init.authorization !== undefined) {
		headers.set("Authorization", init.authorization);
	}
	return handleFetch(
		new Request(`${ORIGIN}${PATH}`, { method: init.method ?? "POST", headers }),
		target,
	);
}

async function unknownAddressBody(): Promise<string> {
	return notFound(createI18n("de", CATALOGS), PATH).text();
}

describe("POST /admin/run-daily without the right token (US2)", () => {
	const cases: [string, { method?: string; authorization?: string }][] = [
		["no Authorization header", {}],
		["a wrong token", { authorization: "Bearer wrong-token" }],
		[
			"the right token with another scheme",
			{ authorization: "Basic test-admin-token" },
		],
		[
			"GET with the right token",
			{ method: "GET", authorization: "Bearer test-admin-token" },
		],
	];

	for (const [name, init] of cases) {
		it(`answers like an unknown address for ${name}`, async () => {
			const res = await call(init);
			expect(res.status).toBe(404);
			expect(await res.text()).toBe(await unknownAddressBody());
			expect(ctx.pending).toEqual([]);
			expect(ctx.queue.sent).toEqual([]);
		});
	}

	it("answers like an unknown address when no token is configured", async () => {
		const unconfigured: TestCtx = {
			...ctx,
			env: { ...ctx.env, ADMIN_TOKEN: "" },
		};
		const res = await call({ authorization: "Bearer " }, unconfigured);
		expect(res.status).toBe(404);
		expect(await res.text()).toBe(await unknownAddressBody());
		expect(ctx.pending).toEqual([]);
		expect(ctx.queue.sent).toEqual([]);
	});
});

describe("POST /admin/run-daily with the right token (US1)", () => {
	it("answers 202 at once and runs the daily steps in the background", async () => {
		const res = await call({ authorization: "Bearer test-admin-token" });
		expect(res.status).toBe(202);
		expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
		expect(await res.text()).toBe("started");
		expect(ctx.pending).toHaveLength(1);
		await Promise.all(ctx.pending);
		const sentByRoute = ctx.queue.sent;

		// The same seed, run by the cron's entry point.
		await resetDb();
		const cronCtx = makeCtx();
		await seedRider(cronCtx);
		await handleScheduled(
			createScheduledController({
				scheduledTime: new Date(NOW * 1000),
				cron: "17 3 * * *",
			}),
			cronCtx,
		);
		expect(cronCtx.queue.sent.length).toBeGreaterThan(0);
		expect(sentByRoute).toEqual(cronCtx.queue.sent);
	});
});
