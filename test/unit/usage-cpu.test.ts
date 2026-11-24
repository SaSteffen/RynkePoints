import { describe, expect, it } from "vitest";
import { queryCloudflare } from "../../src/usage/cloudflare";
import {
	CPU_QUERY,
	type CpuDay,
	cpuByOwner,
	cpuLevel,
	cpuRows,
	fetchCpuUsage,
	parseCpu,
	seasonOf,
	weekSlots,
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
				{
					day: TODAY,
					owner: "hamburg",
					runs: 900,
					cutOff: 3,
					p99Us: 4200,
					p50Us: 0,
				},
				{
					day: TODAY,
					owner: "europe",
					runs: 300,
					cutOff: 0,
					p99Us: 2100,
					p50Us: 0,
				},
				{
					day: TODAY,
					owner: SHARED,
					runs: 1200,
					cutOff: 0,
					p99Us: 800,
					p50Us: 0,
				},
			]),
		);
		expect(cpuByOwner(scripts ?? [], TEAMS)).toHaveLength(3);
	});

	it("reads the median, the highest of an owner's Workers (feature 049 FR-001)", () => {
		const scripts = parseCpu(
			cpuBody([
				{
					date: TODAY,
					scriptName: hamburg.cloudflare.worker,
					runs: 900,
					cpuTimeP99: 4200,
					cpuTimeP50: 1400.4,
				},
				{
					date: TODAY,
					scriptName: europe.cloudflare.worker,
					runs: 300,
					cpuTimeP99: 2100,
					cpuTimeP50: 1200,
				},
			]),
		);
		expect(
			scripts?.find((s) => s.script === hamburg.cloudflare.worker),
		).toMatchObject({
			p50Us: 1400,
		});
		const twoWorkers = cpuByOwner(
			[
				{
					day: TODAY,
					script: "a",
					runs: 1,
					cutOff: 0,
					p99Us: 3000,
					p50Us: 1200,
				},
				{
					day: TODAY,
					script: "b",
					runs: 1,
					cutOff: 0,
					p99Us: 2000,
					p50Us: 1800,
				},
			],
			[
				{ ...hamburg, cloudflare: { ...hamburg.cloudflare, worker: "a" } },
				{
					...hamburg,
					cloudflare: { ...hamburg.cloudflare, worker: "b" },
				},
			],
		);
		expect(twoWorkers).toEqual([
			{
				day: TODAY,
				owner: "hamburg",
				runs: 2,
				cutOff: 0,
				p99Us: 3000,
				p50Us: 1800,
			},
		]);
	});

	it("reads an answer without the median as unavailable, like one without the 99th", () => {
		const body = cpuBody([
			{ date: TODAY, scriptName: hamburg.cloudflare.worker, runs: 1 },
		]) as {
			data: { viewer: { accounts: { runs: { quantiles: object }[] }[] } };
		};
		for (const account of body.data.viewer.accounts) {
			for (const group of account.runs) group.quantiles = { cpuTimeP99: 100 };
		}
		expect(parseCpu(body)).toBeNull();
	});
});

