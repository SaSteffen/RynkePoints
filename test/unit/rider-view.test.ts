import { describe, expect, it } from "vitest";
import type {
	AttendedEvent,
	RideRow,
	RiderViewRead,
} from "../../src/db/rider-view";
import type { StoredBalance, StoredRideResult } from "../../src/db/rynke";
import {
	buildRiderView,
	type GaugePart,
	gaugeParts,
	parsePage,
	type RiderView,
	type ViewContext,
} from "../../src/http/rider-view";
import type { ReasonCode } from "../../src/rynke/rides";
import {
	CURRENT_RULES,
	type RynkeRules,
	rulesForVersion,
} from "../../src/rynke/rules";
import { NO_EXTRAS } from "../../src/rynke/tally";
import {
	TEAM_EVENT_KINDS,
	type TeamEventKind,
	type TeamEventSum,
} from "../../src/rynke/team-events";

// The rider page's view model (feature 005 data-model.md "Validation and
// invariants"). Pure: built from a reading, never from D1.

const CONTEXT: ViewContext = {
	seasonStart: "2026-01-01",
	deadline: "2027-06-30",
	rulesFor: rulesForVersion,
};

function balance(overrides: Partial<StoredBalance> = {}): StoredBalance {
	return {
		distanceRynke: 0,
		elevationDm: 0,
		elevationRynke: 0,
		elevationToNextStepDm: 10000,
		trainingRynke: 0,
		teamRynke: 0,
		trainingMissing: 250,
		teamMissing: 25,
		trainingWithoutVirtual: 0,
		virtualShareMissing: 167,
		qualified: false,
		rulesVersion: CURRENT_RULES.version,
		rulesEffectiveDate: CURRENT_RULES.effectiveDate,
		teamEvents: [...NO_EXTRAS.teamEvents],
		computedAt: 0,
		...overrides,
	};
}

function result(
	activityId: number,
	overrides: Partial<StoredRideResult> = {},
): StoredRideResult {
	return {
		activityId,
		counts: true,
		reasons: [],
		overlapsActivityId: null,
		distanceRynke: 7,
		elevationDm: 12400,
		isVirtual: false,
		unknownFigures: [],
		activityRefreshedAt: 0,
		rulesVersion: CURRENT_RULES.version,
		...overrides,
	};
}

function ride(
	activityId: number,
	stored: StoredRideResult | null = null,
	overrides: Partial<RideRow> = {},
): RideRow {
	return {
		activityId,
		sportType: "Ride",
		startDateLocal: "2026-10-06T08:00:00Z",
		distanceM: 79000,
		movingS: 10800,
		elapsedS: 11000,
		elevationGainM: 1240,
		name: null,
		result: stored,
		countedInstead: null,
		...overrides,
	};
}

function read(overrides: Partial<RiderViewRead> = {}): RiderViewRead {
	return {
		balance: balance(),
		rideCount: 0,
		virtualCount: 0,
		page: 1,
		rides: [],
		attendance: [],
		...overrides,
	};
}

function ready(view: RiderView) {
	if (view.state !== "ready") throw new Error(`state ${view.state}`);
	return view;
}

function summaryOf(
	b: Partial<StoredBalance>,
	options: { virtualCount?: number; rules?: RynkeRules | null } = {},
) {
	return ready(
		buildRiderView(
			read({
				balance: balance(b),
				virtualCount: options.virtualCount ?? 0,
			}),
			options.rules === undefined ? CURRENT_RULES : options.rules,
			CURRENT_RULES,
			CONTEXT,
		),
	).summary;
}

