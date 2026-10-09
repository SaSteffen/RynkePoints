import { describe, expect, it } from "vitest";
import {
	renderGauges,
	renderNotice,
	renderRides,
	renderRules,
	renderSummary,
	renderWaiting,
} from "../../src/http/rider-sections";
import type {
	ReasonLine,
	RideLine,
	RiderView,
} from "../../src/http/rider-view";
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

// The Rynke coin in the sections (feature 012 FR-001, FR-003, FR-004).
describe("coins", () => {
	const condition = (value: number, target: number) => ({
		value,
		target,
		missing: Math.max(target - value, 0),
		reached: value >= target,
	});
	const gauge = (value: number, target: number) => ({
		value,
		target,
		percent: Math.min(Math.floor((value * 100) / target), 100),
		reached: value >= target,
		parts: [],
	});

	it("marks a counting ride's Training Rynke with a mini coin", () => {
		const html = table(
			line({ status: "counts", distanceRynke: 2, fixHint: false }),
		);
		expect(html).toContain(
			'<dd>2 <svg class="coin coin-mini" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#coin-mini"/></svg></dd>',
		);
	});

	it("puts no coin on a ride that earned none", () => {
		expect(table(line({ status: "counts", distanceRynke: 0 }))).not.toContain(
			"coin-mini",
		);
	});

	it("shows the coin above an empty ride list", () => {
		const html = renderRides(en, {
			rows: [],
			position: { from: 0, to: 0, total: 0 },
			pager: null,
		}).toString();
		expect(html).toMatch(
			/<h2>Your rides<\/h2>\n<svg class="coin coin-large"[^>]*><use href="#coin-front"\/><\/svg>\n<p>No rides this season yet\.<\/p>/,
		);
	});

	it("gives each missing chip its kind's mini coin", () => {
		const html = renderSummary(en, {
			training: condition(17, 20),
			team: condition(3, 4),
			withoutVirtual: null,
			qualified: false,
		}).toString();
		expect(html).toContain(
			'<span class="chip"><svg class="coin coin-mini" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#coin-mini"/></svg>3 Training Rynke</span>',
		);
		expect(html).toContain(
			'<span class="chip"><svg class="coin coin-mini coin-team" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#coin-mini"/></svg>1 Team Rynke</span>',
		);
	});

	it("shows the Hamburg–Paris side to a rider who qualified", () => {
		const html = renderSummary(en, {
			training: condition(20, 20),
			team: condition(4, 4),
			withoutVirtual: null,
			qualified: true,
		}).toString();
		expect(html).toContain('<use href="#coin-back"/>');
	});

	it("heads the Training and Team gauges with their coin and a row of ten", () => {
		const html = renderGauges(en, {
			training: gauge(130, 250),
			team: gauge(25, 25),
			withoutVirtual: null,
			elevation: { ...gauge(400, 10000), stepRynke: 5 },
		}).toString();
		const figures = [...html.matchAll(/<figure[\s\S]*?<\/figure>/g)].map(
			([f]) => f,
		);
		expect(figures[0]).toContain('<use href="#coin-front"/>');
		expect(figures[1]).toContain('<use href="#coin-back"/>');
		const row = (f = "") =>
			f.match(
				/<span class="coin-row" aria-hidden="true">([\s\S]*?)<\/span>\n/,
			)?.[1] ?? "";
		expect(row(figures[0]).match(/class="coin coin-mini"/g)).toHaveLength(5);
		expect(row(figures[0]).match(/coin-slot/g)).toHaveLength(5);
		expect(
			row(figures[1]).match(/class="coin coin-mini coin-team"/g),
		).toHaveLength(10);
		expect(figures[2]).not.toContain("coin-row");
	});
});

// The waiting state before the first data (015 contracts/pages.md).
describe("renderWaiting", () => {
	it("shows the spinning coin, the heading and the one-time message", () => {
		const html = renderWaiting(de, "2026-09-01", 7).toString();
		expect(html).toMatch(
			/^<section class="waiting" role="status" data-waiting data-poll-seconds="7">\n<svg class="coin coin-large"[^>]*><use href="#coin-front"\/><\/svg>\n/,
		);
		expect(html).toContain(`<h2>${de.t("waiting.heading")}</h2>`);
		expect(html).toContain(
			`<p>${de.t("waiting.body", { date: de.formatDate("2026-09-01T00:00:00Z") })}</p>`,
		);
		expect(html).toContain("01.09.2026");
	});
});

describe("renderNotice", () => {
	it("shows nothing while waiting", () => {
		expect(renderNotice(en, { state: "waiting" })).toBeNull();
	});

	it("shows only the rule-change notice", () => {
		const view = {
			state: "ready",
			updating: { inEffectVersion: 3, inEffectSince: "2026-11-01" },
			rules: { version: 2 },
		} as unknown as RiderView;
		const html = renderNotice(en, view)?.toString() ?? "";
		expect(html).toBe(`<section class="notice" role="status">
<p>${en.t("rynke.notice.updating", { date: "01/11/2026", version: "2" })}</p>
</section>`);
	});

	it("shows nothing when the rules are current", () => {
		const view = {
			state: "ready",
			updating: null,
			rules: { version: 2 },
		} as unknown as RiderView;
		expect(renderNotice(en, view)).toBeNull();
	});
});
