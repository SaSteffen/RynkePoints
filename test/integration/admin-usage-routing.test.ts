import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	withGateway,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A } from "../support/fixtures";

// The "Gateway routing" section of `/admin` (feature 046
// contracts/usage-view.md): a day table of counts, warning marks, and a
// summary line. Counts only; no other team is named.

const NOW = Date.UTC(2026, 10, 23, 12, 0, 0) / 1000;
const ctx = makeCtx({ now: NOW });
const ADMIN = ATHLETE_A;

async function page(lang = "de") {
	const res = await handleFetch(
		request("/admin", {
			cookies: await sessionCookie(ctx, ADMIN),
			acceptLanguage: lang,
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

function section(text: string): string {
	return (
		text.match(/<li id="routing"><details[\s\S]*?<\/details><\/li>/)?.[0] ?? ""
	);
}

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

async function count(day: string, team: string, figure: string, n: number) {
	await env.DB.prepare(
		"INSERT INTO routing_daily (day, team, figure, count) VALUES (?, ?, ?, ?)",
	)
		.bind(day, team, figure, n)
		.run();
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
});

describe("the Gateway routing section", () => {
	it("says there are no figures yet", async () => {
		const text = section(await page());
		expect(text).toContain("Gateway-Routing");
		expect(text).toContain("Noch keine Zahlen.");
	});

	it("shows one row per day, newest first, this team and other teams apart", async () => {
		await count("2026-11-22", "", "copy", 40);
		await count("2026-11-23", "", "copy", 50);
		await count("2026-11-23", "", "everyone", 1);
		await count("2026-11-23", "hamburg", "dropped", 3);
		await count("2026-11-23", "europe", "dropped", 4);
		await count("2026-11-23", "hamburg", "added", 1);
		await count("2026-11-23", "hamburg", "removed", 1);
		await count("2026-11-23", "europe", "found", 2);
		const text = await page();
		expect(section(text)).toContain("Andere Teams");
		expect(section(text)).toContain("Dieses Team");
		expect(section(text)).not.toMatch(/europe|hamburg/i);
		expect(rows(text)).toEqual([
			// Day, by copy, everyone, then this team · other teams per figure:
			// would-be misses, wasted, dropped, corrections, possible, found.
			[
				"23.11.2026",
				"50",
				"1",
				"0",
				"0",
				"0",
				"0",
				"3",
				"4",
				"2",
				"0",
				"0",
				"0",
				"0",
				"2",
			],
			[
				"22.11.2026",
				"40",
				"0",
				"0",
				"0",
				"0",
				"0",
				"0",
				"0",
				"0",
				"0",
				"0",
				"0",
				"0",
				"0",
			],
		]);
	});

	it("leaves out other teams' columns when no other team has a count", async () => {
		await count("2026-11-23", "hamburg", "found", 1);
		const text = await page();
		expect(section(text)).not.toContain("Andere Teams");
		expect(rows(text)[0]).toHaveLength(9);
	});

	it("marks a day with a would-be miss and counts it in the summary", async () => {
		await count("2026-11-23", "europe", "missed", 1);
		await count("2026-11-22", "", "allRouting", 100);
		await count("2026-11-22", "", "allRoutingEveryone", 2);
		await count("2026-11-21", "", "copy", 10);
		const text = await page();
		const [first, second, third] = rows(text);
		expect(first?.[0]).toBe("23.11.2026 Warnung");
		expect(second?.[0]).toBe("22.11.2026 Warnung");
		expect(third?.[0]).toBe("21.11.2026");
		// Feature 048: today's and yesterday's marked days are in the list.
		expect(text).toContain(
			'<a class="settings-row" href="#routing"><span class="settings-icon lvl-warning">',
		);
		expect(text).toContain(
			'Gateway-Routing: 23.11.2026</span><span class="settings-sub">Drohender Verlust</span>',
		);
		expect(text).toContain(
			'Gateway-Routing: 22.11.2026</span><span class="settings-sub">Zu viele Meldungen an alle Teams</span>',
		);
		expect(text).toContain(">2 Warnungen<");
		// Its row carries the mark, and says today's copy without "nothing unusual".
		expect(text).toContain(
			'<span class="settings-title">Gateway-Routing<span class="usage-mark usage-mark-warning">Warnung</span></span><span class="settings-sub">Heute 0 weitergegeben</span>',
		);
	});

	it("leaves a day marked before yesterday out of the list and the row's mark (feature 048)", async () => {
		await count("2026-11-21", "hamburg", "missed", 1);
		const text = await page();
		expect(rows(text)[0]?.[0]).toBe("21.11.2026 Warnung");
		expect(text).not.toContain('href="#routing"');
		expect(text).toContain(
			'<span class="settings-title">Gateway-Routing</span><span class="settings-sub">Heute 0 weitergegeben, keine Auffälligkeit</span>',
		);
	});

	it("lists no day without a mark", async () => {
		await count("2026-11-23", "", "copy", 10);
		expect(await page()).not.toContain('href="#routing"');
	});

	it("is there in every language", async () => {
		await count("2026-11-23", "", "copy", 10);
		expect(section(await page("en"))).toContain("Sent by the copy");
	});
});

describe("Update now", () => {
	let fake: FakeStrava;
	beforeEach(() => {
		fake = installFakeStrava();
	});
	afterEach(() => {
		vi.restoreAllMocks();
		fake.restore();
	});

	it("also exchanges the routing counts with the gateway", async () => {
		const gated = withGateway(makeCtx({ now: NOW }));
		fake.routing.counts = [
			{ day: "2026-11-23", team: "", figure: "copy", count: 7 },
		];
		const res = await handleFetch(
			request("/admin/refresh", {
				form: {},
				cookies: await sessionCookie(gated, ADMIN),
			}),
			gated,
		);
		expect(res.status).toBe(303);
		expect(fake.routing.exchanges).toHaveLength(1);
		expect(rows(await page())[0]?.[1]).toBe("7");
	});
});