describe("buildRiderView summary", () => {
	it("S1-1: shows what is missing of both targets", () => {
		const summary = summaryOf({
			trainingRynke: 12,
			trainingMissing: 238,
			trainingWithoutVirtual: 12,
			virtualShareMissing: 155,
		});
		expect(summary.training).toEqual({
			value: 12,
			target: 250,
			missing: 238,
			reached: false,
		});
		expect(summary.team).toEqual({
			value: 0,
			target: 25,
			missing: 25,
			reached: false,
		});
		expect(summary.qualified).toBe(false);
	});

	it("S1-2: shows both targets reached", () => {
		const summary = summaryOf({
			trainingRynke: 262,
			trainingMissing: 0,
			teamRynke: 25,
			teamMissing: 0,
			trainingWithoutVirtual: 262,
			virtualShareMissing: 0,
			qualified: true,
		});
		expect(summary.training).toEqual({
			value: 262,
			target: 250,
			missing: 0,
			reached: true,
		});
		expect(summary.team).toEqual({
			value: 25,
			target: 25,
			missing: 0,
			reached: true,
		});
		expect(summary.qualified).toBe(true);
	});

	it("S1-4: names only the team Rynke as missing", () => {
		const summary = summaryOf({
			trainingRynke: 400,
			trainingMissing: 0,
			teamRynke: 20,
			teamMissing: 5,
			trainingWithoutVirtual: 400,
			virtualShareMissing: 0,
		});
		expect(summary.training.reached).toBe(true);
		expect(summary.team).toEqual({
			value: 20,
			target: 25,
			missing: 5,
			reached: false,
		});
		expect(summary.qualified).toBe(false);
	});

	it("leaves out the share without virtual rides without a virtual ride", () => {
		expect(summaryOf({}).withoutVirtual).toBeNull();
	});

	it("S1-3: shows the share without virtual rides with a virtual ride", () => {
		const summary = summaryOf(
			{
				trainingRynke: 262,
				trainingMissing: 0,
				trainingWithoutVirtual: 160,
				virtualShareMissing: 7,
			},
			{ virtualCount: 1 },
		);
		expect(summary.withoutVirtual).toEqual({
			value: 160,
			target: 167,
			missing: 7,
			reached: false,
		});
	});

	it("S1-5: takes the targets from the balance's rules version", () => {
		const rules = { ...CURRENT_RULES, trainingThreshold: 300 };
		const summary = summaryOf(
			{ trainingRynke: 12, trainingMissing: 288 },
			{ virtualCount: 1, rules },
		);
		expect(summary.training.target).toBe(300);
		expect(summary.withoutVirtual?.target).toBe(200);
	});

	it("S1-5: shows the stored figures without targets for unknown rules", () => {
		const summary = summaryOf(
			{
				trainingRynke: 12,
				trainingMissing: 238,
				trainingWithoutVirtual: 10,
				virtualShareMissing: 157,
			},
			{ virtualCount: 1, rules: null },
		);
		expect(summary.training).toEqual({
			value: 12,
			target: null,
			missing: 238,
			reached: false,
		});
		expect(summary.team.target).toBeNull();
		expect(summary.withoutVirtual).toEqual({
			value: 10,
			target: null,
			missing: 157,
			reached: false,
		});
		expect(summary.qualified).toBe(false);
	});

	it("keeps reached and missing in step, never below zero", () => {
		for (const b of [
			{ trainingMissing: 0, teamMissing: 3, virtualShareMissing: 0 },
			{ trainingMissing: 1, teamMissing: 0, virtualShareMissing: 9 },
		]) {
			const summary = summaryOf(b, { virtualCount: 1 });
			for (const condition of [
				summary.training,
				summary.team,
				summary.withoutVirtual,
			]) {
				if (!condition) throw new Error("no condition");
				expect(condition.missing).toBeGreaterThanOrEqual(0);
				expect(condition.reached).toBe(condition.missing === 0);
			}
		}
	});
});

describe("buildRiderView without a balance", () => {
	it("015 R1: is waiting for the first data and holds nothing else", () => {
		const view = buildRiderView(
			read({ balance: null, rideCount: 1, rides: [ride(1)] }),
			null,
			CURRENT_RULES,
			CONTEXT,
		);
		expect(view).toEqual({ state: "waiting" });
	});

	it("015 R3: is ready with an empty ride list once a balance exists", () => {
		const view = ready(
			buildRiderView(
				read({ rideCount: 0, virtualCount: 0, rides: [] }),
				CURRENT_RULES,
				CURRENT_RULES,
				CONTEXT,
			),
		);
		expect(view.rides.rows).toEqual([]);
		expect(view).not.toHaveProperty("importing");
	});
});

