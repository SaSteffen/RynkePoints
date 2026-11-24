import { describe, expect, it } from "vitest";
import type { RecheckDay } from "../../src/db/recheck";
import type { RoutingCount } from "../../src/routing/figures";
import { routingDays } from "../../src/routing/warning";
import type { CallDayRow } from "../../src/strava/calls";
import type { AllowanceId } from "../../src/usage/allowances";
import {
	type AttentionInputs,
	attentionItems,
	isRecheckWarningDay,
	markCount,
} from "../../src/usage/attention";
import type { CpuDay } from "../../src/usage/cpu";
import { makeFigure } from "../../src/usage/figures";
import { SHARED } from "../../src/usage/split";

// Feature 048 research R4, data-model.md "Attention item": what needs a look,
// its order and the count the list's head and the Admin tab share.

const TODAY = "2026-11-24";
const YESTERDAY = "2026-11-23";
const EARLIER = "2026-11-22";

/** A figure at `percent` of a limit of 1000. */
const at = (id: AllowanceId, percent: number) =>
	makeFigure(id, percent * 10, 1000, null, 0);

const recheck = (day: string, over24h = 0, unordered = 0): RecheckDay => ({
	day,
	sent: 10,
	skipped: 0,
	failed: 0,
	unordered,
	over24h,
	runsHeld: 0,
});

const calls = (day: string, marked: boolean): CallDayRow => ({
	day,
	calls: 5,
	heldBack: 0,
	others: null,
	all: 5,
	strava: null,
	marked,
});

const missed = (day: string): RoutingCount => ({
	day,
	team: "hamburg",
	figure: "missed",
	count: 1,
});

const cpu = (owner: string, runs: number, cutOff: number): CpuDay => ({
	day: TODAY,
	owner,
	runs,
	cutOff,
	p99Us: 1000,
	p50Us: null,
});

const quiet: AttentionInputs = {
	today: TODAY,
	figures: [at("strava_read_daily", 10), at("cf_worker_requests", 20)],
	self: "hamburg",
	cpu: [],
	recheck: [],
	routing: [],
	calls: [],
	peers: [{ lastSuccessAt: 100, lastFailureAt: null }],
	hasDevice: true,
};

const items = (inputs: Partial<AttentionInputs>) =>
	attentionItems({ ...quiet, ...inputs });

