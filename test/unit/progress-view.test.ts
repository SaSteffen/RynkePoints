import { describe, expect, it } from "vitest";
import type { RiderViewRead } from "../../src/db/rider-view";
import { buildProgressView, paceAt } from "../../src/http/progress-view";
import { evenPace, riderStatus } from "../../src/rynke/pace";
import { CURRENT_RULES } from "../../src/rynke/rules";
import { tally } from "../../src/rynke/tally";
import type { CurveInputs } from "../../src/rynke/weeks";
import {
	EXAMPLE_BALANCE,
	EXAMPLE_INPUTS,
	EXAMPLE_TODAY,
	EXAMPLE_WINDOW,
} from "../support/progress";
import { ZERO_BALANCE } from "../support/rider-view";

// `buildProgressView` (feature 009 data-model.md "View model"). Expected
// figures are the example rider's, worked out by hand in tasks.md.

type Read = Pick<RiderViewRead, "balance" | "virtualCount" | "progress">;

const EXAMPLE: Read = {
	balance: { ...EXAMPLE_BALANCE, computedAt: 0 },
	virtualCount: 0,
	progress: EXAMPLE_INPUTS,
};

const build = (read: Read = EXAMPLE, today = EXAMPLE_TODAY) =>
	buildProgressView(read, CURRENT_RULES, EXAMPLE_WINDOW, today);

function ready(read: Read = EXAMPLE, today = EXAMPLE_TODAY) {
	const view = build(read, today);
	if (view.state !== "ready") throw new Error("no progress view");
	return view;
}

/** A rider with `training` Training Rynke from one ride on 2 September. */
function riderWith(training: number, team: number, virtual = 0): Read {
	const inputs: CurveInputs = {
		rides: [
			{
				date: "2026-09-02",
				virtual: false,
				distanceRynke: training - virtual,
				elevationDm: 0,
			},
			...(virtual > 0
				? [
						{
							date: "2026-09-03",
							virtual: true,
							distanceRynke: virtual,
							elevationDm: 0,
						},
					]
				: []),
		],
		attendance: [],
		corrections: team > 0 ? [{ date: "2026-09-04", training: 0, team }] : [],
	};
	return {
		balance: {
			...ZERO_BALANCE,
			distanceRynke: training,
			trainingRynke: training,
			teamRynke: team,
			trainingWithoutVirtual: training - virtual,
			computedAt: 0,
		},
		virtualCount: virtual > 0 ? 1 : 0,
		progress: inputs,
	};
}