describe("buildRiderView ride lines", () => {
	const rows = [
		ride(1),
		ride(2, result(2)),
		ride(
			3,
			result(3, {
				counts: false,
				reasons: ["too_slow"],
				distanceRynke: 0,
				elevationDm: 0,
			}),
		),
		ride(4, result(4, { isVirtual: true, distanceRynke: 3, elevationDm: 55 })),
	];
	const lines = ready(
		buildRiderView(
			read({ rideCount: 4, virtualCount: 1, rides: rows }),
			CURRENT_RULES,
			CURRENT_RULES,
			CONTEXT,
		),
	).rides.rows;

	it("keeps the read order", () => {
		expect(lines.map((l) => l.activityId)).toEqual([1, 2, 3, 4]);
	});

	it("S1-8: marks a ride without a result as being evaluated", () => {
		expect(lines[0]).toMatchObject({
			status: "being-evaluated",
			distanceRynke: 0,
			elevationM: 0,
			isVirtual: false,
		});
	});

	it("S1-6: carries a counting ride's stored Rynke and metres", () => {
		expect(lines[1]).toMatchObject({
			status: "counts",
			distanceRynke: 7,
			elevationM: 1240,
			sportType: "Ride",
			distanceM: 79000,
			elevationGainM: 1240,
			startDateLocal: "2026-10-06T08:00:00Z",
		});
	});

	it("S1-7: gives a ride that doesn't count nothing", () => {
		expect(lines[2]).toMatchObject({
			status: "does-not-count",
			distanceRynke: 0,
			elevationM: 0,
		});
	});

	it("marks a virtual ride", () => {
		expect(lines[3]).toMatchObject({
			status: "counts",
			distanceRynke: 3,
			elevationM: 5.5,
			isVirtual: true,
		});
	});

	it("carries the ride's name, or none (008 FR-005)", () => {
		const named = ready(
			buildRiderView(
				read({
					rideCount: 2,
					rides: [ride(1, null, { name: "Synthetic loop" }), ride(2)],
				}),
				CURRENT_RULES,
				CURRENT_RULES,
				CONTEXT,
			),
		).rides.rows;
		expect(named.map((l) => l.name)).toEqual(["Synthetic loop", null]);
	});

	it("places the rows in the whole table", () => {
		const view = ready(
			buildRiderView(
				read({ rideCount: 4, rides: rows }),
				CURRENT_RULES,
				CURRENT_RULES,
				CONTEXT,
			),
		);
		expect(view.rides.position).toEqual({ from: 1, to: 4, total: 4 });
		expect(view.rides.pager).toBeNull();
	});

	it("has an empty position without rides", () => {
		const view = ready(
			buildRiderView(read(), CURRENT_RULES, CURRENT_RULES, CONTEXT),
		);
		expect(view.rides.rows).toEqual([]);
		expect(view.rides.position).toEqual({ from: 0, to: 0, total: 0 });
		expect(view.rides.pager).toBeNull();
	});
});

describe("parsePage (US5, contracts/http-routes.md)", () => {
	const page = (query: string) =>
		parsePage(new URL(`https://rynke.test/me${query}`));

	it("reads a valid page", () => {
		expect(page("?page=2")).toBe(2);
		expect(page("?page=9999")).toBe(9999);
	});

	it.each([
		"",
		"?page=0",
		"?page=-1",
		"?page=01",
		"?page=abc",
		"?page=1e3",
		"?page=10000",
		"?page=2.0",
		"?page=",
	])("counts %j as page 1", (query) => {
		expect(page(query)).toBe(1);
	});

	it("counts two page parameters as page 1", () => {
		expect(page("?page=2&page=3")).toBe(1);
	});

	it("ignores other parameters", () => {
		expect(page("?x=1&page=3&y=abc")).toBe(3);
	});
});

describe("buildRiderView pager (US5)", () => {
	function table(rideCount: number, page: number) {
		const shown = Math.max(0, Math.min(20, rideCount - (page - 1) * 20));
		return ready(
			buildRiderView(
				read({
					rideCount,
					page,
					rides: Array.from({ length: shown }, (_, i) => ride(i + 1)),
				}),
				CURRENT_RULES,
				CURRENT_RULES,
				CONTEXT,
			),
		).rides;
	}

	it("S5-1: page 1 of 45 offers only the older pages", () => {
		const rides = table(45, 1);
		expect(rides.position).toEqual({ from: 1, to: 20, total: 45 });
		expect(rides.pager).toEqual({
			page: 1,
			lastPage: 3,
			first: null,
			previous: null,
			next: 2,
			last: 3,
		});
	});

	it("S5-2: page 2 of 45 offers all four links", () => {
		const rides = table(45, 2);
		expect(rides.position).toEqual({ from: 21, to: 40, total: 45 });
		expect(rides.pager).toEqual({
			page: 2,
			lastPage: 3,
			first: 1,
			previous: 1,
			next: 3,
			last: 3,
		});
	});

	it("S5-2: the last page offers only the newer pages", () => {
		const rides = table(45, 3);
		expect(rides.rows).toHaveLength(5);
		expect(rides.position).toEqual({ from: 41, to: 45, total: 45 });
		expect(rides.pager).toEqual({
			page: 3,
			lastPage: 3,
			first: 1,
			previous: 2,
			next: null,
			last: null,
		});
	});

	it("S5-3: 20 rides have no pager", () => {
		const rides = table(20, 1);
		expect(rides.position).toEqual({ from: 1, to: 20, total: 20 });
		expect(rides.pager).toBeNull();
	});

	it("0 rides have no rows and no pager", () => {
		const rides = table(0, 1);
		expect(rides.rows).toEqual([]);
		expect(rides.pager).toBeNull();
	});
});

