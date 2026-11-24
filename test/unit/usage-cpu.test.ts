import { describe, expect, it } from "vitest";
import {
	cpuByOwner,
	cpuLevel,
	fetchCpuUsage,
	parseCpu,
} from "../../src/usage/cpu";
import { GATEWAY_WORKER, SHARED } from "../../src/usage/split";
import { europe } from "../../teams/europe/team";
import { hamburg } from "../../teams/hamburg/team";
import { cpuBody, installCloudflare, WITH_ANALYTICS } from "../support/usage";

// The Workers' CPU time (feature 025 User Story 6, FR-041, FR-043, FR-045).
// `fetch` is stubbed, and no test reaches Cloudflare.

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const TODAY = "2026-11-04";
const TEAMS = [hamburg, europe];

describe("cpuLevel", () => {
	it("marks any run cut off, critical above 1 in 100 (FR-043)", () => {
		expect(cpuLevel(1000, 0)).toBe("ok");
		expect(cpuLevel(1000, 1)).toBe("warning");
		expect(cpuLevel(1000, 10)).toBe("warning");
		expect(cpuLevel(1000, 11)).toBe("critical");
		expect(cpuLevel(0, 0)).toBe("ok");
	});
});

describe("parseCpu and cpuByOwner", () => {
	it("adds runs and cut-off runs per Worker, owners by team data", () => {
		const scripts = parseCpu(
			cpuBody([
				{
					date: TODAY,
					scriptName: hamburg.cloudflare.worker,
					runs: 900,
					cutOff: 3,
					cpuTimeP99: 4200.4,
				},
				{
					date: TODAY,
					scriptName: europe.cloudflare.worker,
					runs: 300,
					cpuTimeP99: 2100,
				},
				{
					date: TODAY,
					scriptName: GATEWAY_WORKER,
					runs: 1200,
					cpuTimeP99: 800,
				},
				{ date: TODAY, scriptName: "some-sandbox", runs: 50, cutOff: 50 },
			]),
		);
		expect(scripts).not.toBeNull();
		expect(cpuByOwner(scripts ?? [], TEAMS)).toEqual(
			expect.arrayContaining([
				{ day: TODAY, owner: "hamburg", runs: 900, cutOff: 3, p99Us: 4200 },
				{ day: TODAY, owner: "europe", runs: 300, cutOff: 0, p99Us: 2100 },
				{ day: TODAY, owner: SHARED, runs: 1200, cutOff: 0, p99Us: 800 },
			]),
		);
		expect(cpuByOwner(scripts ?? [], TEAMS)).toHaveLength(3);
	});

	it("refuses an unexpected shape", () => {
		expect(parseCpu({ data: { viewer: { accounts: [{}] } } })).toBeNull();
		expect(
			parseCpu({
				data: {
					viewer: {
						accounts: [
							{
								runs: [{ sum: { requests: 1 }, dimensions: { date: TODAY } }],
								outcomes: [],
							},
						],
					},
				},
			}),
		).toBeNull();
	});
});

describe("fetchCpuUsage", () => {
	it("asks its own query for yesterday and today (FR-045)", async () => {
		let variables: unknown;
		installCloudflare(
			() => Response.json({}),
			() => Response.json(cpuBody([])),
		);
		const spy = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const body = JSON.parse(String(init?.body)) as {
				query: string;
				variables: unknown;
			};
			expect(body.query.startsWith("query Cpu")).toBe(true);
			variables = body.variables;
			return spy(input, init);
		};
		try {
			expect(await fetchCpuUsage(WITH_ANALYTICS, NOW, TEAMS)).toEqual({
				kind: "ok",
				days: [],
			});
		} finally {
			globalThis.fetch = spy;
		}
		expect(variables).toEqual({
			accountTag: WITH_ANALYTICS.CLOUDFLARE_ANALYTICS_ACCOUNT_ID,
			from: "2026-11-03",
			to: TODAY,
		});
	});

	it("is unavailable without the secrets, on errors and odd answers", async () => {
		expect(await fetchCpuUsage({}, NOW, TEAMS)).toEqual({
			kind: "unavailable",
			reason: "not configured",
		});
		installCloudflare(
			() => Response.json({}),
			() => Response.json({ errors: [{ message: "unknown field" }] }),
		);
		expect(await fetchCpuUsage(WITH_ANALYTICS, NOW, TEAMS)).toEqual({
			kind: "unavailable",
			reason: "errors in the response: unknown field",
		});
		installCloudflare(
			() => Response.json({}),
			() => Response.json({ data: {} }),
		);
		expect(await fetchCpuUsage(WITH_ANALYTICS, NOW, TEAMS)).toEqual({
			kind: "unavailable",
			reason: "unexpected response",
		});
	});
});
