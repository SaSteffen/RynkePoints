import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHART_SCRIPTS } from "../../src/http/progress-section";
import { exampleRiderView } from "../../src/http/tour-example";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { EXAMPLE_WINDOW, seedExampleRider } from "../support/progress";
import { riderPage, seedBalance, seedRide } from "../support/rider-view";
import { snapshot } from "../support/rynke";

// The progress section on the Overview (feature 009 contracts/overview-section.md,
// contracts/http-routes.md): only there, only the signed-in rider's own Rynke
// (or the tour's example rider), German and English, and the chart library
// only on a page that shows it. Synthetic riders only.

/** 7 October 2026, in the example rider's season. */
const ctx: TestCtx = {
	...makeCtx({ now: Date.UTC(2026, 9, 7, 10) / 1000 }),
	env: { ...env, SEASON_START_DATE: EXAMPLE_WINDOW.seasonStart },
};
const { de, en } = CATALOGS;

/** The page's `#progress-data`, parsed. */
function chartData(html: string) {
	const json = html.match(
		/<script type="application\/json" id="progress-data">([\s\S]*?)<\/script>/,
	)?.[1];
	return JSON.parse(json ?? "null") as {
		training: { values: number[] };
		team: { values: number[] };
	} | null;
}

const VENDOR_TAGS = CHART_SCRIPTS.map(
	(src) => `<script src="${src}" defer></script>`,
);

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedExampleRider(ATHLETE_A);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("GET /me progress section (feature 009)", () => {
	it("shows the rider's curves after the breakdown, with the chart library", async () => {
		const { status, html } = await riderPage(ctx, ATHLETE_A);
		expect(status).toBe(200);
		const breakdown = html.indexOf('<section class="rynke-breakdown');
		const progress = html.indexOf('<section id="progress"');
		expect(breakdown).toBeGreaterThan(-1);
		expect(progress).toBeGreaterThan(breakdown);
		const data = chartData(html);
		expect(data?.training.values).toHaveLength(37);
		expect(data?.training.values.at(-1)).toBe(112);
		expect(data?.team.values.at(-1)).toBe(17);
		expect(data?.training.values[19]).toBe(69);
		expect(html).toContain(
			'<tr><th scope="row">14.09.2026</th><td class="num">39</td><td class="num">69</td><td class="num">10</td><td class="num">11</td></tr>',
		);
		const [chart, zoom] = VENDOR_TAGS.map((tag) => html.indexOf(tag));
		const app = html.indexOf('<script src="/app.js" defer></script>');
		expect(chart).toBeGreaterThan(-1);
		expect(zoom).toBeGreaterThan(chart ?? 0);
		expect(app).toBeGreaterThan(zoom ?? 0);
		expect(html.indexOf("</head>")).toBeGreaterThan(app);
	});

	it("shows another rider only their own Rynke (SC-007)", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedRide(ATHLETE_B, {
			id: 7_300_001,
			start_date: "2026-09-08T07:00:00Z",
			start_date_local: "2026-09-08T09:00:00Z",
			result: { counts: true, distanceRynke: 7, elevationDm: 0 },
		});
		await seedBalance(ATHLETE_B, {
			distanceRynke: 7,
			trainingRynke: 7,
			trainingMissing: 243,
			trainingWithoutVirtual: 7,
			virtualShareMissing: 160,
		});
		const { html } = await riderPage(ctx, ATHLETE_B);
		const data = chartData(html);
		expect(Math.max(...(data?.training.values ?? []))).toBe(7);
		expect(Math.max(...(data?.team.values ?? []))).toBe(0);
		for (const theirs of ["112", "69", "39"]) {
			expect(html).not.toContain(`<td class="num">${theirs}</td>`);
		}
	});

	it("leaves the section and the library out before the first balance (FR-016)", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, importStatus: "running" });
		const { html } = await riderPage(ctx, ATHLETE_B);
		expect(html).toContain("data-waiting");
		expect(html).not.toContain('id="progress"');
		expect(html).not.toContain("/vendor/");
	});

	it("leaves the section out under a rules version it doesn't know (FR-040)", async () => {
		await seedBalance(ATHLETE_A, { rulesVersion: 99 });
		const { html } = await riderPage(ctx, ATHLETE_A);
		expect(html).not.toContain('id="progress"');
		expect(html).not.toContain("/vendor/");
	});

	it("loads the library on no other section", async () => {
		for (const path of ["/me/rides", "/team", "/me/settings", "/me/badges"]) {
			const { status, html } = await riderPage(ctx, ATHLETE_A, path);
			expect(status, path).toBe(200);
			expect(html, path).not.toContain("/vendor/");
			expect(html, path).not.toContain('id="progress"');
		}
	});

	it("speaks the page's language (SC-009)", async () => {
		const german = (await riderPage(ctx, ATHLETE_A)).html;
		expect(german).toContain(de["progress.heading"]);
		expect(german).toContain('data-locale="de-DE"');
		const english = (await riderPage(ctx, ATHLETE_A, "/me", "en")).html;
		expect(english).toContain(en["progress.heading"]);
		expect(english).toContain(en["progress.table.summary"]);
		expect(english).toContain('data-locale="en-GB"');
	});

	it("shows the tour's example rider on its Overview steps (FR-043)", async () => {
		const { html } = await riderPage(ctx, ATHLETE_A, "/me?tour=rider&step=4");
		const example = exampleRiderView(EXAMPLE_WINDOW, "2026-10-07");
		const data = chartData(html);
		expect(data?.training.values.at(-1)).toBe(example.balance?.trainingRynke);
		expect(data?.team.values.at(-1)).toBe(example.balance?.teamRynke);
		expect(data?.training.values.at(-1)).not.toBe(112);
	});

	it("writes, sends and fetches nothing (FR-003, SC-006)", async () => {
		const fetch = vi.spyOn(globalThis, "fetch");
		const before = await snapshot(ATHLETE_A);
		await riderPage(ctx, ATHLETE_A);
		await riderPage(ctx, ATHLETE_A, "/me", "en");
		expect(await snapshot(ATHLETE_A)).toEqual(before);
		expect(ctx.queue.sent).toEqual([]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("still sends a rides page to Rides", async () => {
		const response = await handleFetch(
			request("/me?page=2", {
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(response.status).toBe(301);
		expect(response.headers.get("Location")).toBe("/me/rides?page=2");
	});
});