function gaugesOf(
	b: Partial<StoredBalance>,
	options: { virtualCount?: number; rules?: RynkeRules | null } = {},
) {
	return ready(
		buildRiderView(
			read({
				balance: balance(b),
				virtualCount: options.virtualCount ?? 0,
			}),
			options.rules === undefined ? CURRENT_RULES : options.rules,
			CURRENT_RULES,
			CONTEXT,
		),
	).gauges;
}

function sum(parts: GaugePart<string>[]): number {
	return parts.reduce((total, part) => total + part.widthPercent, 0);
}

describe("buildRiderView gauges", () => {
	it("S2-1: fills to the percentage rounded down", () => {
		const gauges = gaugesOf({ trainingRynke: 12, distanceRynke: 12 });
		expect(gauges?.training).toMatchObject({
			value: 12,
			target: 250,
			percent: 4,
			reached: false,
		});
		expect(gauges?.team).toEqual({
			value: 0,
			target: 25,
			percent: 0,
			reached: false,
			parts: [],
		});
	});

	it("S2-2: is not reached one Rynke short", () => {
		expect(gaugesOf({ trainingRynke: 249 })?.training).toMatchObject({
			percent: 99,
			reached: false,
		});
	});

	it("S2-3: is reached at and above the target, capped at 100", () => {
		for (const trainingRynke of [250, 262]) {
			expect(gaugesOf({ trainingRynke })?.training).toMatchObject({
				value: trainingRynke,
				percent: 100,
				reached: true,
			});
		}
	});

	it("S2-4: shows the share without virtual rides with a virtual ride", () => {
		const gauges = gaugesOf(
			{ trainingRynke: 262, trainingWithoutVirtual: 160 },
			{ virtualCount: 1 },
		);
		expect(gauges?.withoutVirtual).toEqual({
			value: 160,
			target: 167,
			percent: 95,
			reached: false,
			parts: [],
		});
	});

	it("leaves out the share without virtual rides without a virtual ride", () => {
		expect(gaugesOf({})?.withoutVirtual).toBeNull();
	});

	it("S2-5: fills the elevation gauge within the current step", () => {
		expect(gaugesOf({ elevationToNextStepDm: 7600 })?.elevation).toEqual({
			value: 2400,
			target: 10000,
			percent: 24,
			reached: false,
			parts: [],
			stepRynke: 5,
		});
		const rules = { ...CURRENT_RULES, elevationStepM: 3000 };
		expect(
			gaugesOf({ elevationToNextStepDm: 30000 }, { rules })?.elevation,
		).toMatchObject({ value: 0, target: 30000, percent: 0 });
	});

	it("divides the Training gauge into distance and elevation", () => {
		const gauges = gaugesOf({
			trainingRynke: 100,
			distanceRynke: 70,
			elevationRynke: 30,
		});
		expect(gauges?.training.parts).toEqual([
			{ source: "distance", value: 70, widthPercent: 28 },
			{ source: "elevation", value: 30, widthPercent: 12 },
		]);
	});

	it("fills the whole bar in proportion above the target", () => {
		const parts =
			gaugesOf({ trainingRynke: 262, distanceRynke: 200, elevationRynke: 62 })
				?.training.parts ?? [];
		expect(parts.map((p) => p.source)).toEqual(["distance", "elevation"]);
		expect(sum(parts)).toBeLessThanOrEqual(100);
		expect(sum(parts)).toBeGreaterThan(99.98);
		expect(parts[0]?.widthPercent).toBeCloseTo((200 / 262) * 100, 1);
	});

	it("drops parts of 0", () => {
		expect(
			gaugesOf({ trainingRynke: 12, distanceRynke: 12 })?.training.parts,
		).toEqual([{ source: "distance", value: 12, widthPercent: 4.8 }]);
		expect(gaugesOf({})?.training.parts).toEqual([]);
	});

	it("leaves out the gauges when the rules are unknown", () => {
		expect(gaugesOf({ trainingRynke: 12 }, { rules: null })).toBeNull();
	});
});

/** The line of one ride that doesn't count for `reasons`. */
function lineOf(
	reasons: string[],
	activity: Partial<RideRow> = {},
	options: {
		result?: Partial<StoredRideResult>;
		context?: Partial<ViewContext>;
	} = {},
) {
	const stored = result(1, {
		counts: false,
		reasons: reasons as ReasonCode[],
		distanceRynke: 0,
		elevationDm: 0,
		...options.result,
	});
	const line = ready(
		buildRiderView(
			read({ rideCount: 1, rides: [ride(1, stored, activity)] }),
			CURRENT_RULES,
			CURRENT_RULES,
			{ ...CONTEXT, ...options.context },
		),
	).rides.rows[0];
	if (!line) throw new Error("no line");
	return line;
}

