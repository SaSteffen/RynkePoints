import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteRider } from "../../src/db/riders";
import { handleFetch } from "../../src/index";
import { pruneUsage } from "../../src/work/scheduled";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import { seedCalls, seedSeen, setStravaUsage } from "../support/usage";

// Dismissing a day warning on Admin › Nutzung (feature 050
// contracts/dismiss-route.md, contracts/usage-view.md): "Gesehen" takes a day
// row out of that administrator's list, its head and the Admin tab's number;
// the day's table keeps its mark. Synthetic counts only.

const NOW = Date.UTC(2026, 10, 25, 12, 0, 0) / 1000;
const TODAY = "2026-11-25";
const YESTERDAY = "2026-11-24";
const EARLIER = "2026-11-23";
const ctx = makeCtx({ now: NOW });
const ADMIN = ATHLETE_A;
const OTHER_ADMIN = ATHLETE_B;

async function page(athleteId = ADMIN, lang = "de"): Promise<string> {
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

async function dismiss(
	fields: [string, string][],
	athleteId: string | null = ADMIN,
	origin?: string,
): Promise<Response> {
	return handleFetch(
		request("/admin/dismiss", {
			form: fields,
			origin,
			cookies:
				athleteId === null ? undefined : await sessionCookie(ctx, athleteId),
		}),
		ctx,
	);
}

const fields = (kind: string, day: string, ...reasons: string[]) =>
	[["kind", kind], ["day", day], ...reasons.map((r) => ["reason", r])] as [
		string,
		string,
	][];

async function stored(athleteId = ADMIN) {
	const { results } = await env.DB.prepare(
		`SELECT kind, day, reason FROM usage_dismissals
		WHERE athlete_id = ? ORDER BY kind, day, reason`,
	)
		.bind(athleteId)
		.all();
	return results;
}

async function storeDismissal(
	athleteId: string,
	kind: string,
	day: string,
	reason: string,
) {
	await env.DB.prepare(
		"INSERT INTO usage_dismissals (athlete_id, kind, day, reason) VALUES (?, ?, ?, ?)",
	)
		.bind(athleteId, kind, day, reason)
		.run();
}

async function count(day: string, team: string, figure: string, n: number) {
	await env.DB.prepare(
		`INSERT INTO routing_daily (day, team, figure, count) VALUES (?, ?, ?, ?)
		ON CONFLICT (day, team, figure) DO UPDATE SET count = excluded.count`,
	)
		.bind(day, team, figure, n)
		.run();
}

async function recheck(day: string, over24h: number, unordered: number) {
	await env.DB.prepare(
		`INSERT INTO recheck_daily (day, sent, skipped, failed, unordered, over_24h, runs_held)
		VALUES (?, 10, 0, 0, ?, ?, 0)`,
	)
		.bind(day, unordered, over24h)
		.run();
}

/** "Das braucht deinen Blick", head and list. */
const lage = (text: string) =>
	text.match(/<section class="usage-lage"[\s\S]*?<\/section>/)?.[0] ?? "";

/** The list's day rows for `kind`'s table, by link target. */
const dayRows = (text: string, target: string) =>
	[
		...lage(text).matchAll(
			/<li class="lage-dismissable">[\s\S]*?<\/form><\/li>/g,
		),
	]
		.map((m) => m[0])
		.filter((row) => row.includes(`href="${target}"`));

/** The Admin tab's number, or null without one. */
function tabNumber(text: string): number | null {
	const nav = text.slice(text.indexOf('<nav class="app-nav"'));
	const start = nav.indexOf('<a href="/admin/riders"');
	const link = nav.slice(start, nav.indexOf("</a>", start));
	const n = link.match(/<span class="count-badge" aria-hidden="true">(\d+)</);
	return n?.[1] ? Number(n[1]) : null;
}

/** The routing table's first cell per day row. */
const routingDays = (text: string) =>
	[
		...(
			text.match(/<li id="routing"><details[\s\S]*?<\/details><\/li>/)?.[0] ??
			""
		).matchAll(/<tr>([\s\S]*?)<\/tr>/g),
	]
		.filter((m) => m[1]?.includes("<td>"))
		.map((m) =>
			(m[1]?.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/)?.[1] ?? "")
				.replace(/<[^>]+>/g, " ")
				.replace(/\s+/g, " ")
				.trim(),
		);

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
	// A device, so the list holds no state hint unless a test wants one.
	await seedSubscription(ADMIN, pushEndpoint(1));
});