describe("buildProgressView (feature 009)", () => {
	it("spans the season on a day axis up to today", () => {
		const view = ready();
		expect(view).toMatchObject({
			seasonStart: "2026-09-01",
			deadline: "2027-06-30",
			lastDay: "2026-10-07",
			axisDays: 302,
			lastIndex: 36,
			rulesVersion: CURRENT_RULES.version,
			nothingYet: false,
		});
		expect(view.training.values).toHaveLength(37);
		expect(view.team.values).toHaveLength(37);
		expect(view.training.values[19]).toBe(69);
		expect(view.team.values[19]).toBe(11);
		expect(view.training.values[36]).toBe(112);
		expect(view.team.values[36]).toBe(17);
		expect(view.training.threshold).toBe(250);
		expect(view.team.threshold).toBe(25);
	});

	it("scales y to the threshold or the season's highest value (R5)", () => {
		expect(ready().training.yMax).toBe(250);
		expect(ready().team.yMax).toBe(25);
		const high = ready(riderWith(262, 26));
		expect(high.training.yMax).toBe(300);
		expect(high.team.yMax).toBe(30);
	});

	it("offers the last 4 weeks once they start after the season start", () => {
		expect(ready().presets).toEqual([
			{ preset: "season", from: 0, to: 302 },
			{ preset: "4w", from: 9, to: 36 },
		]);
		expect(ready(EXAMPLE, "2026-09-20").presets).toEqual([
			{ preset: "season", from: 0, to: 302 },
		]);
	});

	it("offers the last 3 months from 1 December", () => {
		expect(ready(EXAMPLE, "2026-11-30").presets.map((p) => p.preset)).toEqual([
			"season",
			"4w",
		]);
		expect(ready(EXAMPLE, "2026-12-01").presets).toEqual([
			{ preset: "season", from: 0, to: 302 },
			{ preset: "3m", from: 1, to: 91 },
			{ preset: "4w", from: 64, to: 91 },
		]);
	});

	it("lists the weeks with what each earned (R11)", () => {
		expect(ready().weeks).toEqual(
			[
				["2026-09-01", 21, 21, 1, 1],
				["2026-09-07", 9, 30, 0, 1],
				["2026-09-14", 39, 69, 10, 11],
				["2026-09-21", 11, 80, 5, 16],
				["2026-09-28", 32, 112, 1, 17],
				["2026-10-05", 0, 112, 0, 17],
			].map(([firstDay, te, tt, me, mt]) => ({
				firstDay,
				training: { earned: te, total: tt },
				team: { earned: me, total: mt },
				outside: null,
			})),
		);
	});

	it("says when there is nothing yet (FR-015)", () => {
		expect(ready(riderWith(0, 0)).nothingYet).toBe(true);
		expect(ready(riderWith(5, 0)).nothingYet).toBe(false);
	});

	it("is left out without a balance or with unknown rules (FR-016, FR-040)", () => {
		expect(build({ ...EXAMPLE, balance: null })).toEqual({ state: "none" });
		expect(
			buildProgressView(EXAMPLE, null, EXAMPLE_WINDOW, EXAMPLE_TODAY),
		).toEqual({ state: "none" });
		expect(build({ ...EXAMPLE, progress: undefined })).toEqual({
			state: "none",
		});
	});

	describe("pace and the outdoor curve (US2)", () => {
		it("draws the pace in both charts; the example rider is ahead", () => {
			const view = ready();
			expect(view.training.pace).toBe(true);
			expect(view.team.pace).toBe(true);
			// 4 October is index 33: ⌊250 × 33 ÷ 302⌋ = 27, ⌊25 × 33 ÷ 302⌋ = 2.
			expect(paceAt(250, 33, 302)).toBe(27);
			expect(paceAt(25, 33, 302)).toBe(2);
			expect((view.training.values[33] ?? 0) - 27).toBe(85);
			expect((view.team.values[33] ?? 0) - 2).toBe(15);
		});

		it("computes the pace as evenPace does, every day", () => {
			const date = (i: number) =>
				new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
			for (const threshold of [250, 25, 167]) {
				for (let i = 0; i <= 302; i++) {
					expect(paceAt(threshold, i, 302)).toBe(
						evenPace(threshold, "2026-09-01", "2027-06-30", date(i)),
					);
				}
			}
		});

		it("adds the outdoor curve only with virtual rides (FR-039)", () => {
			expect(ready().outside).toBeNull();
			const view = ready(riderWith(150, 0, 100));
			expect(view.outside).toMatchObject({
				threshold: 167,
				needed: 167,
				yMax: 250,
				pace: true,
			});
			expect(view.outside?.values.at(-1)).toBe(50);
			expect(view.training.values.at(-1)).toBe(150);
			expect(view.weeks[0]?.outside).toEqual({ earned: 50, total: 50 });
			expect(view.weeks.at(-1)?.outside).toEqual({ earned: 0, total: 50 });
		});

		it("is below a drawn pace exactly when the rider status is push", () => {
			const riders = [
				EXAMPLE,
				riderWith(0, 0),
				riderWith(40, 3),
				riderWith(150, 20, 100),
				riderWith(262, 26),
			];
			for (const read of riders) {
				for (const today of [
					"2026-09-15",
					EXAMPLE_TODAY,
					"2026-11-20",
					"2027-01-10",
					"2027-03-01",
				]) {
					const view = ready(read, today);
					const i = view.lastIndex;
					const t = view.training.values[i] ?? 0;
					const m = view.team.values[i] ?? 0;
					const o = view.outside?.values[i] ?? t;
					const below =
						t < paceAt(250, i, view.axisDays) ||
						m < paceAt(25, i, view.axisDays) ||
						o < paceAt(167, i, view.axisDays);
					const balance = {
						...tally(
							{
								distanceRynke: t,
								elevationDm: 0,
								elevationRynke: 0,
								withoutVirtual: {
									distanceRynke: o,
									elevationDm: 0,
									elevationRynke: 0,
								},
							},
							{ training: 0, team: m, teamEvents: [] },
							CURRENT_RULES,
						),
					};
					const status = riderStatus(
						balance,
						CURRENT_RULES,
						EXAMPLE_WINDOW,
						today,
					);
					expect(status === "push", `${today} ${t}/${m}/${o}`).toBe(
						below && !balance.qualified,
					);
				}
			}
		});
	});
});