describe("buildRiderView ride reasons", () => {
	it("S4-2: gives the paused and the moving time under a 1/1 limit", () => {
		expect(
			lineOf(["pause"], { movingS: 14400, elapsedS: 32400 }).reasons,
		).toEqual([
			{
				code: "pause",
				pausedS: 18000,
				movingS: 14400,
				share: { num: 1, den: 1 },
			},
		]);
	});

	it("passes on the share of the result's rules", () => {
		const rules = { ...CURRENT_RULES, maxPausedShare: { num: 1, den: 3 } };
		expect(
			lineOf(
				["pause"],
				{ movingS: 14400, elapsedS: 25200 },
				{ context: { rulesFor: () => rules } },
			).reasons[0],
		).toMatchObject({ share: { num: 1, den: 3 } });
	});

	it("has no paused time without moving time", () => {
		expect(lineOf(["pause"], { movingS: 0, elapsedS: 3600 }).reasons).toEqual([
			{ code: "pause", pausedS: null, movingS: 0, share: { num: 1, den: 1 } },
		]);
	});

	it("S4-3: rounds a speed too slow down", () => {
		expect(
			lineOf(["manual", "too_slow"], { distanceM: 15000, movingS: 7200 })
				.reasons,
		).toEqual([
			{ code: "manual" },
			{ code: "too_slow", kmhTenths: 75, limitKmh: 10 },
		]);
		expect(
			lineOf(["too_slow"], { distanceM: 9960, movingS: 3600 }).reasons,
		).toEqual([{ code: "too_slow", kmhTenths: 99, limitKmh: 10 }]);
	});

	it("rounds a speed too fast up", () => {
		expect(
			lineOf(["too_fast"], { distanceM: 45010, movingS: 3600 }).reasons,
		).toEqual([{ code: "too_fast", kmhTenths: 451, limitKmh: 45 }]);
	});

	it("rounds a climbing rate up from the decimetres", () => {
		expect(
			lineOf(["climbing_rate"], { elevationGainM: 1500.4, movingS: 3600 })
				.reasons,
		).toEqual([{ code: "climbing_rate", mPerH: 1501, limitMPerH: 1500 }]);
	});

	it("carries the excluded sport type", () => {
		expect(
			lineOf(["excluded_sport_type"], { sportType: "EBikeRide" }).reasons,
		).toEqual([{ code: "excluded_sport_type", sportType: "EBikeRide" }]);
	});

	it("tells before the season start from after the deadline", () => {
		expect(
			lineOf(["outside_window"], { startDateLocal: "2025-12-31T23:00:00Z" })
				.reasons,
		).toEqual([{ code: "before_season", date: "2026-01-01" }]);
		expect(
			lineOf(["outside_window"], { startDateLocal: "2027-07-01T08:00:00Z" })
				.reasons,
		).toEqual([{ code: "after_deadline", date: "2027-06-30" }]);
	});

	it("S4-1: carries the ride that counted instead", () => {
		const countedInstead = {
			startDateLocal: "2026-10-06T08:00:00Z",
			distanceM: 80000,
		};
		expect(lineOf(["overlap"], { countedInstead }).reasons).toEqual([
			{ code: "overlap", countedInstead },
		]);
		expect(lineOf(["overlap"]).reasons).toEqual([
			{ code: "overlap", countedInstead: null },
		]);
	});

	it("keeps a code it doesn't know", () => {
		expect(lineOf(["new_rule"]).reasons).toEqual([
			{ code: "unknown", stored: "new_rule" },
		]);
	});

	it("FR-013: leaves out every limit when the result's rules are unknown", () => {
		const line = lineOf(
			["pause", "too_slow", "too_fast", "climbing_rate"],
			{
				distanceM: 15000,
				movingS: 7200,
				elapsedS: 14400,
				elevationGainM: 1000,
			},
			{ result: { rulesVersion: 99 } },
		);
		expect(line.reasons).toEqual([
			{ code: "pause", pausedS: 7200, movingS: 7200, share: null },
			{ code: "too_slow", kmhTenths: 75, limitKmh: null },
			{ code: "too_fast", kmhTenths: 75, limitKmh: null },
			{ code: "climbing_rate", mPerH: 500, limitMPerH: null },
		]);
	});

	it("keeps the stored order", () => {
		const codes = ["overlap", "flagged", "manual", "outside_window"];
		expect(lineOf(codes).reasons.map((r) => r.code)).toEqual([
			"overlap",
			"flagged",
			"manual",
			"after_deadline",
		]);
	});

	it("S4-7: offers the fix hint only for reasons a rider can fix", () => {
		for (const code of [
			"pause",
			"too_slow",
			"too_fast",
			"climbing_rate",
			"manual",
		]) {
			expect(lineOf(["flagged", code]).fixHint, code).toBe(true);
		}
		for (const code of [
			"flagged",
			"excluded_sport_type",
			"outside_window",
			"overlap",
		]) {
			expect(lineOf([code]).fixHint, code).toBe(false);
		}
	});

	it("has no reasons, and no fix hint, for a ride that counts", () => {
		const line = ready(
			buildRiderView(
				read({ rideCount: 1, rides: [ride(1, result(1))] }),
				CURRENT_RULES,
				CURRENT_RULES,
				CONTEXT,
			),
		).rides.rows[0];
		expect(line).toMatchObject({ reasons: [], fixHint: false });
	});

	it("S4-6: passes on the unknown figures of a counting ride", () => {
		const line = ready(
			buildRiderView(
				read({
					rideCount: 1,
					rides: [ride(1, result(1, { unknownFigures: ["elapsed_time"] }))],
				}),
				CURRENT_RULES,
				CURRENT_RULES,
				CONTEXT,
			),
		).rides.rows[0];
		expect(line).toMatchObject({
			status: "counts",
			unknownFigures: ["elapsed_time"],
		});
	});
});

