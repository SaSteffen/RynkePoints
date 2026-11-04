import { createScheduledController, env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleScheduled } from "../../src/index";
import {
	makeCtx,
	resetDb,
	type SentMessage,
	seedRider,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C } from "../support/fixtures";
import {
	installPushService,
	pushEndpoint,
	seedSubscription,
} from "../support/push";
import {
	cloudflareBody,
	installCloudflare,
	setStravaUsage,
	WITH_ANALYTICS,
} from "../support/usage";

// Alerts (feature 025 US5, contracts/alerts.md, FR-033 to FR-037). Each message
// on the fake queue is one notification to one device; none holds any rider data
// but the IDs it is addressed by.

const NOW = Date.UTC(2026, 10, 4, 12, 58, 0) / 1000;
const TODAY = "2026-11-04";

const hourly = () =>
	createScheduledController({
		scheduledTime: new Date(NOW * 1000),
		cron: "58 * * * *",
	});

const ADMIN = ATHLETE_A;
const OTHER_ADMIN = ATHLETE_B;
const RIDER = ATHLETE_C;
let ctx: TestCtx;

const notified = (sent: readonly SentMessage[]) =>
	sent.flatMap(({ body }) =>
		body.kind === "send-notification" ? [body.athleteId] : [],
	);

const alerts = async () =>
	(
		await env.DB.prepare(
			"SELECT allowance, period, level FROM usage_alerts ORDER BY allowance, level",
		).all()
	).results;

/** Reads at `percent` of 3,000, seen just now. */
const readsAt = (percent: number) =>
	setStravaUsage({ observedAt: NOW - 60, readDaily: percent * 30 });

function withCloudflare(figures: Parameters<typeof cloudflareBody>[0][string]) {
	installCloudflare(() => Response.json(cloudflareBody({ [TODAY]: figures })));
	return { ...ctx, env: { ...ctx.env, ...WITH_ANALYTICS } };
}

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx({ now: NOW });
	vi.spyOn(console, "warn").mockImplementation(() => {});
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
	await seedRider(ctx, { athleteId: OTHER_ADMIN, administrator: true });
	await seedRider(ctx, { athleteId: RIDER });
	await seedSubscription(ADMIN, pushEndpoint(1));
	await seedSubscription(OTHER_ADMIN, pushEndpoint(2));
	await seedSubscription(RIDER, pushEndpoint(3));
	await setStravaUsage({ observedAt: NOW - 60 });
});

describe("a daily allowance", () => {
	it("below 80 % sends nothing", async () => {
		await readsAt(79);
		await handleScheduled(hourly(), ctx);
		expect(notified(ctx.queue.sent)).toEqual([]);
		expect(await alerts()).toEqual([]);
	});

	it("at 80 % notifies the administrators' devices (scenario 1, FR-037)", async () => {
		await readsAt(80);
		await handleScheduled(hourly(), ctx);
		expect(notified(ctx.queue.sent).sort()).toEqual([ADMIN, OTHER_ADMIN]);
		expect(await alerts()).toEqual([
			{ allowance: "strava_read_daily", period: TODAY, level: 80 },
		]);
	});

	it("at 95 % later notifies once more (scenario 2)", async () => {
		await readsAt(80);
		await handleScheduled(hourly(), ctx);
		ctx.queue.sent.length = 0;
		await readsAt(95);
		await handleScheduled(hourly(), ctx);
		expect(notified(ctx.queue.sent).sort()).toEqual([ADMIN, OTHER_ADMIN]);
	});

	it("sends one notification when both levels are newly reached", async () => {
		await readsAt(96);
		await handleScheduled(hourly(), ctx);
		expect(notified(ctx.queue.sent).sort()).toEqual([ADMIN, OTHER_ADMIN]);
		expect(await alerts()).toHaveLength(2);
	});

	it("sends nothing on further checks in the period (scenario 3, FR-035)", async () => {
		await readsAt(80);
		await handleScheduled(hourly(), ctx);
		ctx.queue.sent.length = 0;
		await handleScheduled(hourly(), ctx);
		expect(notified(ctx.queue.sent)).toEqual([]);
	});

	it("notifies again the next day", async () => {
		await readsAt(80);
		await handleScheduled(hourly(), ctx);
		const next = makeCtx({ now: NOW + 86_400 });
		await setStravaUsage({ observedAt: NOW + 86_340, readDaily: 2400 });
		await handleScheduled(hourly(), next);
		expect(notified(next.queue.sent).sort()).toEqual([ADMIN, OTHER_ADMIN]);
	});
});

describe("what doesn't alert", () => {
	it("Strava's 15-minute figures never do (scenario 4)", async () => {
		await setStravaUsage({
			observedAt: NOW - 60,
			read15m: 290,
			all15m: 590,
		});
		await handleScheduled(hourly(), ctx);
		expect(notified(ctx.queue.sent)).toEqual([]);
		expect(await alerts()).toEqual([]);
	});

	it("a failed Cloudflare recording alerts on nothing of Cloudflare's", async () => {
		installCloudflare(() => new Response("no", { status: 500 }));
		await env.DB.prepare(
			`INSERT INTO usage_daily (day, allowance, team, used, limit_value, recorded_at)
			VALUES (?, 'cf_worker_requests', 't', 99000, 100000, 0)`,
		)
			.bind(TODAY)
			.run();
		await handleScheduled(hourly(), {
			...ctx,
			env: { ...ctx.env, ...WITH_ANALYTICS },
		});
		expect(await alerts()).toEqual([]);
		expect(notified(ctx.queue.sent)).toEqual([]);
	});
});