describe("parseCpu refusals", () => {
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

describe("cpuRows", () => {
	const day = (owner: string, p50Us: number | null): CpuDay => ({
		day: TODAY,
		owner,
		runs: 10,
		cutOff: 0,
		p99Us: 3000,
		p50Us,
	});

	it("carries the median per owner, the other teams' the highest of theirs", () => {
		const [row] = cpuRows(
			[
				day("hamburg", 1400),
				day("europe", 1200),
				day("third", 1800),
				day(SHARED, 900),
			],
			"hamburg",
		);
		expect(row?.own?.p50Us).toBe(1400);
		expect(row?.others?.p50Us).toBe(1800);
		expect(row?.shared?.p50Us).toBe(900);
	});

	it("keeps no median as null, and one other team's median over none", () => {
		const [none] = cpuRows(
			[day("europe", null), day("third", null)],
			"hamburg",
		);
		expect(none?.others?.p50Us).toBeNull();
		const [one] = cpuRows([day("europe", null), day("third", 1100)], "hamburg");
		expect(one?.others?.p50Us).toBe(1100);
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

describe("seasonOf and weekSlots (feature 049 FR-005, FR-006, FR-020)", () => {
	const day = (d: string, owner: string, p50Us: number | null): CpuDay => ({
		day: d,
		owner,
		runs: 10,
		cutOff: 0,
		p99Us: 5000,
		p50Us,
	});

	it("runs from 1 September to 31 August, for every team", () => {
		const season = { from: "2026-09-01", to: "2027-08-31" };
		expect(seasonOf("2026-11-24")).toEqual(season);
		expect(seasonOf("2027-03-01")).toEqual(season);
		expect(seasonOf("2026-09-01")).toEqual(season);
		expect(seasonOf("2027-08-31")).toEqual(season);
		expect(seasonOf("2027-09-01")).toEqual({
			from: "2027-09-01",
			to: "2028-08-31",
		});
	});

	it("cuts Monday-to-Sunday weeks at the season's edges", () => {
		const slots = weekSlots([], "hamburg", "2026-11-24");
		expect(slots).toHaveLength(53);
		expect(slots[0]).toMatchObject({ from: "2026-09-01", to: "2026-09-06" });
		expect(slots[1]).toMatchObject({ from: "2026-09-07", to: "2026-09-13" });
		expect(slots[52]).toMatchObject({ from: "2027-08-30", to: "2027-08-31" });
		// 1 September 2019 was a Sunday, and the season held 29 February.
		expect(weekSlots([], "hamburg", "2019-11-24")).toHaveLength(54);
	});

	it("leaves the weeks after today to come", () => {
		const slots = weekSlots([], "hamburg", "2026-11-24");
		expect(slots[12]).toMatchObject({
			from: "2026-11-23",
			to: "2026-11-29",
			toCome: false,
		});
		expect(slots[11]?.toCome).toBe(false);
		expect(slots[13]?.toCome).toBe(true);
		expect(slots.filter((slot) => !slot.toCome)).toHaveLength(13);
	});

	it("takes the week's highest daily median per owner, gaps as null", () => {
		const slots = weekSlots(
			[
				day("2026-11-16", "hamburg", 1100),
				day("2026-11-18", "hamburg", 2000),
				day("2026-11-22", "hamburg", 1400),
				day("2026-11-17", "hamburg", null),
				day("2026-11-17", "europe", 1200),
				day("2026-11-19", "third", 1800),
				day("2026-11-23", SHARED, 400),
				day("2026-08-31", "hamburg", 9000),
			],
			"hamburg",
			"2026-11-24",
		);
		expect(slots[11]).toEqual({
			from: "2026-11-16",
			to: "2026-11-22",
			own: 2000,
			others: 1800,
			shared: null,
			toCome: false,
		});
		expect(slots[12]).toMatchObject({ own: null, others: null, shared: 400 });
		// The day before the season counts for none of its weeks.
		expect(slots[0]).toMatchObject({ own: null, others: null, shared: null });
	});
});

describe("queryCloudflare's day range (feature 049 research R8)", () => {
	async function variablesOf(range?: { from: string; to: string }) {
		let variables: unknown;
		installCloudflare(
			() => Response.json({}),
			() => Response.json(cpuBody([])),
		);
		const spy = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			variables = (JSON.parse(String(init?.body)) as { variables: unknown })
				.variables;
			return spy(input, init);
		};
		try {
			await queryCloudflare(WITH_ANALYTICS, NOW, CPU_QUERY, range);
		} finally {
			globalThis.fetch = spy;
		}
		return variables;
	}

	it("asks for yesterday and today without a range", async () => {
		expect(await variablesOf()).toMatchObject({
			from: "2026-11-03",
			to: TODAY,
		});
	});

	it("asks for exactly the range it is given", async () => {
		expect(await variablesOf({ from: "2026-09-14", to: "2026-09-14" })).toEqual(
			{
				accountTag: WITH_ANALYTICS.CLOUDFLARE_ANALYTICS_ACCOUNT_ID,
				from: "2026-09-14",
				to: "2026-09-14",
			},
		);
	});
});
