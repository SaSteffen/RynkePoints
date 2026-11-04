import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { seedUsageDay } from "../support/usage";

// `/admin/history` (feature 025 US2, FR-013 to FR-015, FR-017, SC-003).

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const de = CATALOGS.de;
const ctx = makeCtx({ now: NOW });

async function page(query = "") {
	const res = await handleFetch(
		request(`/admin/history${query}`, {
			cookies: await sessionCookie(ctx, ATHLETE_A),
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
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
		const text = await page("?allowance=strava_read_daily");
		expect(rowOf(text, "04.11.2026")).toContain(
			"<td>1.000</td><td>3.000</td><td>33 %</td><td>500</td><td>100</td>",
		);
		expect(rowOf(text, "03.11.2026")).toContain("<td>1.001</td>");
		expect(text).toContain(`<th scope="col">${de["admin.history.peak"]}</th>`);
		expect(text.match(/<tr>|<tr /g)).toHaveLength(61);
		// One bar for each of the 59 recorded days; the gap has none.
		const chart = text.split('class="usage-chart"')[1]?.split("</svg>")[0];
		expect(chart?.match(/<rect /g)).toHaveLength(59);
	});

	it("shows a day without a record as a gap, not zero (scenario 3)", async () => {
		await seedUsageDay("2026-11-02", "strava_read_daily", 10, 100);
		await seedUsageDay("2026-11-04", "strava_read_daily", 10, 100);
		const row = rowOf(await page(), "03.11.2026");
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
		const text = await page();
		expect(rowOf(text, "03.11.2026")).toContain("<td>10 %</td>");
		expect(rowOf(text, "04.11.2026")).toContain("<td>5 %</td>");
	});

	it("shows Cloudflare's without the team's columns", async () => {
		await seedUsageDay("2026-11-04", "cf_d1_rows_read", 2500, 5000);
		const text = await page("?allowance=cf_d1_rows_read");
		expect(rowOf(text, "04.11.2026")).toContain(
			"<td>2.500</td><td>5.000</td><td>50 %</td></tr>",
		);
		expect(text).not.toContain(de["admin.history.peak"]);
	});

	it("shows the first allowance for an unknown ID", async () => {
		await seedUsageDay("2026-11-04", "strava_read_daily", 10, 100);
		const text = await page("?allowance=%3Cscript%3E");
		expect(text).toContain(
			`<h2>${de["admin.allowance.strava_read_daily"]}</h2>`,
		);
		expect(text).not.toContain("&lt;script");
	});

	it("offers every recorded allowance, with the current one selected", async () => {
		const text = await page("?allowance=cf_d1_rows_read");
		expect(text.match(/<option /g)).toHaveLength(8);
		expect(text).toContain('<option value="cf_d1_rows_read" selected>');
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