describe("dismissing a day warning (US1)", () => {
	beforeEach(async () => {
		await count(YESTERDAY, "hamburg", "possible", 1);
	});

	it("gives the routing row a Gesehen form with its reasons", async () => {
		const rows = dayRows(await page(), "#routing");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toContain(
			'<form method="post" action="/admin/dismiss" class="lage-dismiss" data-swap><input type="hidden" name="kind" value="routing"><input type="hidden" name="day" value="2026-11-24"><input type="hidden" name="reason" value="possible"><button class="button-text" aria-label="Gesehen: Gateway-Routing: 24.11.2026">Gesehen</button></form>',
		);
	});

	it("answers 303 to /admin and keeps one row per reason", async () => {
		const res = await dismiss(fields("routing", YESTERDAY, "possible"));
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/admin");
		expect(await stored()).toEqual([
			{ kind: "routing", day: YESTERDAY, reason: "possible" },
		]);
	});

	it("takes the row out of the list, the head and the Admin tab, not the table", async () => {
		await setStravaUsage({
			observedAt: NOW,
			allDaily: 850,
			limitAllDaily: 1000,
		});
		const before = await page();
		expect(dayRows(before, "#routing")).toHaveLength(1);
		expect(lage(before)).toContain(">2 Warnungen<");
		expect(tabNumber(before)).toBe(2);

		await dismiss(fields("routing", YESTERDAY, "possible"));
		const after = await page();
		expect(lage(after)).not.toContain('href="#routing"');
		expect(lage(after)).toContain(">1 Warnung<");
		expect(tabNumber(after)).toBe(1);
		expect(routingDays(after)[0]).toBe("24.11.2026 Warnung");
	});

	it("says all is in order when it was the only mark, and stays so", async () => {
		await dismiss(fields("routing", YESTERDAY, "possible"));
		for (let i = 0; i < 2; i++) {
			const text = await page();
			expect(lage(text)).toContain(
				'<h2 id="lage-heading">Alles im Rahmen</h2>',
			);
			expect(tabNumber(text)).toBeNull();
		}
	});

	it("keeps one row per reason when sent twice", async () => {
		await dismiss(fields("routing", YESTERDAY, "possible"));
		await dismiss(fields("routing", YESTERDAY, "possible"));
		expect(await stored()).toHaveLength(1);
	});

	it("dismisses a Strava calls day and a re-check day the same way", async () => {
		await seedCalls(YESTERDAY, "ride-event", "GET /activities/{id}", 300);
		await seedSeen(YESTERDAY, 600);
		await recheck(TODAY, 1, 1);
		const before = await page();
		const calls = dayRows(before, "#strava-calls");
		const recheckRow = dayRows(before, "#recheck");
		expect(calls[0]).toContain(
			'<input type="hidden" name="kind" value="calls"><input type="hidden" name="day" value="2026-11-24"><input type="hidden" name="reason" value="calls">',
		);
		expect(recheckRow[0]).toContain(
			'<input type="hidden" name="reason" value="over24h"><input type="hidden" name="reason" value="unordered">',
		);

		await dismiss(fields("calls", YESTERDAY, "calls"));
		await dismiss(fields("recheck", TODAY, "over24h", "unordered"));
		const after = await page();
		expect(dayRows(after, "#strava-calls")).toEqual([]);
		expect(dayRows(after, "#recheck")).toEqual([]);
		expect(tabNumber(after)).toBe(1);
	});

	it("reads Got it in English", async () => {
		const rows = dayRows(await page(ADMIN, "en"), "#routing");
		expect(rows[0]).toMatch(
			/<button class="button-text" aria-label="Got it: Gateway routing: [^"]+">Got it<\/button>/,
		);
	});
});

describe("who may dismiss (FR-008, contracts/dismiss-route.md)", () => {
	it("refuses without a session, to a rider and from another origin", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_C });
		const day = fields("routing", YESTERDAY, "possible");
		expect((await dismiss(day, null)).status).toBe(403);
		expect((await dismiss(day, ATHLETE_C)).status).toBe(403);
		expect(
			(await dismiss(day, ADMIN, "https://elsewhere.example.org")).status,
		).toBe(403);
		expect(await stored()).toEqual([]);
		expect(await stored(ATHLETE_C)).toEqual([]);
	});

	it("stores nothing for an unknown kind, an old or broken day, unknown reasons", async () => {
		for (const sent of [
			fields("figure", YESTERDAY, "possible"),
			fields("cpu", TODAY, "calls"),
			fields("routing", EARLIER, "possible"),
			fields("routing", "yesterday", "possible"),
			fields("routing", YESTERDAY, "calls", "nonsense"),
			fields("routing", YESTERDAY),
		]) {
			const res = await dismiss(sent);
			expect(res.status).toBe(303);
			expect(res.headers.get("Location")).toBe("/admin");
		}
		expect(await stored()).toEqual([]);
	});

	it("keeps only the reasons the kind knows", async () => {
		await dismiss(fields("recheck", TODAY, "over24h", "possible", "over24h"));
		expect(await stored()).toEqual([
			{ kind: "recheck", day: TODAY, reason: "over24h" },
		]);
	});
});

