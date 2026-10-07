import { describe, expect, it } from "vitest";
import type { RideRow, RiderViewRead } from "../../src/db/rider-view";
import type { StoredBalance, StoredRideResult } from "../../src/db/rynke";
import {
	buildRiderView,
	type GaugePart,
	gaugeParts,
	type RiderView,
} from "../../src/http/rider-view";
import { CURRENT_RULES, type RynkeRules } from "../../src/rynke/rules";

// The rider page's view model (feature 005 data-model.md "Validation and
// invariants"). Pure: built from a reading, never from D1.

const CONTEXT = { seasonStart: "2026-01-01", importing: false };

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
): RideRow {
	return {
		activityId,
		sportType: "Ride",
		startDateLocal: "2026-10-06T08:00:00Z",
		distanceM: 79000,
		movingS: 10800,
		elapsedS: 11000,
		elevationGainM: 1240,
		result: stored,
		countedInstead: null,
	};
}

function read(overrides: Partial<RiderViewRead> = {}): RiderViewRead {
	return {
		balance: balance(),
		rideCount: 0,
		virtualCount: 0,
		page: 1,
		rides: [],
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
	it("S1-9: is not worked out yet and has no summary", () => {
		const view = buildRiderView(
			read({ balance: null, rideCount: 1, rides: [ride(1)] }),
			null,
			CURRENT_RULES,
			{ ...CONTEXT, importing: true },
		);
		expect(view.state).toBe("not-worked-out");
		expect(view).not.toHaveProperty("summary");
		expect(view.importing).toBe(true);
		expect(view.rides.rows.map((r) => r.activityId)).toEqual([1]);
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
	const lines = buildRiderView(
		read({ rideCount: 4, virtualCount: 1, rides: rows }),
		CURRENT_RULES,
		CURRENT_RULES,
		CONTEXT,
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

	it("places the rows in the whole table", () => {
		const view = buildRiderView(
			read({ rideCount: 4, rides: rows }),
			CURRENT_RULES,
			CURRENT_RULES,
			CONTEXT,
		);
		expect(view.rides.position).toEqual({ from: 1, to: 4, total: 4 });
		expect(view.rides.pager).toBeNull();
	});

	it("has an empty position without rides", () => {
		const view = buildRiderView(read(), CURRENT_RULES, CURRENT_RULES, CONTEXT);
		expect(view.rides.rows).toEqual([]);
		expect(view.rides.position).toEqual({ from: 0, to: 0, total: 0 });
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

describe("gaugeParts", () => {
	it("S2-6: divides six sources of 250 into 84 %", () => {
		const parts = gaugeParts(
			[
				{ source: "distance", value: 70 },
				{ source: "elevation", value: 30 },
				{ source: "team_training", value: 50 },
				{ source: "weekend_day", value: 40 },
				{ source: "technique", value: 10 },
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
