import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import {
	renderGauges,
	renderNotice,
	renderRideBatch,
	renderRides,
	renderRules,
	renderSummary,
	renderWaiting,
} from "../../src/http/rider-sections";
import type {
	Pager,
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
		more: null,
	}).toString();
}

function rendered(reason: ReasonLine): string {
	return table(line({ reasons: [reason] }));
}

describe("renderRides reasons", () => {
	it("shows a whole speed limit without decimals", () => {
		expect(
			rendered({ code: "too_slow", kmhTenths: 99, limitKmh: 10 }),
		).toContain(
			"Too slow: 9.9\u00a0km/h on average, at least 10\u00a0km/h needed.",
		);
	});

	it("keeps a fractional speed limit", () => {
		expect(
			rendered({ code: "too_slow", kmhTenths: 99, limitKmh: 12.5 }),
		).toContain("at least 12.5\u00a0km/h needed.");
	});
});

describe("renderRules window", () => {
	const rules = {
		version: 2,
		effectiveDate: "2026-11-01",
		seasonStart: "2026-01-01",
	};

	it("names the start and the deadline", () => {
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
			more: null,
		}).toString();
		expect(html).toMatch(
			/<h2>Your rides<\/h2>\n<img class="coin-art coin coin-large" src="\/coin\/rynke-coin-front\.svg" alt=""[^>]*>\n<p>No rides this season yet\.<\/p>/,
		);
	});

	it("gives each missing chip its kind's mini coin", () => {
		const html = renderSummary(
			en,
			{
				training: condition(17, 20),
				team: condition(3, 4),
				withoutVirtual: null,
				qualified: false,
			},
			"push",
		).toString();
		expect(html).toContain(
			'<span class="chip"><svg class="coin coin-mini" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#coin-mini"/></svg>3\u00a0Training Rynke</span>',
		);
		expect(html).toContain(
			'<span class="chip"><svg class="coin coin-mini coin-team" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#coin-mini"/></svg>1\u00a0Team Rynke</span>',
		);
	});

	it("shows Rynke on a bike and the plan sentence for each status (issues #92, #93)", () => {
		const behind = {
			training: condition(17, 20),
			team: condition(3, 4),
			withoutVirtual: null,
			qualified: false,
		};
		const cases = [
			[behind, "push", "You're behind the plan."],
			[behind, "on_track", "You're on plan."],
			[
				{
					training: condition(20, 20),
					team: condition(4, 4),
					withoutVirtual: null,
					qualified: true,
				},
				"in",
				"Ahead of plan: training goal reached.",
			],
		] as const;
		for (const [summary, status, sentence] of cases) {
			const html = renderSummary(en, summary, status).toString();
			expect(html).toContain(
				`<img class="status-art status-art-banner" src="/illustrations/status_${status}_fun.svg" alt="" width="128" height="128">`,
			);
			expect(html).toContain(
				`<p class="rynke-status">${escapeHtml(sentence)}</p>`,
			);
		}
	});

	it("says a qualified rider made it, with no list of what's missing", () => {
		const html = renderSummary(
			en,
			{
				training: condition(20, 20),
				team: condition(4, 4),
				withoutVirtual: null,
				qualified: true,
			},
			"in",
		).toString();
		expect(html).toContain("Qualified for Paris! 🗼");
		expect(html).not.toContain("rynke-missing");
	});

	it("edges the Training and Team gauges in their colour, with a row of ten", () => {
		const html = renderGauges(en, {
			training: gauge(130, 250),
			team: gauge(25, 25),
			withoutVirtual: null,
			elevation: { ...gauge(400, 10000), stepRynke: 5 },
		}).toString();
		const figures = [...html.matchAll(/<figure[\s\S]*?<\/figure>/g)].map(
			([f]) => f,
		);
		const cards = [...html.matchAll(/<section class="([^"]*)">\n<figure/g)].map(
			([, classes]) => classes,
		);
		expect(cards).toEqual([
			"card gauge-card-training",
			"card gauge-card-team",
			"card",
		]);
		// The coin rows use the coins; the captions don't repeat them (issue #92).
		expect(html).not.toContain('<use href="#coin-front"/>');
		expect(html).not.toContain('<use href="#coin-back"/>');
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
	it("shows the turning coin, the heading and the one-time message", () => {
		const html = renderWaiting(de, "2026-09-01", 7).toString();
		expect(html).toMatch(
			/^<section class="waiting" role="status" data-waiting data-poll-seconds="7">\n<span class="coin coin-large coin-flip" aria-hidden="true"><span class="coin-flip-turn"><img class="coin-art" src="\/coin\/rynke-coin-front\.svg" alt=""[^>]*><img class="coin-art coin-flip-back" src="\/coin\/rynke-coin-back\.svg" alt=""[^>]*><\/span><\/span>\n/,
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

// The continuous list's markup (018 contracts/pages.md, research R6, R7).
describe("renderRides lazy list (018 US1, US3)", () => {
	const KEY = { startDate: "2026-09-16T08:00:00Z", activityId: 8_000_040 };
	const MORE = "/me/rides/more?after=2026-09-16T08%3A00%3A00Z~8000040";

	function pager(page: number): Pager {
		return {
			page,
			lastPage: 3,
			first: page > 1 ? 1 : null,
			previous: page > 1 ? page - 1 : null,
			next: page < 3 ? page + 1 : null,
			last: page < 3 ? 3 : null,
		};
	}

	function lazy(page: number, more = page < 3 ? KEY : null): string {
		return renderRides(de, {
			rows: [line({ activityId: 8_000_040 })],
			position: { from: (page - 1) * 20 + 1, to: page * 20, total: 45 },
			pager: pager(page),
			more,
		}).toString();
	}

	it("marks the section and keeps the position line and the pager", () => {
		const html = lazy(1);
		expect(html).toMatch(/^<section id="rides" data-lazy>\n<h2>/);
		expect(html).toContain(
			'<p class="rides-position">Fahrten 1–20 von 45</p>',
		);
		expect(html).toContain('<nav class="pager" aria-label="Seiten">');
	});

	it("renders the season's total, hidden", () => {
		expect(lazy(1)).toContain(
			'<p class="rides-total" hidden>45 Fahrten in dieser Saison</p>',
		);
	});

	it("points the list at the rides after its last one", () => {
		expect(lazy(1)).toContain(
			`<ol class="ride-list" data-more="${MORE}">\n<li class="ride-card`,
		);
	});

	it("renders the status block with its texts and the retry button, hidden", () => {
		expect(lazy(1)).toContain(
			'<div class="rides-more" hidden><p class="rides-status" role="status" data-loading="Ältere Fahrten werden geladen …" data-failed="Ältere Fahrten konnten nicht geladen werden." data-added="Weitere Fahrten geladen"></p><button type="button" class="button-outlined" data-retry hidden>Erneut versuchen</button></div>\n<nav class="pager"',
		);
	});

	it("links to the newest rides only from page 2 on", () => {
		const link =
			'<p class="rides-newest" hidden><a class="tap" href="/me/rides">Zu den neuesten Fahrten</a></p>';
		expect(lazy(1)).not.toContain("rides-newest");
		expect(lazy(2)).toContain(link);
		expect(lazy(3)).toContain(link);
	});

	it("has no next batch on the last page", () => {
		const html = lazy(3);
		expect(html).toContain('<ol class="ride-list">\n');
		expect(html).not.toContain("data-more");
	});

	it("leaves a list of 20 rides or fewer as it was", () => {
		const html = renderRides(de, {
			rows: [line()],
			position: { from: 1, to: 1, total: 1 },
			pager: null,
			more: null,
		}).toString();
		expect(html).toMatch(/^<section id="rides">\n/);
		for (const part of [
			"data-lazy",
			"data-more",
			"rides-total",
			"rides-newest",
			"rides-more",
		]) {
			expect(html).not.toContain(part);
		}
	});

	it("speaks English in English", () => {
		const html = renderRides(en, {
			rows: [line()],
			position: { from: 21, to: 40, total: 1234 },
			pager: pager(2),
			more: KEY,
		}).toString();
		expect(html).toContain(
			'<p class="rides-total" hidden>1,234 rides this season</p>',
		);
		expect(html).toContain('href="/me/rides">To your newest rides</a>');
		expect(html).toContain('data-failed="Couldn&#39;t load older rides."');
	});
});

describe("renderRideBatch (018 contracts/http-routes.md)", () => {
	const KEY = { startDate: "2026-08-27T08:00:00Z", activityId: 8_000_040 };

	it("renders the cards of the page, with the next batch", () => {
		const rows = [line({ activityId: 7 }), line({ activityId: 8 })];
		const page = renderRides(de, {
			rows,
			position: { from: 21, to: 22, total: 45 },
			pager: null,
			more: null,
		}).toString();
		const cards = page.slice(page.indexOf("<li "), page.indexOf("</ol>"));
		expect(renderRideBatch(de, rows, KEY).toString()).toBe(
			`<ol class="ride-list" data-more="/me/rides/more?after=2026-08-27T08%3A00%3A00Z~8000040">\n${cards}</ol>`,
		);
	});

	it("ends without a next batch", () => {
		expect(renderRideBatch(de, [line()], null).toString()).toMatch(
			/^<ol class="ride-list">\n<li class="ride-card [^"]*">[\s\S]*<\/li>\n<\/ol>$/,
		);
	});

	it("renders an empty list after the last ride", () => {
		expect(renderRideBatch(de, [], null).toString()).toBe(
			'<ol class="ride-list">\n</ol>',
		);
	});
});
