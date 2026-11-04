import { describe, expect, it } from "vitest";
import {
	type GraphRider,
	organiserGraphsView,
} from "../../src/http/organiser/progress-graphs";
import type { DayEntry, VirtualDayEntry } from "../../src/rynke/summary";

// The pure step from stored rows to what the organiser's graphs receive (feature
// 029 data-model.md "View"). Synthetic riders only.

const window = { seasonStart: "2026-01-01", deadline: "2026-06-30" };
const TODAY = "2026-03-01";

const rider = (
	id: number,
	name: string,
	status: GraphRider["status"] = "push",
): GraphRider => ({
	athleteId: id,
	firstName: name,
	status,
	profileLink: null,
});

function view(
	rows: {
		athleteId: number;
		days: DayEntry[];
		virtualDays?: VirtualDayEntry[];
	}[],
	riders: GraphRider[] = rows.map((r) => rider(r.athleteId, `R${r.athleteId}`)),
	today = TODAY,
) {
	return organiserGraphsView({
		rows: rows.map((r) => ({ virtualDays: [], ...r })),
		riders,
		requests: new Map(),
		window,
		today,
		group: null,
	});
}

describe("organiserGraphsView", () => {
	it("makes one point of a day however many rides it holds, split outdoor and virtual", () => {
		// The row already sums the day: 30 km of which 12.4 km virtual.
		const { riders } = view([
			{
				athleteId: 1,
				days: [["2026-01-03", 30000.4, 3, 2505]],
				virtualDays: [["2026-01-03", 12400.2]],
			},
		]);
		expect(riders[0]?.days).toEqual([[2, 17600, 12400, 2505]]);
	});

	it("puts elevation from virtual and outdoor rides in the same figure", () => {
		const { riders } = view([
			{
				athleteId: 1,
				days: [
					["2026-01-03", 10000, 1, 100],
					["2026-01-04", 10000, 1, 50],
				],
				virtualDays: [["2026-01-04", 10000]],
			},
		]);
		expect(riders[0]?.days).toEqual([
			[2, 10000, 0, 100],
			[3, 0, 10000, 50],
		]);
	});

	it("totals the team over all agreed riders, densely", () => {
		const { teamSum, agreedCount, lastDay } = view([
			{ athleteId: 1, days: [["2026-01-02", 1000, 1, 10]] },
			{
				athleteId: 2,
				days: [["2026-01-02", 2000, 1, 20]],
				virtualDays: [["2026-01-02", 500]],
			},
			{ athleteId: 3, days: [] },
		]);
		expect(agreedCount).toBe(3);
		expect(lastDay).toBe(TODAY);
		expect(teamSum.outdoorM).toHaveLength(60);
		expect(teamSum.outdoorM[1]).toBe(2500);
		expect(teamSum.virtualM[1]).toBe(500);
		expect(teamSum.elevationDm[1]).toBe(30);
		expect(teamSum.outdoorM[0]).toBe(0);
	});

	it("has no riders, zero agreed and empty sums when nobody agreed", () => {
		const result = view([], [rider(1, "Ada"), rider(2, "Ben", "in")]);
		expect(result.agreedCount).toBe(0);
		expect(result.riders).toEqual([]);
		expect(result.teamSum.outdoorM.every((v) => v === 0)).toBe(true);
		expect(result.notAgreed.map((r) => r.name)).toEqual(["Ada", "Ben"]);
	});

	it("keeps an agreed rider without rows, and lists who hasn't agreed by name only", () => {
		const result = view(
			[{ athleteId: 1, days: [] }],
			[rider(1, "Ada"), rider(2, "Ben", "on_track")],
		);
		expect(result.riders).toEqual([
			expect.objectContaining({ id: 1, name: "Ada", days: [] }),
		]);
		expect(result.notAgreed).toEqual([
			{ name: "Ben", status: "on_track", requests: false },
		]);
	});

	it("leaves out days before the season and after the deadline", () => {
		const { riders } = view(
			[
				{
					athleteId: 1,
					days: [
						["2025-12-31", 1000, 1, 10],
						["2026-07-01", 1000, 1, 10],
						["2026-06-30", 2000, 1, 10],
					],
				},
			],
			undefined,
			"2026-08-01",
		);
		expect(riders[0]?.days).toEqual([[180, 2000, 0, 10]]);
	});

	it("clamps a day past today to the last day, so the sums stay complete", () => {
		const { riders, teamSum } = view([
			{
				athleteId: 1,
				days: [
					["2026-03-01", 1000, 1, 10],
					["2026-03-02", 500, 1, 5],
				],
			},
		]);
		expect(riders[0]?.days).toEqual([[59, 1500, 0, 15]]);
		expect(teamSum.outdoorM[59]).toBe(1500);
	});

	it("gives the season's sums the counting rides add up to", () => {
		const days: DayEntry[] = [
			["2026-01-05", 40123.4, 4, 3000],
			["2026-02-05", 50000.2, 5, 1000],
		];
		const { riders } = view([
			{ athleteId: 1, days, virtualDays: [["2026-02-05", 50000.2]] },
		]);
		const sums = (riders[0]?.days ?? []).reduce(
			(sum, [, outdoor, virtual, elevation]) => ({
				outdoor: sum.outdoor + outdoor,
				virtual: sum.virtual + virtual,
				elevation: sum.elevation + elevation,
			}),
			{ outdoor: 0, virtual: 0, elevation: 0 },
		);
		expect(sums).toEqual({ outdoor: 40123, virtual: 50000, elevation: 4000 });
	});

	it("offers the presets ending on the last day, clamped to the season", () => {
		const { presets, firstDay, lastDay } = view([]);
		expect(firstDay).toBe("2026-01-01");
		expect(lastDay).toBe("2026-03-01");
		expect(presets.season).toEqual({ from: 0, to: 59 });
		expect(presets["4w"]).toEqual({ from: 32, to: 59 });
		expect(presets["3m"]).toEqual({ from: 0, to: 59 });
	});

	it("shows only the first day before the season has started", () => {
		const { lastDay, teamSum, presets } = view([], undefined, "2025-11-01");
		expect(lastDay).toBe("2026-01-01");
		expect(teamSum.outdoorM).toHaveLength(1);
		expect(presets.season).toEqual({ from: 0, to: 0 });
	});
});
