import { beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { seedCalls } from "../support/usage";

// The "Strava calls" section of `/admin` (feature 047 contracts/usage-view.md,
// User Story 1): this team's calls and held-back calls per UTC day for the
// last 30 days, and a day's breakdown by action and endpoint. Counts only.

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const TODAY = "2026-11-04";
const ctx = makeCtx({ now: NOW });
const ADMIN = ATHLETE_A;

async function page(query = "", lang = "de", athleteId = ADMIN) {
	const res = await handleFetch(
		request(`/admin${query}`, {
			cookies: await sessionCookie(ctx, athleteId),
			acceptLanguage: lang,
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

/** The section's markup, or "" when the page has none. */
function section(text: string): string {
	return (
		text.match(
			/<section class="card usage-source" id="strava-calls">[\s\S]*?<\/section>/,
		)?.[0] ?? ""
	);
}

const textOf = (cell: string) =>
	cell
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

/** The `n`th table of the section (0: the days, 1: the breakdown) as cell texts per row. */
function table(text: string, n: number): string[][] {
	const markup = section(text).split("<table>")[n + 1] ?? "";
	return [...markup.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) =>
		[...(m[1] ?? "").matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
			textOf(c[1] ?? ""),
		),
	);
}

/** The table's body rows, without its head. */
const body = (text: string, n: number) => table(text, n).slice(1);

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
});

describe("the Strava calls section", () => {
	it("says nothing was counted yet without any counted day", async () => {
		const text = section(await page());
		expect(text).toContain("Strava-Aufrufe");
		expect(text).toContain("Bisher ist kein Aufruf gezählt.");
		expect(text).not.toContain("<table>");
	});

	it("comes after the ride re-check's", async () => {
		const text = await page();
		expect(text.indexOf('id="strava-calls"')).toBeGreaterThan(
			text.indexOf('id="recheck"'),
		);
	});

	it("shows this team's calls and held back per day, newest first, to today", async () => {
		await seedCalls("2026-11-02", "import", "GET /athlete/activities", 30);
		await seedCalls("2026-11-02", "recheck", "GET /athlete/activities", 0, 4);
		await seedCalls(TODAY, "ride-event", "GET /activities/{id}", 5);
		const text = await page();
		expect(table(text, 0)[0]).toEqual(["Tag", "Dieses Team", "Zurückgehalten"]);
		expect(body(text, 0)).toEqual([
			["04.11.2026", "5", "0"],
			["03.11.2026", "0", "0"],
			["02.11.2026", "30", "4"],
		]);
	});

	it("shows at most 30 days, today included", async () => {
		// The day before is past the 30 days: pruned, and never shown.
		await seedCalls("2026-10-05", "import", "GET /athlete/activities", 9);
		await seedCalls("2026-10-06", "import", "GET /athlete/activities", 1);
		const rows = body(await page(), 0);
		expect(rows).toHaveLength(30);
		expect(rows[0]?.[0]).toBe("04.11.2026");
		expect(rows[29]?.[0]).toBe("06.10.2026");
	});

	it("links each day to its breakdown", async () => {
		await seedCalls("2026-11-02", "import", "GET /athlete/activities", 30);
		const text = section(await page());
		expect(text).toContain('href="?calls=2026-11-02#strava-calls"');
		expect(text).toContain(`href="?calls=${TODAY}#strava-calls"`);
	});

	it("breaks today down by default: per action and endpoint, held back and the total", async () => {
		await seedCalls(TODAY, "connect", "POST /oauth/token", 3, 1);
		await seedCalls(TODAY, "connect", "GET /athlete/clubs", 2);
		await seedCalls(TODAY, "ride-event", "GET /activities/{id}", 40);
		await seedCalls(TODAY, "ride-event", "POST /oauth/token", 2);
		await seedCalls(TODAY, "recheck", "GET /athlete/activities", 0, 6);
		const text = await page();
		expect(section(text)).toContain("Aufrufe am 04.11.2026");
		expect(table(text, 1)).toEqual([
			[
				"Wofür",
				"Clubs",
				"Eine Aktivität",
				"Token holen oder erneuern",
				"Zurückgehalten",
				"Zusammen",
			],
			["Verbinden", "2", "0", "3", "1", "5"],
			["Gemeldete Fahrt", "0", "40", "2", "0", "42"],
			["Nachprüfung der Fahrten", "0", "0", "0", "6", "0"],
		]);
	});

	it("breaks the day picked down", async () => {
		await seedCalls("2026-11-02", "import", "GET /athlete/activities", 30);
		await seedCalls(TODAY, "ride-event", "GET /activities/{id}", 5);
		const text = await page("?calls=2026-11-02");
		expect(section(text)).toContain("Aufrufe am 02.11.2026");
		expect(body(text, 1)).toEqual([["Saison-Import", "30", "0", "30"]]);
	});

	it.each(["2026-10-01", "2026-11-05", "yesterday", ""])(
		"breaks today down for %j, which isn't a day shown",
		async (asked) => {
			await seedCalls("2026-11-02", "import", "GET /athlete/activities", 30);
			await seedCalls(TODAY, "ride-event", "GET /activities/{id}", 5);
			const text = await page(`?calls=${asked}`);
			expect(section(text)).toContain("Aufrufe am 04.11.2026");
			expect(body(text, 1)).toEqual([["Gemeldete Fahrt", "5", "0", "5"]]);
		},
	);

	it("says when the day picked had no call", async () => {
		await seedCalls("2026-11-02", "import", "GET /athlete/activities", 30);
		const text = section(await page());
		expect(text).toContain("Aufrufe am 04.11.2026");
		expect(text).toContain("An diesem Tag gab es keinen Aufruf.");
		expect(text.split("<table>")).toHaveLength(2);
	});

	it("names no rider and shows no identifier", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Zorbo" });
		await seedCalls(TODAY, "leave", "POST /oauth/revoke", 1);
		const text = section(await page());
		expect(text).not.toContain("Zorbo");
		expect(text).not.toContain(ATHLETE_B);
	});

	it("is in the language of the page", async () => {
		await seedCalls(TODAY, "ride-event", "GET /activities/{id}", 5, 1);
		const text = section(await page("", "en"));
		expect(text).toContain("Strava calls");
		expect(text).toContain("Held back");
		expect(text).toContain("Ride event");
		expect(text).toContain("One activity");
	});

	it("follows the view's access rule", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		const res = await handleFetch(
			request("/admin", { cookies: await sessionCookie(ctx, ATHLETE_B) }),
			ctx,
		);
		expect(res.status).toBe(403);
		expect(await res.text()).not.toContain("Strava-Aufrufe");
	});
});
