import { describe, expect, it } from "vitest";
import { renderProgress } from "../../src/http/progress-section";
import { buildProgressView } from "../../src/http/progress-view";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { CURRENT_RULES } from "../../src/rynke/rules";
import {
	EXAMPLE_BALANCE,
	EXAMPLE_INPUTS,
	EXAMPLE_TODAY,
	EXAMPLE_WINDOW,
} from "../support/progress";
import { ZERO_BALANCE } from "../support/rider-view";

// The section's markup (feature 009 contracts/overview-section.md): structure,
// not styling. Texts are asserted from the German catalog.

const de = createI18n("de", CATALOGS);
const en = createI18n("en", CATALOGS);
const c = CATALOGS.de;

const exampleView = buildProgressView(
	{
		balance: { ...EXAMPLE_BALANCE, computedAt: 0 },
		virtualCount: 0,
		progress: EXAMPLE_INPUTS,
	},
	CURRENT_RULES,
	EXAMPLE_WINDOW,
	EXAMPLE_TODAY,
);

/** 150 Training Rynke, 100 of them from a virtual ride; no Team Rynke. */
const virtualView = buildProgressView(
	{
		balance: {
			...ZERO_BALANCE,
			distanceRynke: 150,
			trainingRynke: 150,
			trainingWithoutVirtual: 50,
			computedAt: 0,
		},
		virtualCount: 1,
		progress: {
			rides: [
				{
					date: "2026-09-02",
					virtual: false,
					distanceRynke: 50,
					elevationDm: 0,
				},
				{
					date: "2026-09-03",
					virtual: true,
					distanceRynke: 100,
					elevationDm: 0,
				},
			],
			attendance: [],
			corrections: [],
		},
	},
	CURRENT_RULES,
	EXAMPLE_WINDOW,
	EXAMPLE_TODAY,
);

const zeroView = buildProgressView(
	{
		balance: { ...ZERO_BALANCE, computedAt: 0 },
		virtualCount: 0,
		progress: { rides: [], attendance: [], corrections: [] },
	},
	CURRENT_RULES,
	EXAMPLE_WINDOW,
	EXAMPLE_TODAY,
);

const page = String(renderProgress(de, exampleView));
const virtualPage = String(renderProgress(de, virtualView));

const all = (text: string, re: RegExp) => [...text.matchAll(re)];

function data(html: string): Record<string, unknown> {
	const json = html.match(
		/<script type="application\/json" id="progress-data">([\s\S]*?)<\/script>/,
	)?.[1];
	return JSON.parse(json ?? "null");
}

