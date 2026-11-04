import { describe, expect, it } from "vitest";
import { cloudflareAnalytics } from "../../src/config";
import { fetchCloudflareUsage, parseUsage } from "../../src/usage/cloudflare";
import {
	cloudflareBody,
	installCloudflare,
	WITH_ANALYTICS,
} from "../support/usage";

// Cloudflare's figures (feature 025 contracts/cloudflare-analytics.md, FR-028):
// `fetch` is stubbed, and no test reaches Cloudflare.

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;

describe("cloudflareAnalytics", () => {
	it("needs both secrets", () => {
		expect(cloudflareAnalytics(WITH_ANALYTICS)).toEqual({
			token: WITH_ANALYTICS.CLOUDFLARE_ANALYTICS_TOKEN,
			accountId: WITH_ANALYTICS.CLOUDFLARE_ANALYTICS_ACCOUNT_ID,
		});
		expect(cloudflareAnalytics({ CLOUDFLARE_ANALYTICS_TOKEN: "x" })).toBeNull();
		expect(cloudflareAnalytics({})).toBeNull();
	});
});

describe("fetchCloudflareUsage", () => {
	it("asks once for yesterday and today by account, read-only bearer", async () => {
		const calls = installCloudflare(() =>
			Response.json(cloudflareBody({ "2026-11-04": { requests: 10 } })),
		);
		await fetchCloudflareUsage(WITH_ANALYTICS, NOW);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.authorization).toBe(
			`Bearer ${WITH_ANALYTICS.CLOUDFLARE_ANALYTICS_TOKEN}`,
		);
		expect(calls[0]?.variables).toEqual({
			accountTag: WITH_ANALYTICS.CLOUDFLARE_ANALYTICS_ACCOUNT_ID,
			from: "2026-11-03",
			to: "2026-11-04",
		});
	});

	it("sums each day over its groups", async () => {
		installCloudflare(() =>
			Response.json(
				cloudflareBody({
					"2026-11-03": { requests: 5 },
					"2026-11-04": {
						requests: 1001,
						operations: 21,
						rowsRead: 700,
						rowsWritten: 70,
						storage: 2001,
					},
				}),
			),
		);
		const result = await fetchCloudflareUsage(WITH_ANALYTICS, NOW);
		if (result.kind !== "ok") throw new Error(result.reason);
		expect(result.today).toBe("2026-11-04");
		expect(result.yesterday).toBe("2026-11-03");
		expect(result.days.get("2026-11-04")).toEqual({
			cf_worker_requests: 1001,
			cf_queue_operations: 21,
			cf_d1_rows_read: 700,
			cf_d1_rows_written: 70,
			cf_d1_storage_bytes: 2001,
		});
		expect(result.days.get("2026-11-03")?.cf_worker_requests).toBe(5);
	});

	it("asks nobody without the secrets", async () => {
		expect(await fetchCloudflareUsage({}, NOW)).toEqual({
			kind: "unavailable",
			reason: "not configured",
		});
	});

	it.each<[string, () => Response | "throw"]>([
		["a network failure", () => "throw"],
		["a non-2xx answer", () => new Response("no", { status: 500 })],
		[
			"errors in the body",
			() => Response.json({ errors: [{ message: "x" }], data: null }),
		],
		["a body that isn't JSON", () => new Response("<html>")],
		["an unexpected shape", () => Response.json({ data: { viewer: {} } })],
		["no account", () => Response.json({ data: { viewer: { accounts: [] } } })],
		[
			"a group without its figure",
			() =>
				Response.json({
					data: {
						viewer: {
							accounts: [
								{
									workers: [{ sum: {}, dimensions: { date: "2026-11-04" } }],
									queues: [],
									databases: [],
									storage: [],
								},
							],
						},
					},
				}),
		],
	])("reads %s as unavailable", async (_, answer) => {
		installCloudflare(answer);
		const result = await fetchCloudflareUsage(WITH_ANALYTICS, NOW);
		expect(result.kind).toBe("unavailable");
	});
});

describe("parseUsage", () => {
	it("takes no group for a day as nothing reported", () => {
		expect(parseUsage(cloudflareBody({}))?.size).toBe(0);
	});
});
