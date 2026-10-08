import { describe, expect, it } from "vitest";
import { renderRides, renderRules } from "../../src/http/rider-sections";
import type { ReasonLine, RideLine } from "../../src/http/rider-view";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";

const en = createI18n("en", CATALOGS);
const de = createI18n("de", CATALOGS);

function line(overrides: Partial<RideLine> = {}): RideLine {
	return {
		activityId: 1,
		name: null,
		startDateLocal: "2026-10-06T08:00:00Z",
		sportType: "Ride",
		distanceM: 10000,
		elevationGainM: 0,
		status: "does-not-count",
		distanceRynke: 0,
		elevationM: 0,
		isVirtual: false,
		reasons: [],
		unknownFigures: [],
		fixHint: true,
		...overrides,
	};
}

function table(ride: RideLine, i18n = en): string {
	return renderRides(i18n, {
		rows: [ride],
		position: { from: 1, to: 1, total: 1 },
		pager: null,
	}).toString();
}

function rendered(reason: ReasonLine): string {
	return table(line({ reasons: [reason] }));
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

describe("renderRules window", () => {
	const rules = {
		version: 2,
		effectiveDate: "2026-11-01",
		seasonStart: "2026-01-01",
	};

	it("names only the start without a deadline", () => {
		expect(renderRules(en, { ...rules, deadline: null }).toString()).toContain(
			"Everything from 01/01/2026 counts.",
		);
	});

	it("names the deadline when the rules have one", () => {
		expect(
			renderRules(en, { ...rules, deadline: "2027-03-31" }).toString(),
		).toContain("Everything from 01/01/2026 to 31/03/2027 counts.");
	});
});

describe("renderRides card disclosure (011 FR-021, clarification Q5)", () => {
	it.each([
		["does-not-count", "ride-not-counting", true],
		["counts", "ride-counting", false],
		["being-evaluated", "ride-pending", false],
	] as const)("a ride that %s gets %s, open: %s", (status, cls, open) => {
		const out = table(line({ status }));
		expect(out).toContain(`<li class="ride-card ${cls}">`);
		expect(out).toContain(
			`<details class="ride-why"${open ? " open" : ""}><summary class="tap">Why?</summary>`,
		);
	});

	it("leaves the disclosure out when there is nothing to explain", () => {
		const out = table(line({ status: "counts", fixHint: false }));
		expect(out).not.toContain("<details");
		expect(out).not.toContain("<summary");
	});

	it("puts the explanation inside the disclosure", () => {
		const out = table(line({ reasons: [{ code: "unknown", stored: "x" }] }));
		expect(out).toMatch(
			/<details class="ride-why" open><summary class="tap">Why\?<\/summary><ul class="ride-reasons">/,
		);
	});
});

describe("renderRides link to Strava (008 FR-009, FR-011)", () => {
	const link =
		'<p class="ride-strava"><a class="tap strava-activity" href="https://www.strava.com/activities/8000001">View on Strava</a></p>';

	for (const status of [
		"being-evaluated",
		"counts",
		"does-not-count",
	] as const) {
		it(`puts the link after the figures for a ride that ${status}`, () => {
			const out = table(line({ status, activityId: 8000001 }));
			expect(out).toContain(`</dl>\n${link}`);
		});
	}

	it("opens in the same tab (research R4)", () => {
		const tag = table(line({ activityId: 8000001 })).match(
			/<a [^>]*strava-activity[^>]*>/,
		)?.[0];
		expect(tag).toBeDefined();
		expect(tag).not.toContain("target");
		expect(tag).not.toContain("rel");
	});

	it("keeps the English link text on the German page", () => {
		expect(table(line({ activityId: 8000001 }), de)).toContain(link);
	});
});

describe("renderRides ride name (008 FR-005, FR-010)", () => {
	it("shows the name as escaped text before the link", () => {
		const out = table(line({ name: "Loop <b> & 🚴", activityId: 8000001 }));
		expect(out).toContain(
			'<p class="ride-strava"><span class="ride-name">Loop &lt;b&gt; &amp; 🚴</span> <a class="tap strava-activity"',
		);
		expect(out).not.toContain("<b>");
	});

	it("shows no name and no placeholder when it is unknown", () => {
		const out = table(line({ name: null }));
		expect(out).not.toContain("ride-name");
		expect(out).toContain('<p class="ride-strava"><a ');
	});
});
