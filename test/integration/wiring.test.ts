import {
	createExecutionContext,
	createMessageBatch,
	createScheduledController,
	env,
	getQueueResult,
} from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../../src/index";
import type { WorkMessage } from "../../src/work/messages";
import { resetDb } from "../support/ctx";
import { ATHLETE_A, NOW } from "../support/fixtures";

// The real entry points with the real bindings from wrangler.jsonc, not a test
// Ctx: catches wiring that the handle* tests can't see. `fetch` runs through
// the Worker's own loopback; the runtime's Fetcher type has no queue or
// scheduled, so those call the module's default export as wrangler does.

beforeEach(resetDb);

describe("worker wiring", () => {
	it("fetch answers /health", async () => {
		const res = await exports.default.fetch("https://rynke.test/health");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
	});

	it("fetch answers 404 for a wrong webhook secret", async () => {
		const res = await exports.default.fetch(
			"https://rynke.test/strava/webhook/wrong",
		);
		expect(res.status).toBe(404);
	});

	it("fetch renders the start page in German", async () => {
		const res = await exports.default.fetch("https://rynke.test/");
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Language")).toBe("de");
	});

	it("queue acks an activity event for an unknown athlete", async () => {
		const body: WorkMessage = {
			kind: "activity-event",
			athleteId: ATHLETE_A,
			activityId: 7_400_001,
			aspect: "create",
			changed: [],
		};
		const batch = createMessageBatch<unknown>("rynke-points-work", [
			{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
		]);
		await worker.queue(batch, env);
		const result = await getQueueResult(batch, createExecutionContext());
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(result.retryMessages).toEqual([]);
	});

	it("scheduled completes the daily run", async () => {
		const controller = createScheduledController({
			scheduledTime: new Date(NOW * 1000),
			cron: "17 3 * * *",
		});
		await expect(worker.scheduled(controller, env)).resolves.toBeUndefined();
	});
});
