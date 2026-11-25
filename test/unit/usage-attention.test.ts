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
	dismissed: [],
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
				reasons: ["over24h", "unordered"],
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

const possible = (day: string, count = 1): RoutingCount => ({
	day,
	team: "hamburg",
	figure: "possible",
	count,
});

describe("reasons of day items (feature 050 research R2)", () => {
	it("gives a marked Strava calls day the reason calls", () => {
		expect(items({ calls: [calls(TODAY, true)] })).toEqual([
			expect.objectContaining({ kind: "calls", reasons: ["calls"] }),
		]);
	});

	it("names a re-check day's reasons, only those it has", () => {
		expect(items({ recheck: [recheck(TODAY, 1, 1)] })).toEqual([
			expect.objectContaining({ reasons: ["over24h", "unordered"] }),
		]);
		expect(items({ recheck: [recheck(TODAY, 1)] })).toEqual([
			expect.objectContaining({ reasons: ["over24h"] }),
		]);
		expect(items({ recheck: [recheck(TODAY, 0, 1)] })).toEqual([
			expect.objectContaining({ reasons: ["unordered"] }),
		]);
	});

	it("keeps a routing day's warnings as its reasons", () => {
		const list = items({
			routing: routingDays([missed(TODAY), possible(TODAY)], "hamburg"),
		});
		expect(list).toEqual([
			expect.objectContaining({
				kind: "routing",
				reasons: ["missed", "possible"],
			}),
		]);
	});
});

describe("dismissed day items (feature 050 data-model.md)", () => {
	const routing = routingDays([possible(YESTERDAY)], "hamburg");

	it("leaves out a day whose every reason is dismissed, and counts it no more", () => {
		const before = items({ routing });
		const after = items({
			routing,
			dismissed: [{ kind: "routing", day: YESTERDAY, reason: "possible" }],
		});
		expect(before).toHaveLength(1);
		expect(after).toEqual([]);
		expect(markCount(after).total).toBe(markCount(before).total - 1);
	});

	it("keeps it for a dismissal of another day or another kind", () => {
		expect(
			items({
				routing,
				dismissed: [
					{ kind: "routing", day: TODAY, reason: "possible" },
					{ kind: "recheck", day: YESTERDAY, reason: "possible" },
				],
			}),
		).toHaveLength(1);
	});

	it("leaves out Strava calls and re-check days with all reasons dismissed", () => {
		expect(
			items({
				calls: [calls(TODAY, true)],
				recheck: [recheck(YESTERDAY, 1, 1)],
				dismissed: [
					{ kind: "calls", day: TODAY, reason: "calls" },
					{ kind: "recheck", day: YESTERDAY, reason: "over24h" },
					{ kind: "recheck", day: YESTERDAY, reason: "unordered" },
				],
			}),
		).toEqual([]);
	});

	it("counts nothing with the only mark dismissed, and keeps the state hints", () => {
		const list = items({
			routing,
			peers: [undefined],
			hasDevice: false,
			dismissed: [{ kind: "routing", day: YESTERDAY, reason: "possible" }],
		});
		expect(markCount(list).total).toBe(0);
		expect(list.map((item) => item.kind)).toEqual(["team", "device"]);
	});

	it("never leaves out a figure or a CPU row", () => {
		const list = items({
			figures: [at("strava_read_daily", 95)],
			cpu: [cpu(SHARED, 100, 5)],
			dismissed: [
				{ kind: "routing", day: TODAY, reason: "possible" },
				{ kind: "calls", day: TODAY, reason: "calls" },
			],
		});
		expect(list.map((item) => item.kind).sort()).toEqual(["cpu", "figure"]);
	});
});

describe("a new reason brings a dismissed day back (feature 050 US3)", () => {
	it("shows a routing day again, with both reasons, after a would-be miss", () => {
		const list = items({
			routing: routingDays([missed(YESTERDAY), possible(YESTERDAY)], "hamburg"),
			dismissed: [{ kind: "routing", day: YESTERDAY, reason: "possible" }],
		});
		expect(list).toEqual([
			expect.objectContaining({
				kind: "routing",
				reasons: ["missed", "possible"],
			}),
		]);
	});

	it("keeps it dismissed when the same reason only grows", () => {
		expect(
			items({
				routing: routingDays([possible(YESTERDAY, 2)], "hamburg"),
				dismissed: [{ kind: "routing", day: YESTERDAY, reason: "possible" }],
			}),
		).toEqual([]);
	});

	it("shows a re-check day again once the list is also out of order", () => {
		const list = items({
			recheck: [recheck(YESTERDAY, 1, 1)],
			dismissed: [{ kind: "recheck", day: YESTERDAY, reason: "over24h" }],
		});
		expect(list).toEqual([
			expect.objectContaining({ reasons: ["over24h", "unordered"] }),
		]);
	});
});
