import { describe, expect, it } from "vitest";
import { renderRides } from "../../src/http/rider-sections";
import type { ReasonLine } from "../../src/http/rider-view";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";

const en = createI18n("en", CATALOGS);

function rendered(reason: ReasonLine): string {
	return renderRides(en, {
		rows: [
			{
				activityId: 1,
				startDateLocal: "2026-10-06T08:00:00Z",
				sportType: "Ride",
				distanceM: 10000,
				elevationGainM: 0,
				status: "does-not-count",
				distanceRynke: 0,
				elevationM: 0,
				isVirtual: false,
				reasons: [reason],
				unknownFigures: [],
				fixHint: true,
			},
		],
		position: { from: 1, to: 1, total: 1 },
		pager: null,
	}).toString();
}

describe("renderRides reasons", () => {
	it("shows a whole speed limit without decimals", () => {
		expect(
			rendered({ code: "too_slow", kmhTenths: 99, limitKmh: 10 }),
		).toContain("Too slow: 9.9 km/h on average, at least 10 km/h needed.");
	});

	it("keeps a fractional speed limit", () => {
		expect(
			rendered({ code: "too_slow", kmhTenths: 99, limitKmh: 12.5 }),
		).toContain("at least 12.5 km/h needed.");
	});
});