function breakdownOf(
	b: Partial<StoredBalance>,
	rules: RynkeRules | null = CURRENT_RULES,
) {
	return ready(
		buildRiderView(
			read({ balance: balance(b) }),
			rules,
			CURRENT_RULES,
			CONTEXT,
		),
	).breakdown;
}

describe("buildRiderView breakdown", () => {
	it("S3-1: carries distance, elevation and totals", () => {
		expect(
			breakdownOf({
				distanceRynke: 7,
				elevationDm: 12400,
				elevationRynke: 5,
				elevationToNextStepDm: 7600,
				trainingRynke: 12,
			}),
		).toEqual({
			distanceRynke: 7,
			elevationM: 1240,
			elevationRynke: 5,
			elevationStepM: 1000,
			elevationStepRynke: 5,
			toNextStepM: 760,
			trainingTotal: 12,
			teamTotal: 0,
			kinds: NO_EXTRAS.teamEvents,
			events: [],
		});
	});

	it("S3-4: gives 15 Rynke and the whole step to go at 3000 m", () => {
		expect(
			breakdownOf({
				elevationDm: 30000,
				elevationRynke: 15,
				elevationToNextStepDm: 10000,
				trainingRynke: 15,
			}),
		).toMatchObject({
			elevationM: 3000,
			elevationRynke: 15,
			toNextStepM: 1000,
		});
	});

	it("rounds the total down and the metres to go up", () => {
		expect(
			breakdownOf({ elevationDm: 12345, elevationToNextStepDm: 7655 }),
		).toMatchObject({ elevationM: 1234, toNextStepM: 766 });
	});

	it("FR-035: adds up to the Training total without corrections", () => {
		for (const [distanceRynke, elevationRynke] of [
			[0, 0],
			[7, 5],
			[200, 62],
		] as const) {
			const breakdown = breakdownOf({
				distanceRynke,
				elevationRynke,
				trainingRynke: distanceRynke + elevationRynke,
			});
			expect(breakdown.distanceRynke + breakdown.elevationRynke).toBe(
				breakdown.trainingTotal,
			);
		}
	});

	it("leaves out the step when the rules are unknown", () => {
		expect(
			breakdownOf({ elevationDm: 12400, elevationToNextStepDm: 7600 }, null),
		).toMatchObject({
			elevationM: 1240,
			elevationStepM: null,
			elevationStepRynke: null,
			toNextStepM: 760,
		});
	});
});

/** Stored per-kind sums in `TEAM_EVENT_KINDS` order: `[attended, team, training]`. */
function kinds(
	teamTraining: [number, number, number],
	weekendDay: [number, number, number],
	technique: [number, number, number],
): TeamEventSum[] {
	return (
		[
			["team_training", teamTraining],
			["training_weekend_day", weekendDay],
			["technique_training", technique],
		] as const
	).map(([kind, [attended, team, training]]) => ({
		kind,
		attended,
		team,
		training,
	}));
}

/** The rider of US2 scenario 6, without its corrections. */
const EVENT_RIDER: Partial<StoredBalance> = {
	distanceRynke: 70,
	elevationRynke: 30,
	trainingRynke: 200,
	teamRynke: 40,
	teamEvents: kinds([10, 10, 50], [4, 20, 40], [2, 10, 10]),
};

function event(
	eventId: number,
	kind: TeamEventKind,
	date: string,
	name: string | null = null,
): AttendedEvent {
	return { eventId, kind, date, name };
}

