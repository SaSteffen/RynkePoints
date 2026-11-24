import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../support/ctx";

// Migration 0041 (feature 048 research R2): `usage_alerts` takes a Hinweis's
// early threshold as its level, keeps its key and its rows' shape.

const insert = (level: number, period = "2026-11-04") =>
	env.DB.prepare(
		"INSERT INTO usage_alerts (allowance, period, level, fired_at) VALUES ('cf_worker_requests', ?, ?, 1)",
	)
		.bind(period, level)
		.run();

beforeEach(resetDb);

describe("usage_alerts after migration 0041", () => {
	it("takes a Hinweis level beside 80 and 95", async () => {
		for (const level of [25, 80, 95]) await insert(level);
		const { results } = await env.DB.prepare(
			"SELECT level FROM usage_alerts ORDER BY level",
		).all();
		expect(results).toEqual([{ level: 25 }, { level: 80 }, { level: 95 }]);
	});

	it("refuses a level outside 1 to 100", async () => {
		await expect(insert(0)).rejects.toThrow();
		await expect(insert(101)).rejects.toThrow();
	});

	it("still allows one row per allowance, period and level", async () => {
		await insert(25);
		await expect(insert(25)).rejects.toThrow();
		await insert(25, "open");
	});
});