describe("the usage alerts switch (scenarios 7 to 9, FR-039)", () => {
	const switchOff = (athleteId: number) =>
		env.DB.prepare("UPDATE riders SET admin_alerts = 0 WHERE athlete_id = ?")
			.bind(athleteId)
			.run();

	it("spares only that administrator, for Cloudflare", async () => {
		await switchOff(ADMIN);
		await handleScheduled(hourly(), withCloudflare({ requests: 85_000 }));
		expect(notified(ctx.queue.sent)).toEqual([OTHER_ADMIN]);
	});

	it("spares only that administrator, for Strava", async () => {
		await switchOff(ADMIN);
		await readsAt(80);
		await handleScheduled(hourly(), ctx);
		expect(notified(ctx.queue.sent)).toEqual([OTHER_ADMIN]);
	});

	it("doesn't catch up on a level reached while it was off", async () => {
		await switchOff(ADMIN);
		await switchOff(OTHER_ADMIN);
		const target = withCloudflare({ requests: 85_000 });
		await handleScheduled(hourly(), target);
		expect(notified(ctx.queue.sent)).toEqual([]);
		expect(await alerts()).toEqual([
			{ allowance: "cf_worker_requests", period: TODAY, level: 80 },
		]);
		await env.DB.prepare("UPDATE riders SET admin_alerts = 1").run();
		await handleScheduled(hourly(), target);
		expect(notified(ctx.queue.sent)).toEqual([]);
	});
});

describe("allowances that don't reset", () => {
	const storageAt = (storage: number) => withCloudflare({ storage });

	it("notify again only after falling below the level", async () => {
		await handleScheduled(hourly(), storageAt(4_100_000_000));
		expect(notified(ctx.queue.sent)).toHaveLength(2);
		ctx.queue.sent.length = 0;

		vi.mocked(globalThis.fetch).mockRestore();
		vi.spyOn(globalThis, "fetch");
		await handleScheduled(hourly(), storageAt(4_200_000_000));
		expect(notified(ctx.queue.sent)).toEqual([]);

		vi.mocked(globalThis.fetch).mockRestore();
		vi.spyOn(globalThis, "fetch");
		await handleScheduled(hourly(), storageAt(1_000_000_000));
		expect(await alerts()).toEqual([]);
		expect(notified(ctx.queue.sent)).toEqual([]);

		vi.mocked(globalThis.fetch).mockRestore();
		vi.spyOn(globalThis, "fetch");
		await handleScheduled(hourly(), storageAt(4_100_000_000));
		expect(notified(ctx.queue.sent)).toHaveLength(2);
	});

	it("keep their period as open", async () => {
		await handleScheduled(hourly(), storageAt(4_800_000_000));
		expect(await alerts()).toEqual([
			{ allowance: "cf_d1_storage_bytes", period: "open", level: 80 },
			{ allowance: "cf_d1_storage_bytes", period: "open", level: 95 },
		]);
	});
});

describe("failures", () => {
	it("an empty recipient list still inserts the row", async () => {
		await env.DB.prepare("UPDATE riders SET administrator = 0").run();
		await readsAt(80);
		await handleScheduled(hourly(), ctx);
		expect(notified(ctx.queue.sent)).toEqual([]);
		expect(await alerts()).toHaveLength(1);
	});

	it("a queue failure doesn't fail the recording (scenario 6)", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await readsAt(80);
		const broken: TestCtx = {
			...ctx,
			queue: {
				...ctx.queue,
				send: () => Promise.reject(new Error("queue down")),
				sendBatch: () => Promise.reject(new Error("queue down")),
			},
		};
		await expect(handleScheduled(hourly(), broken)).resolves.toBeUndefined();
		expect(error).toHaveBeenCalled();
		expect(
			await env.DB.prepare(
				"SELECT used FROM usage_daily WHERE allowance = 'strava_read_daily'",
			).first("used"),
		).toBe(2400);
	});

	it("a failed alert check doesn't fail the recording", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await readsAt(80);
		await env.DB.exec("ALTER TABLE usage_alerts RENAME TO usage_alerts_gone");
		try {
			await expect(handleScheduled(hourly(), ctx)).resolves.toBeUndefined();
			expect(error).toHaveBeenCalled();
		} finally {
			await env.DB.exec("ALTER TABLE usage_alerts_gone RENAME TO usage_alerts");
		}
	});

	it("the push service being down fails nothing (installPushService)", async () => {
		installPushService(() => "throw");
		await readsAt(80);
		await expect(handleScheduled(hourly(), ctx)).resolves.toBeUndefined();
	});
});

describe("retention", () => {
	it("removes daily rows past their 2 days and keeps open ones", async () => {
		const daily = createScheduledController({
			scheduledTime: new Date(NOW * 1000),
			cron: "17 3 * * *",
		});
		await env.DB.prepare(
			`INSERT INTO usage_alerts (allowance, period, level, fired_at) VALUES
			('strava_read_daily', '2026-11-01', 80, 0),
			('strava_read_daily', '2026-11-02', 80, 0),
			('riders_connected', 'open', 80, 0)`,
		).run();
		await handleScheduled(daily, ctx);
		expect(await alerts()).toEqual([
			{ allowance: "riders_connected", period: "open", level: 80 },
			{ allowance: "strava_read_daily", period: "2026-11-02", level: 80 },
		]);
	});
});
