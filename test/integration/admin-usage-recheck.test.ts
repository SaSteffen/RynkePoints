import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import { evaluateChange } from "../../src/rynke/apply";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { activityRecord } from "../support/rynke";

// The "Ride re-check" section of `/admin` (feature 036
// contracts/usage-view.md): the team's allowance and active riders, and the
// last 14 days that have a row. Counts only: no rider is named.

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const ctx = makeCtx({ now: NOW });
const ADMIN = ATHLETE_A;

async function page(lang = "de", athleteId = ADMIN) {
	const res = await handleFetch(
		request("/admin", {
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
			/<section class="card usage-source" id="recheck">[\s\S]*?<\/section>/,
		)?.[0] ?? ""
	);
}

/** The rows of the day table, each as its cells' text. */
function rows(text: string): string[][] {
	return [...section(text).matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
		.filter((m) => m[1]?.includes("<td>"))
		.map((m) =>
			[...(m[1] ?? "").matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
				(c[1] ?? "")
					.replace(/<[^>]+>/g, " ")
					.replace(/\s+/g, " ")
					.trim(),
			),
		);
}

async function day(
	day: string,
	counts: Partial<
		Record<
			"sent" | "skipped" | "failed" | "unordered" | "over_24h" | "runs_held",
			number
		>
	>,
) {
	const c = {
		sent: 0,
		skipped: 0,
		failed: 0,
		unordered: 0,
		over_24h: 0,
		runs_held: 0,
		...counts,
	};
	await env.DB.prepare(
		`INSERT INTO recheck_daily (day, sent, skipped, failed, unordered, over_24h, runs_held)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			day,
			c.sent,
			c.skipped,
			c.failed,
			c.unordered,
			c.over_24h,
			c.runs_held,
		)
		.run();
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
});

describe("the Ride re-check section", () => {
	it("says no check has run when there is no day", async () => {
		const text = section(await page());
		expect(text).toContain("Nachprüfung der Fahrten");
		expect(text).toContain("Bisher ist keine Nachprüfung gelaufen.");
		expect(rows(await page())).toEqual([]);
	});

	it("names the allowance and the active riders", async () => {
		// Active: an activity in the last 30 days. The administrator has none yet.
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await evaluateChange(ctx, ATHLETE_B, {
			kind: "upsert",
			records: [
				activityRecord(1, {
					athlete_id: ATHLETE_B,
					start_date: "2026-10-30T08:00:00Z",
					start_date_local: "2026-10-30T08:00:00Z",
				}),
			],
		});
		expect(section(await page())).toContain(
			"150 Prüfungen am Tag für dieses Team · 1 aktive Rider (mit einer Aktivität in den letzten 30 Tagen)",
		);
	});

	it("shows the checks made as sent minus stood back minus failed", async () => {
		await day("2026-11-04", { sent: 40, skipped: 3, failed: 2 });
		expect(rows(await page())).toEqual([["04.11.2026", "35", "3", "2", "0"]]);
	});

	it("lists the last 14 days that have a row, newest first", async () => {
		for (let d = 1; d <= 20; d++) {
			await day(`2026-10-${String(d).padStart(2, "0")}`, { sent: d });
		}
		const shown = rows(await page());
		expect(shown).toHaveLength(14);
		expect(shown[0]?.[0]).toBe("20.10.2026");
		expect(shown[13]?.[0]).toBe("07.10.2026");
	});

	it("names the runs held and the list order, and marks a day with a wrong order", async () => {
		await day("2026-11-03", { sent: 10, runs_held: 4 });
		await day("2026-11-04", { sent: 10, failed: 2, unordered: 2 });
		// Newest first: the day with the wrong order, then the one with runs held.
		const [wrongOrder, held] = section(await page())
			.split("<tr>")
			.filter((r) => r.includes("<td>"));
		expect(wrongOrder).toContain("Reihenfolge der Liste");
		expect(wrongOrder).toContain(">Warnung<");
		expect(held).toContain("4 Läufe angehalten");
		expect(held).not.toContain(">Warnung<");
	});

	it("marks a day on which riders waited over 24 hours", async () => {
		await day("2026-11-04", { sent: 10, over_24h: 3 });
		const text = section(await page());
		expect(text).toContain(">Warnung<");
		expect(rows(await page())[0]?.[4]).toBe("3");
	});

	it("names one run held in the singular", async () => {
		await day("2026-11-04", { sent: 10, runs_held: 1 });
		expect(section(await page())).toContain("1 Lauf angehalten");
	});

	it("names no rider and shows no identifier", async () => {
		await day("2026-11-04", { sent: 10 });
		await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Zorbo" });
		const text = section(await page());
		expect(text).not.toContain("Zorbo");
		expect(text).not.toContain(String(ATHLETE_B));
	});

	it("is in the language of the page", async () => {
		await day("2026-11-04", { sent: 10, skipped: 2 });
		const text = section(await page("en"));
		expect(text).toContain("Ride re-check");
		expect(text).toContain("Checks made");
		expect(text).toContain("Stood back");
	});

	it("follows the view's access rule", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		const res = await handleFetch(
			request("/admin", { cookies: await sessionCookie(ctx, ATHLETE_B) }),
			ctx,
		);
		expect(res.status).toBe(403);
		expect(await res.text()).not.toContain("Nachprüfung der Fahrten");
	});
});
