import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { RECORDED_ALLOWANCES } from "../../src/usage/allowances";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { seedUsageDay } from "../support/usage";

// The histories on `/admin` (feature 025 US2, FR-013 to FR-015, FR-017, SC-003).

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const de = CATALOGS.de;
const ctx = makeCtx({ now: NOW });

async function page(query = "") {
	const res = await handleFetch(
		request(`/admin${query}`, {
			cookies: await sessionCookie(ctx, ATHLETE_A),
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

/** An allowance's card, by its German name. */
function card(text: string, id: keyof typeof de): string {
	return (
		text
			.split('<li class="usage-figure')
			.find((item) => item.includes(`>${de[id]}<`)) ?? `missing ${String(id)}`
	);
}

const READS = "admin.allowance.strava_read_daily";
const SHOW_READS = "?days=strava_read_daily";

/** The graph's bars: each day's is a path segment of its own. */
function bars(text: string): number {
	const chart = text.split('class="usage-chart"')[1]?.split("</svg>")[0] ?? "";
	return chart.match(/M[\d.]+ /g)?.length ?? 0;
}

/** The graph's day values, as `public/app.js` reads them. */
function dayValues(text: string): string[] {
	return text.match(/data-days="([^"]*)"/)?.[1]?.split(",") ?? [];
}

/** The table row of a day, by its German date. */
function rowOf(text: string, date: string): string {
	return (
		text
			.split("<tr")
			.find((row) => row.includes(`<th scope="row">${date}</th>`)) ??
		`missing ${date}`
	);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A, administrator: true });
});