describe("buildRiderView team events (US3b)", () => {
	it("S3-2: lists every kind in feature 003's order, also with 0", () => {
		const shown = breakdownOf({
			teamRynke: 7,
			trainingRynke: 15,
			teamEvents: kinds([2, 2, 10], [0, 0, 0], [1, 5, 5]),
		}).kinds;
		expect(shown.map((k) => k.kind)).toEqual([...TEAM_EVENT_KINDS]);
		expect(shown).toEqual(kinds([2, 2, 10], [0, 0, 0], [1, 5, 5]));
	});

	it("S3-5: lists every kind with 0 for a rider without attendance", () => {
		expect(breakdownOf({}).kinds).toEqual(
			kinds([0, 0, 0], [0, 0, 0], [0, 0, 0]),
		);
	});

	it("lists no kind for a balance stored before team events (R5)", () => {
		expect(breakdownOf({ teamEvents: [] }).kinds).toEqual([]);
	});

	it("S3-3: lists the events as read, newest first", () => {
		const attendance = [
			event(3, "technique_training", "2026-06-02", "Kurventechnik"),
			event(2, "team_training", "2026-05-12", "Ausfahrt Nord"),
			event(1, "team_training", "2026-04-28"),
		];
		const view = ready(
			buildRiderView(
				read({ attendance }),
				CURRENT_RULES,
				CURRENT_RULES,
				CONTEXT,
			),
		);
		expect(view.breakdown.events).toEqual([
			{
				date: "2026-06-02",
				kind: "technique_training",
				name: "Kurventechnik",
				counts: true,
			},
			{
				date: "2026-05-12",
				kind: "team_training",
				name: "Ausfahrt Nord",
				counts: true,
			},
			{ date: "2026-04-28", kind: "team_training", name: null, counts: true },
		]);
	});

	it("FR-033: marks events outside the counting window", () => {
		const attendance = [
			event(4, "team_training", "2026-10-01"),
			event(3, "team_training", "2026-09-30"),
			event(2, "team_training", "2026-01-01"),
			event(1, "team_training", "2025-12-31"),
		];
		const counts = (rules: RynkeRules | null, context = CONTEXT) =>
			ready(
				buildRiderView(read({ attendance }), rules, CURRENT_RULES, context),
			).breakdown.events.map((e) => e.counts);
		expect(
			counts(CURRENT_RULES, { ...CONTEXT, deadline: "2026-09-30" }),
		).toEqual([false, true, true, false]);
		expect(counts(CURRENT_RULES)).toEqual([true, true, true, false]);
		// The window is a team setting, so unknown rules use it too (FR-013).
		expect(counts(null)).toEqual([true, true, true, false]);
	});

	it("S2-6: divides the Training gauge by distance, elevation and kind", () => {
		const training = gaugesOf(EVENT_RIDER)?.training;
		expect(training?.percent).toBe(80);
		expect(training?.parts).toEqual([
			{ source: "distance", value: 70, widthPercent: 28 },
			{ source: "elevation", value: 30, widthPercent: 12 },
			{ source: "team_training", value: 50, widthPercent: 20 },
			{ source: "training_weekend_day", value: 40, widthPercent: 16 },
			{ source: "technique_training", value: 10, widthPercent: 4 },
		]);
		expect(sum(training?.parts ?? [])).toBe(80);
	});

	it("FR-022: divides the Team gauge by kind", () => {
		const team = gaugesOf(EVENT_RIDER)?.team;
		expect(team).toMatchObject({ value: 40, percent: 100, reached: true });
		expect(team?.parts).toEqual([
			{ source: "team_training", value: 10, widthPercent: 25 },
			{ source: "training_weekend_day", value: 20, widthPercent: 50 },
			{ source: "technique_training", value: 10, widthPercent: 25 },
		]);
		expect(
			gaugesOf({
				teamRynke: 5,
				teamEvents: kinds([0, 0, 0], [0, 0, 0], [1, 5, 5]),
			})?.team.parts,
		).toEqual([{ source: "technique_training", value: 5, widthPercent: 20 }]);
	});

	it("FR-035: adds up to both totals without corrections", () => {
		for (const teamEvents of [
			kinds([0, 0, 0], [0, 0, 0], [0, 0, 0]),
			kinds([2, 2, 10], [0, 0, 0], [1, 5, 5]),
			kinds([10, 10, 50], [4, 20, 40], [2, 10, 10]),
		]) {
			const training = 70 + 30 + teamEvents.reduce((n, k) => n + k.training, 0);
			const team = teamEvents.reduce((n, k) => n + k.team, 0);
			const shown = breakdownOf({
				distanceRynke: 70,
				elevationRynke: 30,
				trainingRynke: training,
				teamRynke: team,
				teamEvents,
			});
			expect(
				shown.distanceRynke +
					shown.elevationRynke +
					shown.kinds.reduce((n, k) => n + k.training, 0),
			).toBe(shown.trainingTotal);
			expect(shown.kinds.reduce((n, k) => n + k.team, 0)).toBe(shown.teamTotal);
		}
	});
});