describe("attentionItems", () => {
	it("is empty when every figure is below its early threshold and all is well", () => {
		expect(items({})).toEqual([]);
	});

	it("lists Kritisch, Warnung, Hinweis, then the state hints (scenario 1)", () => {
		const list = items({
			figures: [
				at("strava_read_daily", 40),
				at("cf_worker_requests", 85),
				at("cf_d1_rows_read", 97),
			],
			peers: [{ lastSuccessAt: 100, lastFailureAt: 200 }],
			hasDevice: false,
		});
		expect(list.map((item) => [item.kind, item.level, item.target])).toEqual([
			["figure", "critical", "#cf_d1_rows_read"],
			["figure", "warning", "#cf_worker_requests"],
			["figure", "early", "#strava_read_daily"],
			["team", "hint", "#strava"],
			["device", "hint", "/me/settings"],
		]);
	});

	it("keeps the page's order within a level", () => {
		const list = items({
			figures: [
				at("strava_read_daily", 30),
				at("strava_read_15m", 30),
				at("cf_worker_requests", 30),
				at("cf_d1_storage_bytes", 30),
			],
		});
		expect(list.map((item) => item.target)).toEqual([
			"#strava_read_daily",
			"#strava_read_15m",
			"#cf_worker_requests",
			"#cf_d1_storage_bytes",
		]);
	});

	it("carries the figure's numbers", () => {
		const [item] = items({ figures: [at("cf_d1_rows_read", 97)] });
		expect(item?.kind === "figure" && item.figure).toMatchObject({
			used: 970,
			limit: 1000,
			percent: 97,
		});
	});

	it("takes the early threshold exactly: 25 % is a Hinweis, 24.9 % isn't", () => {
		expect(
			items({
				figures: [makeFigure("cf_worker_requests", 249, 1000, null, 0)],
			}),
		).toEqual([]);
		expect(
			items({ figures: [makeFigure("cf_worker_requests", 250, 1000, null, 0)] })
				.length,
		).toBe(1);
	});

	it("puts the Betrieb rows after the figures, in the page's order, newer day first", () => {
		const list = items({
			figures: [at("cf_worker_requests", 85)],
			calls: [calls(TODAY, false), calls(YESTERDAY, true)],
			recheck: [recheck(YESTERDAY, 2), recheck(TODAY, 0, 1)],
			routing: routingDays([missed(YESTERDAY), missed(TODAY)], "hamburg"),
			cpu: [cpu("hamburg", 1000, 1)],
		});
		expect(list.map((item) => [item.kind, item.target])).toEqual([
			["figure", "#cf_worker_requests"],
			["calls", "#strava-calls"],
			["recheck", "#recheck"],
			["recheck", "#recheck"],
			["routing", "#routing"],
			["routing", "#routing"],
			["cpu", "#cpu"],
		]);
		const days = list.flatMap((item) => ("day" in item ? [item.day] : []));
		expect(days).toEqual([YESTERDAY, TODAY, YESTERDAY, TODAY, YESTERDAY]);
	});

	it("takes marked days from today and yesterday only (scenario 5)", () => {
		const list = items({
			calls: [calls(EARLIER, true)],
			recheck: [recheck(EARLIER, 1)],
			routing: routingDays([missed(EARLIER)], "hamburg"),
		});
		expect(list).toEqual([]);
	});

	it("says why a re-check or routing day is marked", () => {
		const list = items({
			recheck: [recheck(TODAY, 1, 1)],
			routing: routingDays([missed(TODAY)], "hamburg"),
		});
		expect(list).toEqual([
			expect.objectContaining({
				kind: "recheck",
				over24h: true,
				unordered: true,
			}),
			expect.objectContaining({ kind: "routing", reasons: ["missed"] }),
		]);
	});

	it("gives a CPU row per owner marked today, other teams together", () => {
		const list = items({
			cpu: [
				cpu("hamburg", 1000, 0),
				cpu("europe", 100, 1),
				cpu("third", 100, 1),
				cpu(SHARED, 100, 5),
				{ ...cpu("hamburg", 100, 50), day: YESTERDAY },
			],
		});
		expect(list).toEqual([
			expect.objectContaining({
				kind: "cpu",
				level: "critical",
				owner: "shared",
				runs: 100,
				cutOff: 5,
			}),
			expect.objectContaining({
				kind: "cpu",
				level: "warning",
				owner: "others",
				runs: 200,
				cutOff: 2,
			}),
		]);
	});

	it("hints at each other team that never answered or failed last, by its place", () => {
		const list = items({
			peers: [
				undefined,
				{ lastSuccessAt: 200, lastFailureAt: 100 },
				{ lastSuccessAt: 100, lastFailureAt: 200 },
			],
		});
		expect(list).toEqual([
			{
				kind: "team",
				level: "hint",
				target: "#strava",
				peer: 0,
				lastSuccessAt: null,
			},
			{
				kind: "team",
				level: "hint",
				target: "#strava",
				peer: 2,
				lastSuccessAt: 100,
			},
		]);
	});

	it("marks a 15-minute figure like any other", () => {
		expect(items({ figures: [at("strava_all_15m", 30)] })).toEqual([
			expect.objectContaining({ level: "early", target: "#strava_all_15m" }),
		]);
	});
});

describe("markCount", () => {
	it("counts every mark by level and leaves the state hints out (scenario 3)", () => {
		const list = items({
			figures: [
				at("strava_read_daily", 40),
				at("strava_read_15m", 30),
				at("cf_worker_requests", 85),
				at("cf_d1_rows_read", 97),
			],
			cpu: [cpu("hamburg", 100, 1)],
			peers: [undefined],
			hasDevice: false,
		});
		expect(markCount(list)).toEqual({
			critical: 1,
			warning: 2,
			early: 2,
			total: 5,
		});
	});

	it("is zero with only state hints", () => {
		expect(markCount(items({ peers: [undefined], hasDevice: false }))).toEqual({
			critical: 0,
			warning: 0,
			early: 0,
			total: 0,
		});
	});
});

describe("isRecheckWarningDay", () => {
	it("marks riders waiting over 24 hours or a list in the wrong order", () => {
		expect(isRecheckWarningDay(recheck(TODAY))).toBe(false);
		expect(isRecheckWarningDay(recheck(TODAY, 1))).toBe(true);
		expect(isRecheckWarningDay(recheck(TODAY, 0, 1))).toBe(true);
	});
});