describe("other administrators (US2)", () => {
	beforeEach(async () => {
		await seedRider(ctx, { athleteId: OTHER_ADMIN, administrator: true });
		await seedSubscription(OTHER_ADMIN, pushEndpoint(2));
		await count(YESTERDAY, "hamburg", "possible", 1);
	});

	it("still shows the row to another administrator", async () => {
		await dismiss(fields("routing", YESTERDAY, "possible"));
		expect(dayRows(await page(ADMIN), "#routing")).toEqual([]);
		const theirs = await page(OTHER_ADMIN);
		expect(dayRows(theirs, "#routing")).toHaveLength(1);
		expect(tabNumber(theirs)).toBe(1);

		await dismiss(fields("routing", YESTERDAY, "possible"), OTHER_ADMIN);
		expect(dayRows(await page(OTHER_ADMIN), "#routing")).toEqual([]);
		expect(dayRows(await page(ADMIN), "#routing")).toEqual([]);
	});
});

describe("a new reason (US3)", () => {
	it("stays gone while it grows, comes back with a would-be miss", async () => {
		await count(YESTERDAY, "hamburg", "possible", 1);
		await dismiss(fields("routing", YESTERDAY, "possible"));

		await count(YESTERDAY, "hamburg", "possible", 2);
		expect(dayRows(await page(), "#routing")).toEqual([]);

		await count(YESTERDAY, "hamburg", "missed", 1);
		const text = await page();
		const rows = dayRows(text, "#routing");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toContain(
			'<span class="settings-sub">Drohender Verlust · Möglicher Verlust</span>',
		);
		expect(rows[0]).toContain(
			'<input type="hidden" name="reason" value="missed"><input type="hidden" name="reason" value="possible">',
		);
		expect(tabNumber(text)).toBe(1);
	});
});

describe("limits stay (US4, FR-002)", () => {
	it("offers no dismiss on figure, CPU and hint rows", async () => {
		await env.DB.prepare("DELETE FROM push_subscriptions").run();
		await setStravaUsage({
			observedAt: NOW,
			allDaily: 850,
			limitAllDaily: 1000,
		});
		await env.DB.prepare(
			`INSERT INTO usage_cpu_daily (day, owner, runs, cut_off, cpu_p99_us, recorded_at)
			VALUES (?, 'shared', 100, 5, 1000, ?)`,
		)
			.bind(TODAY, NOW)
			.run();
		const quiet = lage(await page());
		expect(quiet).toContain('href="#cpu"');
		expect(quiet).toContain('href="/me/settings"');
		expect(quiet).toContain("lvl-warning");
		expect(quiet).not.toContain('action="/admin/dismiss"');

		await count(YESTERDAY, "hamburg", "possible", 1);
		const withDay = lage(await page());
		expect(withDay.match(/action="\/admin\/dismiss"/g)).toHaveLength(1);
	});

	it("stores nothing for a figure or a CPU row", async () => {
		await dismiss(fields("figure", TODAY, "calls"));
		await dismiss(fields("cpu", TODAY, "calls"));
		expect(await stored()).toEqual([]);
	});
});

describe("clean-up (FR-009)", () => {
	it("drops days before yesterday in the daily run", async () => {
		await storeDismissal(ADMIN, "routing", EARLIER, "possible");
		await storeDismissal(ADMIN, "routing", YESTERDAY, "possible");
		await storeDismissal(ADMIN, "calls", TODAY, "calls");
		await pruneUsage(ctx);
		expect(await stored()).toEqual([
			{ kind: "calls", day: TODAY, reason: "calls" },
			{ kind: "routing", day: YESTERDAY, reason: "possible" },
		]);
	});

	it("goes with the rider", async () => {
		await storeDismissal(ADMIN, "routing", YESTERDAY, "possible");
		await deleteRider(env.DB, ADMIN);
		expect(await stored()).toEqual([]);
	});
});
