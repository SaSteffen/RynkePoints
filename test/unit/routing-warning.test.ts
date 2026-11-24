import { describe, expect, it } from "vitest";
import type { RoutingCount } from "../../src/routing/figures";
import { isWarningDay, routingDays } from "../../src/routing/warning";

// Feature 046 contracts/usage-view.md: the day table's rows and FR-025's mark.

const c = (
	day: string,
	team: string,
	figure: RoutingCount["figure"],
	count: number,
): RoutingCount => ({ day, team, figure, count });

describe("routingDays", () => {
	it("groups by day, newest first, this team apart from the others' sum", () => {
		const days = routingDays(
			[
				c("2026-11-22", "", "copy", 10),
				c("2026-11-23", "", "everyone", 1),
				c("2026-11-23", "hamburg", "dropped", 2),
				c("2026-11-23", "europe", "dropped", 3),
				c("2026-11-23", "north", "dropped", 4),
				c("2026-11-23", "europe", "added", 1),
				c("2026-11-23", "europe", "removed", 2),
			],
			"hamburg",
		);
		expect(days.map((d) => d.day)).toEqual(["2026-11-23", "2026-11-22"]);
		expect(days[0]).toMatchObject({
			everyone: 1,
			copy: 0,
			own: { dropped: 2, added: 0 },
			others: { dropped: 7, added: 1, removed: 2 },
		});
		expect(days[1]).toMatchObject({ copy: 10 });
	});
});

describe("isWarningDay", () => {
	const day = (counts: RoutingCount[]) => {
		const [first] = routingDays(counts, "hamburg");
		if (!first) throw new Error("no day");
		return isWarningDay(first);
	};

	it("marks a would-be miss or a possible miss on any team", () => {
		expect(day([c("2026-11-23", "hamburg", "missed", 1)])).toBe(true);
		expect(day([c("2026-11-23", "europe", "missed", 1)])).toBe(true);
		expect(day([c("2026-11-23", "europe", "possible", 1)])).toBe(true);
		expect(day([c("2026-11-23", "hamburg", "dropped", 9)])).toBe(false);
	});

	it("marks more than 1% sent to every team while every team routed", () => {
		const share = (all: number, everyone: number) =>
			day([
				c("2026-11-23", "", "allRouting", all),
				c("2026-11-23", "", "allRoutingEveryone", everyone),
			]);
		expect(share(100, 1)).toBe(false);
		expect(share(100, 2)).toBe(true);
		expect(share(0, 0)).toBe(false);
		// Sent to every team while some team wasn't routing: no mark.
		expect(
			day([
				c("2026-11-23", "", "everyone", 50),
				c("2026-11-23", "", "copy", 50),
			]),
		).toBe(false);
	});
});