describe("the history", () => {
	it("shows one value per day with the limit, team and peak (scenarios 1, 2)", async () => {
		for (let i = 0; i < 60; i++) {
			if (i === 7) continue;
			const day = new Date(NOW * 1000 - i * 86_400_000)
				.toISOString()
				.slice(0, 10);
			await seedUsageDay(day, "strava_read_daily", 1000 + i, 3000, {
				team: 500 + i,
				peak: 100 + i,
			});
		}
		const text = card(await page(SHOW_READS), READS);
		expect(rowOf(text, "04.11.2026")).toContain(
			"<td>1.000</td><td>3.000</td><td>33 %</td><td>500</td><td>100</td>",
		);
		expect(rowOf(text, "03.11.2026")).toContain("<td>1.001</td>");
		expect(text).toContain(`<th scope="col">${de["admin.history.peak"]}</th>`);
		expect(text.match(/<tr>|<tr /g)).toHaveLength(61);
		// One bar for each of the 59 recorded days; the gap has none, only its value.
		expect(bars(text)).toBe(59);
		const values = dayValues(text);
		expect(values).toHaveLength(60);
		expect(values.at(-1)).toBe("1000/3000");
		expect(values.at(-8)).toBe("");
	});

	it("shows a day without a record as a gap, not zero (scenario 3)", async () => {
		await seedUsageDay("2026-11-02", "strava_read_daily", 10, 100);
		await seedUsageDay("2026-11-04", "strava_read_daily", 10, 100);
		const row = rowOf(card(await page(SHOW_READS), READS), "03.11.2026");
		expect(row).toContain(de["admin.history.gap"]);
		expect(row).not.toContain("<td>0</td>");
	});

	it("says when recording began (scenario 4)", async () => {
		await seedUsageDay("2026-11-03", "strava_read_daily", 10, 100);
		expect(await page()).toContain(
			de["admin.history.since"].replace("{date}", "03.11.2026"),
		);
	});

	it("says so before anything is recorded", async () => {
		expect(await page()).toContain(de["admin.history.none"]);
	});

	it("keeps each day's own limit", async () => {
		await seedUsageDay("2026-11-03", "strava_read_daily", 100, 1000);
		await seedUsageDay("2026-11-04", "strava_read_daily", 100, 2000);
		const text = card(await page(SHOW_READS), READS);
		expect(rowOf(text, "03.11.2026")).toContain("<td>10 %</td>");
		expect(rowOf(text, "04.11.2026")).toContain("<td>5 %</td>");
	});

	it("shows Cloudflare's without the team's columns", async () => {
		await seedUsageDay("2026-11-04", "cf_d1_rows_read", 2500, 5000);
		const text = card(
			await page("?days=cf_d1_rows_read"),
			"admin.allowance.cf_d1_rows_read",
		);
		expect(rowOf(text, "04.11.2026")).toContain(
			"<td>2.500</td><td>5.000</td><td>50 %</td></tr>",
		);
		expect(text).not.toContain(de["admin.history.peak"]);
	});

	it("shows every recorded allowance's graph at once, with no choice to make", async () => {
		for (const id of RECORDED_ALLOWANCES) {
			await seedUsageDay("2026-11-04", id, 10, 100);
		}
		const text = await page();
		expect(text.match(/class="usage-chart"/g)).toHaveLength(8);
		expect(text.match(/class="usage-table-link"/g)).toHaveLength(8);
		expect(text).not.toContain("<select");
		for (const id of RECORDED_ALLOWANCES) {
			expect(card(text, `admin.allowance.${id}`)).toContain("usage-chart");
		}
	});

	it("runs every graph over the same days", async () => {
		await seedUsageDay("2026-11-01", "strava_read_daily", 10, 100);
		await seedUsageDay("2026-11-04", "cf_d1_rows_read", 10, 100);
		const text = card(await page(), "admin.allowance.cf_d1_rows_read");
		expect(dayValues(text)).toEqual(["", "", "", "10/100"]);
		expect(bars(text)).toBe(1);
	});

	it("has no graph for an allowance with no record, or a window", async () => {
		await seedUsageDay("2026-11-04", "strava_read_daily", 10, 100);
		const text = await page();
		expect(card(text, "admin.allowance.cf_d1_rows_read")).not.toContain(
			"usage-chart",
		);
		expect(card(text, "admin.allowance.strava_read_15m")).not.toContain(
			"usage-chart",
		);
	});

	it("gives the hover its words, and draws each level apart", async () => {
		await seedUsageDay("2026-11-03", "strava_read_daily", 90, 100);
		await seedUsageDay("2026-11-04", "strava_read_daily", 96, 100);
		const text = card(await page(SHOW_READS), READS);
		expect(text).toContain('data-first="2026-11-03"');
		expect(text).toContain(
			'data-numbers="{used} von {limit} · {percent}\u00a0%"',
		);
		expect(text).toMatch(/usage-bars-warning" d="M0 /);
		expect(text).toMatch(/usage-bars-critical" d="M500 /);
	});

	it("gives storage's hover its unit", async () => {
		await seedUsageDay("2026-11-04", "cf_d1_storage_bytes", 1000, 5000);
		const text = card(await page(), "admin.allowance.cf_d1_storage_bytes");
		expect(text).toContain('data-gb="{n}\u00a0GB"');
	});

	it("builds only the table asked for, and links back", async () => {
		await seedUsageDay("2026-11-04", "strava_read_daily", 10, 100);
		await seedUsageDay("2026-11-04", "cf_d1_rows_read", 10, 100);
		expect(await page()).not.toContain("<table");
		const text = await page("?days=cf_d1_rows_read");
		expect(text.match(/<table/g)).toHaveLength(1);
		const shown = card(text, "admin.allowance.cf_d1_rows_read");
		expect(shown).toContain("<table");
		expect(shown).toContain('href="/admin#cf_d1_rows_read"');
		expect(card(text, READS)).toContain(
			'href="/admin?days=strava_read_daily#strava_read_daily"',
		);
	});

	it("ignores an unknown table", async () => {
		await seedUsageDay("2026-11-04", "strava_read_daily", 10, 100);
		const text = await page("?days=%3Cscript%3E");
		expect(text).not.toContain("<table");
		expect(text).not.toContain("&lt;script");
	});

	it("sends the old address to the page", async () => {
		const res = await handleFetch(
			request("/admin/history?allowance=cf_d1_rows_read"),
			ctx,
		);
		expect(res.status).toBe(301);
		expect(res.headers.get("Location")).toBe("/admin");
	});

	it("doesn't change when a rider is deleted (FR-017)", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedUsageDay("2026-11-04", "strava_read_daily", 10, 100);
		const before = await env.DB.prepare("SELECT * FROM usage_daily").all();
		await env.DB.prepare("DELETE FROM riders WHERE athlete_id = ?")
			.bind(ATHLETE_B)
			.run();
		const after = await env.DB.prepare("SELECT * FROM usage_daily").all();
		expect(after.results).toEqual(before.results);
	});
});