describe("buildRiderView rules and notices (US6)", () => {
	const NEXT_RULES: RynkeRules = {
		...CURRENT_RULES,
		version: CURRENT_RULES.version + 1,
		effectiveDate: "2026-11-01",
	};

	it("S6-1: is not being updated under the version in effect", () => {
		const view = ready(
			buildRiderView(read(), CURRENT_RULES, CURRENT_RULES, CONTEXT),
		);
		expect(view.updating).toBeNull();
	});

	it("S6-2: is being updated when the versions differ (R4)", () => {
		const view = ready(
			buildRiderView(read(), CURRENT_RULES, NEXT_RULES, CONTEXT),
		);
		expect(view.updating).toEqual({
			inEffectVersion: NEXT_RULES.version,
			inEffectSince: "2026-11-01",
		});
		expect(view.rules.version).toBe(CURRENT_RULES.version);
	});

	it("labels the numbers with the balance's version and window", () => {
		const view = ready(
			buildRiderView(
				read({
					balance: balance({
						rulesVersion: NEXT_RULES.version,
						rulesEffectiveDate: "2026-11-01",
					}),
				}),
				NEXT_RULES,
				CURRENT_RULES,
				CONTEXT,
			),
		);
		expect(view.rules).toEqual({
			version: NEXT_RULES.version,
			effectiveDate: "2026-11-01",
			seasonStart: "2026-01-01",
			deadline: "2027-06-30",
		});
		expect(view.updating).toEqual({
			inEffectVersion: CURRENT_RULES.version,
			inEffectSince: CURRENT_RULES.effectiveDate,
		});
	});

	it("names the configured deadline, even when the rules are unknown", () => {
		for (const rules of [CURRENT_RULES, null]) {
			const view = ready(buildRiderView(read(), rules, CURRENT_RULES, CONTEXT));
			expect(view.rules.deadline).toBe("2027-06-30");
		}
	});
});

describe("gaugeParts", () => {
	it("S2-6: divides six sources of 250 into 84 %", () => {
		const parts = gaugeParts(
			[
				{ source: "distance", value: 70 },
				{ source: "elevation", value: 30 },
				{ source: "team_training", value: 50 },
				{ source: "training_weekend_day", value: 40 },
				{ source: "technique_training", value: 10 },
				{ source: "corrections", value: 10 },
			],
			250,
		);
		expect(parts.map((p) => p.widthPercent)).toEqual([28, 12, 20, 16, 4, 4]);
		expect(sum(parts)).toBe(84);
	});

	it("S2-7: is undivided when the corrections are negative", () => {
		expect(
			gaugeParts(
				[
					{ source: "distance", value: 70 },
					{ source: "corrections", value: -10 },
				],
				250,
			),
		).toEqual([]);
	});
});

describe("gauge invariants (SC-009)", () => {
	it("keeps the percentage within 0…100, 100 exactly when reached", () => {
		for (let trainingRynke = 0; trainingRynke <= 300; trainingRynke++) {
			const gauge = gaugesOf({
				trainingRynke,
				distanceRynke: trainingRynke,
			})?.training;
			if (!gauge) throw new Error("no gauge");
			expect(gauge.percent).toBeGreaterThanOrEqual(0);
			expect(gauge.percent).toBeLessThanOrEqual(100);
			expect(gauge.percent === 100).toBe(gauge.reached);
			expect(sum(gauge.parts)).toBeLessThanOrEqual(100);
		}
	});

	it("FR-023: qualifies exactly when every shown gauge is reached", () => {
		for (const training of [249, 250])
			for (const team of [24, 25])
				for (const withoutVirtual of [166, 167])
					for (const virtualCount of [0, 1]) {
						const shareMet = virtualCount === 0 || withoutVirtual >= 167;
						const qualified = training >= 250 && team >= 25 && shareMet;
						const view = ready(
							buildRiderView(
								read({
									virtualCount,
									balance: balance({
										trainingRynke: training,
										trainingMissing: Math.max(0, 250 - training),
										teamRynke: team,
										teamMissing: Math.max(0, 25 - team),
										trainingWithoutVirtual: withoutVirtual,
										virtualShareMissing:
											virtualCount === 0
												? 0
												: Math.max(0, 167 - withoutVirtual),
										qualified,
									}),
								}),
								CURRENT_RULES,
								CURRENT_RULES,
								CONTEXT,
							),
						);
						const gauges = view.gauges;
						if (!gauges) throw new Error("no gauges");
						const shown = [gauges.training, gauges.team, gauges.withoutVirtual];
						expect(view.summary.qualified).toBe(
							shown.every((gauge) => gauge === null || gauge.reached),
						);
					}
	});
});