describe("renderProgress (feature 009)", () => {
	it("is a section with the page's locale", () => {
		expect(page).toMatch(
			/^<section id="progress" class="progress card card-outlined" aria-labelledby="progress-heading" data-locale="de-DE">/,
		);
		expect(page).toContain(
			`<h2 id="progress-heading">${c["progress.heading"]}</h2>`,
		);
		expect(page).toContain(c["progress.rules"].replace("{version}", "3"));
		expect(String(renderProgress(en, exampleView))).toContain(
			'data-locale="en-GB"',
		);
	});

	it("renders nothing without a view (FR-016, FR-040)", () => {
		expect(renderProgress(de, { state: "none" })).toBeNull();
	});

	it("offers the period buttons in one group (FR-020)", () => {
		expect(page).toContain(
			`<div class="progress-periods" role="group" aria-label="${c["progress.periods.label"]}">`,
		);
		const buttons = all(
			page,
			/<button type="button" class="chip" data-from="(\d+)" data-to="(\d+)" aria-pressed="(\w+)">([^<]*)<\/button>/g,
		).map(([, from, to, pressed, text]) => [from, to, pressed, text]);
		expect(buttons).toEqual([
			["0", "302", "true", c["progress.period.season"]],
			["9", "36", "false", c["progress.period.4w"]],
		]);
		expect(page).not.toContain(c["progress.period.3m"]);
		expect(page).not.toContain("data-move");
		expect(page).not.toContain("data-reset");
	});

	it("gives each chart a focusable, labelled canvas and a label template (FR-050, FR-053)", () => {
		const canvases = all(
			page,
			/<canvas data-series="(\w+)" role="img" tabindex="0" aria-describedby="progress-help" aria-label="([^"]*)"><\/canvas>/g,
		).map(([, series, label]) => [series, label]);
		expect(canvases).toEqual([
			[
				"training",
				"Trainingsrynke vom 01.09.2026 bis 30.06.2027: 112 am Ende, Ziel 250",
			],
			["team", "Teamrynke vom 01.09.2026 bis 30.06.2027: 17 am Ende, Ziel 25"],
		]);
		for (const series of ["training", "team"]) {
			const template = page.match(
				new RegExp(`<template data-label="${series}">([\\s\\S]*?)</template>`),
			)?.[1];
			for (const name of ["from", "to", "value", "threshold"]) {
				expect(template).toContain(`<span data-slot="${name}"></span>`);
			}
		}
		expect(page).toContain(
			`<p id="progress-help" class="progress-help">${c["progress.help"]}</p>`,
		);
	});

	it("names every line in an HTML legend with its threshold", () => {
		expect(page).toContain(
			`<span class="progress-key key-threshold" aria-hidden="true"></span>${c["progress.legend.threshold"].replace("{value}", "250")}`,
		);
		expect(page).toContain(
			`<span class="progress-key key-threshold" aria-hidden="true"></span>${c["progress.legend.threshold"].replace("{value}", "25")}`,
		);
		expect(all(page, /key-curve/g)).toHaveLength(2);
	});

	it("has a live readout and a day template with slots (FR-030)", () => {
		expect(page).toContain(
			'<p class="progress-readout" aria-live="polite"></p>',
		);
		const day = page.match(
			/<template data-readout="day">([\s\S]*?)<\/template>/,
		)?.[1];
		for (const name of ["date", "training", "team"]) {
			expect(day).toContain(`<span data-slot="${name}"></span>`);
		}
	});

	it("lists every week in a table (FR-037, FR-051)", () => {
		expect(page).toContain(
			`<details class="progress-table">\n<summary>${c["progress.table.summary"]}</summary>`,
		);
		const rows = all(
			page,
			/<tr><th scope="row">([^<]*)<\/th>((?:<td class="num">[^<]*<\/td>)+)<\/tr>/g,
		).map(([, week, cells]) => [
			week,
			...all(cells ?? "", /<td class="num">([^<]*)<\/td>/g).map((m) => m[1]),
		]);
		expect(rows).toEqual([
			["01.09.2026", "21", "21", "1", "1"],
			["07.09.2026", "9", "30", "0", "1"],
			["14.09.2026", "39", "69", "10", "11"],
			["21.09.2026", "11", "80", "5", "16"],
			["28.09.2026", "32", "112", "1", "17"],
			["05.10.2026", "0", "112", "0", "17"],
		]);
	});

	it("carries only dates and whole numbers as chart data (R6, SC-004)", () => {
		const json = data(page);
		expect(Object.keys(json).sort()).toEqual(
			[
				"axisDays",
				"lastIndex",
				"seasonStart",
				"training",
				"team",
				"outside",
			].sort(),
		);
		expect(json).toMatchObject({
			axisDays: 302,
			lastIndex: 36,
			seasonStart: "2026-09-01",
			outside: null,
			training: { threshold: 250, yMax: 250, pace: true },
			team: { threshold: 25, yMax: 25, pace: true },
		});
		const leaves: unknown[] = [];
		const walk = (v: unknown) => {
			if (Array.isArray(v)) v.forEach(walk);
			else if (v && typeof v === "object") Object.values(v).forEach(walk);
			else leaves.push(v);
		};
		walk(json);
		for (const leaf of leaves) {
			if (typeof leaf === "string") expect(leaf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			else if (typeof leaf === "number")
				expect(Number.isInteger(leaf)).toBe(true);
			else expect([null, true, false]).toContain(leaf);
		}
	});

	it("says when there is nothing to see yet (FR-015)", () => {
		expect(String(renderProgress(de, zeroView))).toContain(
			`<p class="progress-nothing">${c["progress.nothingYet"]}</p>`,
		);
		expect(page).not.toContain("progress-nothing");
	});

	it("shows Rynke only: no distance, metres, speed, ride or link (FR-005, SC-004)", () => {
		for (const html of [page, virtualPage]) {
			expect(html).not.toMatch(/\bkm\b|km\/h| m<|Höhenmeter|strava\.com/);
			expect(html).not.toMatch(/<a\b/);
		}
	});

	describe("pace and the outdoor curve (US2)", () => {
		it("adds the pace to both legends", () => {
			expect(all(page, /key-pace/g)).toHaveLength(2);
			expect(page).toContain(c["progress.legend.pace"]);
			expect(page).not.toContain("key-outside");
			expect(page).not.toContain(c["progress.legend.needed"].split(" ")[0]);
		});

		it("adds the outdoor curve and the 167 line for virtual riders (FR-039)", () => {
			expect(virtualPage).toContain(
				`<span class="progress-key key-outside" aria-hidden="true"></span>${c["rynke.withoutVirtual"]}`,
			);
			expect(virtualPage).toContain(
				`<span class="progress-key key-needed" aria-hidden="true"></span>${c["progress.legend.needed"].replace("{value}", "167")}`,
			);
			expect(data(virtualPage).outside).toMatchObject({
				threshold: 167,
				needed: 167,
				yMax: 250,
				pace: true,
			});
		});

		it("has ahead, behind and on-pace templates per line", () => {
			for (const series of ["training", "team"]) {
				for (const readout of ["pace-ahead", "pace-behind", "pace-on"]) {
					expect(page).toContain(
						`<template data-readout="${readout}" data-series="${series}">`,
					);
				}
			}
			expect(page).not.toContain('data-series="outside">');
			expect(virtualPage).toContain(
				'<template data-readout="pace-behind" data-series="outside">',
			);
			expect(virtualPage).toMatch(
				/<template data-readout="outside">[^<]*<span data-slot="value"><\/span><\/template>/,
			);
		});

		it("adds the outdoor columns only for virtual riders", () => {
			expect(page).not.toContain(
				`<th scope="col">${c["rynke.withoutVirtual"]}</th>`,
			);
			expect(virtualPage).toContain(
				`<th scope="col">${c["rynke.withoutVirtual"]}</th>`,
			);
			expect(virtualPage).toContain(
				'<tr><th scope="row">01.09.2026</th><td class="num">150</td><td class="num">150</td><td class="num">0</td><td class="num">0</td><td class="num">50</td><td class="num">50</td></tr>',
			);
		});

		it("states being behind as a number, not a broken rule (FR-038)", () => {
			for (const i18n of [de, en]) {
				const html = String(renderProgress(i18n, exampleView));
				const behind = all(
					html,
					/<template data-readout="pace-behind"[^>]*>([\s\S]*?)<\/template>/g,
				).map((m) => m[1]);
				expect(behind).toHaveLength(2);
				for (const text of behind) {
					expect(text).not.toMatch(/Regel|verstoßen|rule|broken/i);
				}
			}
		});
	});
});
