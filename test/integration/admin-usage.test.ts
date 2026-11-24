import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import type { AllowanceId } from "../../src/usage/allowances";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import {
	cloudflareBody,
	installCloudflare,
	seedUsageDay,
	setCloudflareState,
	setStravaUsage,
	WITH_ANALYTICS,
} from "../support/usage";

// `/admin` (feature 025 US1, US3's waiting work and US5's switch and hint, laid
// out anew by feature 048 US1 and US3). Only synthetic figures; viewing never
// calls `fetch` (FR-027).

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const TODAY = "2026-11-04";
const de = CATALOGS.de;
let ctx: TestCtx = makeCtx({ now: NOW });
const ADMIN = ATHLETE_A;
const NB = " ";

async function page(lang = "de", path = "/admin") {
	const res = await handleFetch(
		request(path, {
			cookies: await sessionCookie(ctx, ADMIN),
			acceptLanguage: lang,
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

/** A figure's row, by its allowance. */
function figure(text: string, id: AllowanceId): string {
	const start = text.indexOf(`<li id="${id}"`);
	return start === -1
		? `missing ${id}`
		: text.slice(start, text.indexOf("</li>", start));
}

/** The closed row: what shows before it's opened. */
const summaryOf = (row: string) =>
	row.slice(row.indexOf("<summary"), row.indexOf("</summary>"));

/** "Das braucht deinen Blick" or "Alles im Rahmen". */
function lage(text: string): string {
	const start = text.indexOf('<section class="usage-lage"');
	return start === -1
		? "missing"
		: text.slice(start, text.indexOf("</section>", start));
}

/** The links of the list, in order. */
const links = (text: string) =>
	[...lage(text).matchAll(/<a class="settings-row" href="([^"]*)"/g)].map(
		(m) => m[1],
	);

const percent = (n: string) => `${n}${NB}%`;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx({ now: NOW });
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
});

describe("Strava's figures", () => {
	it("shows used, limit, percentage, team, not attributed and time (scenarios 1, 2)", async () => {
		await setStravaUsage({
			observedAt: NOW - 60,
			readDaily: 1200,
			ownReadDaily: 900,
		});
		const item = figure(await page(), "strava_read_daily");
		expect(summaryOf(item)).toContain("1.200 von 3.000 · Dieses Team 900");
		expect(summaryOf(item)).toContain(percent("40"));
		expect(item).toContain("Dieses Team: 900 · Nicht zugeordnet: 300");
		expect(item).toContain("Stand: 04.11.2026, 11:59 UTC");
	});

	it("marks 80 % as a warning and 95 % as critical, in words (scenarios 3, 4, FR-009)", async () => {
		await setStravaUsage({
			observedAt: NOW - 60,
			readDaily: 2400,
			allDaily: 5700,
		});
		const text = await page();
		const warning = summaryOf(figure(text, "strava_read_daily"));
		expect(warning).toContain(">Warnung<");
		const critical = summaryOf(figure(text, "strava_all_daily"));
		expect(critical).toContain(">Kritisch<");
		const fine = figure(text, "strava_read_15m");
		expect(fine).not.toContain("usage-mark");
		expect(lage(text)).toContain(">1 kritisch<");
		expect(lage(text)).toContain(">1 Warnung<");
	});

	it("doesn't cap above 100 %", async () => {
		await setStravaUsage({ observedAt: NOW - 60, readDaily: 3600 });
		expect(summaryOf(figure(await page(), "strava_read_daily"))).toContain(
			percent("120"),
		);
	});

	it("counts an old day as zero with the time of the last observation", async () => {
		await setStravaUsage({
			observedAt: NOW - 86_400,
			readDaily: 1200,
			ownReadDaily: 900,
		});
		const item = figure(await page(), "strava_read_daily");
		expect(summaryOf(item)).toContain("0 von 3.000");
		expect(summaryOf(item)).toContain(percent("0"));
		expect(item).toContain("Stand: 03.11.2026, 12:00 UTC");
	});

	it("shows the connected riders against the capacity", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		expect(summaryOf(figure(await page(), "riders_connected"))).toContain(
			"2 von 999",
		);
	});
});

describe("the figures' rows (feature 048 US3)", () => {
	it("keeps the fixed order in each group (scenario 1, FR-013)", async () => {
		await setStravaUsage({
			observedAt: NOW,
			readDaily: 2900,
			read15m: 290,
		});
		await setCloudflareState(NOW, null);
		await seedUsageDay(TODAY, "cf_d1_rows_read", 4_900_000, 5_000_000);
		const text = await page();
		const ids = (group: string) => {
			const start = text.indexOf(
				`<section class="settings-section" id="${group}"`,
			);
			const section = text.slice(start, text.indexOf("</section>", start));
			return [...section.matchAll(/<li id="([^"]*)"/g)].map((m) => m[1]);
		};
		expect(ids("strava")).toEqual([
			"strava_read_daily",
			"strava_all_daily",
			"strava_read_15m",
			"strava_all_15m",
			"riders_connected",
		]);
		expect(ids("cloudflare")).toEqual([
			"cf_worker_requests",
			"cf_queue_operations",
			"cf_d1_rows_read",
			"cf_d1_rows_written",
			"cf_d1_storage_bytes",
		]);
	});

	it("shows name, mark, bar with the three level marks, numbers, whose and percentage closed (scenario 2)", async () => {
		await setStravaUsage({
			observedAt: NOW - 60,
			readDaily: 900,
			ownReadDaily: 900,
		});
		const row = summaryOf(figure(await page(), "strava_read_daily"));
		// Under the heading "Strava", without "Strava-" in front.
		expect(row).toContain(">Lesezugriffe pro Tag<");
		expect(row).toContain(
			'<span class="usage-mark usage-mark-early">Hinweis</span>',
		);
		const ticks = [...row.matchAll(/class="threshold-tick" x1="([^"]*)"/g)].map(
			(m) => m[1],
		);
		expect(ticks).toEqual(["25", "80", "95"]);
		expect(row).toContain("900 von 3.000 · Dieses Team 900");
		expect(row).toContain(
			`<span class="settings-value">${percent("30")}</span>`,
		);
	});

	it("says whose a figure is: this team's for 15 minutes, the whole account for Cloudflare", async () => {
		await setStravaUsage({ observedAt: NOW, read15m: 30, ownRead15m: 30 });
		await setCloudflareState(NOW, null);
		await seedUsageDay(TODAY, "cf_worker_requests", 1000, 100_000);
		const text = await page();
		expect(summaryOf(figure(text, "strava_read_15m"))).toContain(
			"30 von 300 · nur dieses Team",
		);
		expect(summaryOf(figure(text, "cf_worker_requests"))).toContain(
			"1.000 von 100.000 · ganzes Konto",
		);
	});

	it("opens to the levels, the split, the time and the history (scenario 3)", async () => {
		await setStravaUsage({ observedAt: NOW - 60, readDaily: 300 });
		await seedUsageDay(TODAY, "strava_read_daily", 300, 3000, { team: 300 });
		const row = figure(await page(), "strava_read_daily");
		const panel = row.slice(row.indexOf("</summary>"));
		expect(panel).toContain(
			`Hinweis ab 25${NB}%, Warnung ab 80${NB}%, kritisch ab 95${NB}%.`,
		);
		expect(panel).toContain("Dieses Team: 0 · Nicht zugeordnet: 300");
		expect(panel).toContain("Stand: 04.11.2026, 11:59 UTC");
		expect(panel).toContain('class="usage-graph"');
		expect(panel).toContain(`>${de["admin.history.days"]}</a>`);
		expect(row).toContain("<details>");
	});

	it("opens the figure `?days=` names, with its table of days", async () => {
		await seedUsageDay(TODAY, "strava_read_daily", 300, 3000);
		const text = await page("de", "/admin?days=strava_read_daily");
		const row = figure(text, "strava_read_daily");
		expect(row).toContain("<details open>");
		expect(row).toContain('<div class="usage-table">');
		expect(figure(text, "strava_all_daily")).toContain("<details>");
	});

	it("hides a 15-minute row at 0 % on a phone, and says so (scenario 4, FR-016)", async () => {
		await setStravaUsage({ observedAt: NOW, read15m: 3 });
		const text = await page();
		expect(figure(text, "strava_read_15m")).toMatch(
			/^<li id="strava_read_15m">/,
		);
		expect(figure(text, "strava_all_15m")).toMatch(
			/^<li id="strava_all_15m" class="is-quiet">/,
		);
		expect(text).toContain(
			`<p class="settings-note phone-only">${de["admin.strava.quiet"]}</p>`,
		);
	});

	it("says no note under Strava with nothing hidden and no other team", async () => {
		await setStravaUsage({ observedAt: NOW, read15m: 3, all15m: 6 });
		const text = await page();
		expect(text).not.toContain(`class="is-quiet"`);
		expect(text).not.toContain(de["admin.strava.quiet"]);
	});

	it("heads each group with when its figures are from (scenario 6)", async () => {
		await setCloudflareState(NOW, null);
		await seedUsageDay(TODAY, "cf_worker_requests", 1000, 100_000, {
			recordedAt: NOW - 120,
		});
		const text = await page();
		expect(text).toContain(`Strava <small>${de["admin.strava.when"]}</small>`);
		expect(text).toContain(
			"Cloudflare <small>Stand 04.11.2026, 11:58 UTC</small>",
		);
	});

	it("leaves out the old table of all teams", async () => {
		expect(await page()).not.toContain('id="overview"');
	});
});

describe("Cloudflare's figures", () => {
	beforeEach(async () => {
		await setStravaUsage({ observedAt: NOW - 60, readDaily: 1200 });
	});

	it("says they cover the whole account and are approximate (FR-008, FR-012)", async () => {
		await setCloudflareState(NOW, null);
		await seedUsageDay(TODAY, "cf_worker_requests", 50_000, 100_000, {
			recordedAt: NOW - 120,
		});
		const text = await page();
		expect(text).toContain(de["admin.cloudflare.note"]);
		expect(text).not.toContain(de["admin.cloudflare.unavailable"]);
		const item = figure(text, "cf_worker_requests");
		expect(summaryOf(item)).toContain("50.000 von 100.000");
		expect(summaryOf(item)).toContain(percent("50"));
		expect(item).not.toContain("Dieses Team");
		expect(item).toContain("Stand: 04.11.2026, 11:58 UTC");
	});

	it("shows storage in GB", async () => {
		await setCloudflareState(NOW, null);
		await seedUsageDay(
			TODAY,
			"cf_d1_storage_bytes",
			1_250_000_000,
			5_000_000_000,
		);
		const gb = (n: string) => de["admin.gigabytes"].replace("{n}", n);
		const row = summaryOf(figure(await page(), "cf_d1_storage_bytes"));
		expect(row).toContain(`${gb("1,25")} von ${gb("5,00")}`);
		expect(row).toContain(percent("25"));
	});

	it("on a failure says so, with the last known values and their time (scenario 5, FR-011, SC-007)", async () => {
		await setCloudflareState(NOW - 7200, NOW);
		await seedUsageDay("2026-11-03", "cf_d1_rows_read", 2_500_000, 5_000_000, {
			recordedAt: NOW - 7200,
		});
		const text = await page();
		expect(text).toContain(de["admin.cloudflare.unavailable"]);
		const item = figure(text, "cf_d1_rows_read");
		expect(summaryOf(item)).toContain("2.500.000 von 5.000.000");
		expect(item).toContain("Stand: 04.11.2026, 10:00 UTC");
		expect(summaryOf(figure(text, "strava_read_daily"))).toContain(
			"1.200 von 3.000",
		);
	});

	it("never shows zero for a figure it has no value for", async () => {
		const text = await page();
		expect(text).toContain(de["admin.cloudflare.unavailable"]);
		const item = figure(text, "cf_queue_operations");
		expect(item).toContain(`Noch kein Wert · Limit 10.000`);
		expect(item).not.toContain("0 von");
		expect(item).not.toContain("usage-mark");
		expect(item).not.toContain("threshold-bar");
	});

	it("keeps the limit a record was made with", async () => {
		await setCloudflareState(NOW, null);
		await seedUsageDay(TODAY, "cf_queue_operations", 100, 1000);
		const row = summaryOf(figure(await page(), "cf_queue_operations"));
		expect(row).toContain("100 von 1.000");
		expect(row).toContain(percent("10"));
	});
});

describe("what needs a look (feature 048 US1)", () => {
	it("lists Kritisch, Warnung, Hinweis, then the state hints, each linking to it (scenarios 1, 3)", async () => {
		await setCloudflareState(NOW, null);
		await seedUsageDay(TODAY, "cf_d1_rows_read", 4_850_000, 5_000_000, {
			recordedAt: NOW - 120,
		});
		await seedUsageDay(TODAY, "cf_queue_operations", 8_500, 10_000);
		await seedUsageDay(TODAY, "cf_worker_requests", 40_000, 100_000);
		const text = await page();
		// The list comes first, after the tab switch (FR-001).
		expect(text.indexOf('class="usage-lage"')).toBeLessThan(
			text.indexOf('class="settings-page usage-page"'),
		);
		expect(text.indexOf('class="organiser-switch"')).toBeLessThan(
			text.indexOf('class="usage-lage"'),
		);
		expect(lage(text)).toContain(
			`<h2 id="lage-heading">${de["admin.lage.heading"]}</h2>`,
		);
		expect(links(text)).toEqual([
			"#cf_d1_rows_read",
			"#cf_queue_operations",
			"#cf_worker_requests",
			"/me/settings",
		]);
		expect(lage(text)).toContain(
			"4.850.000 von 5.000.000 · Cloudflare, Stand 04.11.2026",
		);
		expect(lage(text)).toContain(
			`40.000 von 100.000 · über der Hinweisgrenze von 25${NB}%`,
		);
		expect(lage(text)).toContain(
			`<span class="settings-value">${percent("97")}</span>`,
		);
		const counts = lage(text).slice(lage(text).indexOf('class="lage-counts"'));
		expect(counts).toContain(">1 kritisch<");
		expect(counts).toContain(">1 Warnung<");
		expect(counts).toContain(">1 Hinweis<");
	});

	it("counts the plural and leaves out a level with none (FR-004)", async () => {
		await setCloudflareState(NOW, null);
		await seedUsageDay(TODAY, "cf_queue_operations", 3_000, 10_000);
		await seedUsageDay(TODAY, "cf_worker_requests", 40_000, 100_000);
		await seedSubscription(ADMIN, pushEndpoint(1));
		const text = await page();
		expect(lage(text)).toContain(">2 Hinweise<");
		expect(lage(text)).not.toContain("kritisch<");
		expect(lage(text)).not.toContain("Warnung");
	});

	it("lists the state hints without counting them", async () => {
		const text = await page();
		expect(links(text)).toEqual(["/me/settings"]);
		expect(lage(text)).toContain(`>${de["admin.lage.device"]}<`);
		expect(lage(text)).toContain(`>${de["nav.settings"]}</span>`);
		expect(lage(text)).not.toContain("lage-counts");
		expect(lage(text)).toContain('class="lage-badge is-hint"');
	});

	it("says all is in order when nothing needs a look (scenario 4, FR-005)", async () => {
		await seedSubscription(ADMIN, pushEndpoint(1));
		await setStravaUsage({ observedAt: NOW - 60, readDaily: 10 });
		const text = await page();
		expect(lage(text)).toContain(
			`<h2 id="lage-heading">${de["admin.lage.calm"]}</h2>`,
		);
		expect(lage(text)).toContain(
			escapeHtml(
				de["admin.lage.calmLine"].replace("{time}", "04.11.2026, 11:59"),
			),
		);
		expect(lage(text)).not.toContain("<ul");
		expect(text).not.toContain(de["admin.lage.heading"]);
	});

	it("doesn't say nothing waits while something does", async () => {
		await seedSubscription(ADMIN, pushEndpoint(1));
		await setStravaUsage({ observedAt: NOW - 60 });
		await env.DB.prepare(
			`INSERT INTO strava_work (athlete_id, message, kind, attempts, not_before, stored_at)
			VALUES (?, '{}', 'import-page', 1, 0, ?)`,
		)
			.bind(ADMIN, NOW)
			.run();
		const text = await page();
		expect(lage(text)).toContain(
			escapeHtml(
				de["admin.lage.calmLineWaiting"].replace("{time}", "04.11.2026, 11:59"),
			),
		);
	});

	it("puts Jetzt aktualisieren in the head either way (FR-006)", async () => {
		const refresh = `<form method="post" action="/admin/refresh"><button class="button-outlined">${de["admin.refresh"]}</button></form>`;
		expect(lage(await page())).toContain(refresh);
		await seedSubscription(ADMIN, pushEndpoint(1));
		expect(lage(await page())).toContain(refresh);
	});

	it("names no other team", async () => {
		ctx = {
			...ctx,
			env: {
				...ctx.env,
				USAGE_PEERS: JSON.stringify([
					{ id: "europe", origin: "https://europe.example.org" },
				]),
			},
		};
		const text = await page();
		expect(lage(text)).toContain(
			escapeHtml(
				de["admin.lage.team.never"].replace("{team}", de["admin.teams.other"]),
			),
		);
		expect(links(text)).toEqual(["#strava", "/me/settings"]);
		expect(text).not.toContain("Team Rynkeby Europe");
		expect(text).not.toMatch(/europe/i);
	});
});

describe("viewing", () => {
	it("calls no fetch at all (FR-027)", async () => {
		await page();
		expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
	});

	it("renders in English too (FR-025)", async () => {
		await setStravaUsage({ observedAt: NOW - 60, readDaily: 1200 });
		const text = await page("en");
		expect(text).toContain("1,200 of 3,000");
		expect(text).toContain(CATALOGS.en["admin.cloudflare.note"].slice(0, 20));
	});
});

describe("waiting work (US3 scenario 3, FR-020)", () => {
	const wait = async (n: number) => {
		for (let i = 0; i < n; i++) {
			await env.DB.prepare(
				`INSERT INTO strava_work (athlete_id, message, kind, attempts, not_before, stored_at)
				VALUES (?, '{}', 'import-page', 1, 0, ?)`,
			)
				.bind(ADMIN, NOW)
				.run();
		}
	};

	it("says nothing waits, without a value", async () => {
		const row = summaryOf(figure(await page(), "waiting" as AllowanceId));
		expect(row).toContain(`>${de["admin.waiting.heading"]}<`);
		expect(row).toContain('<span class="settings-sub">Nichts wartet.</span>');
		expect(row).not.toContain("settings-value");
	});

	it("gets the singular right", async () => {
		await setStravaUsage({ observedAt: NOW - 60 });
		await wait(1);
		expect(await page()).toContain(
			"1 Eintrag wartet, fertig in etwa 15 Minuten.",
		);
	});

	it("shows how many and about how long, naming nobody", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Synthetica" });
		await setStravaUsage({ observedAt: NOW - 60 });
		await wait(3);
		const text = await page();
		const row = summaryOf(figure(text, "waiting" as AllowanceId));
		expect(row).toContain("3 Einträge warten, fertig in etwa 15 Minuten.");
		expect(row).toContain('<span class="settings-value">3</span>');
		expect(text).not.toContain("Synthetica");
	});
});

describe("Betrieb (feature 048 US4)", () => {
	const betrieb = (text: string) => {
		const start = text.indexOf(
			'<section class="settings-section" id="betrieb"',
		);
		return start === -1
			? "missing"
			: text.slice(start, text.indexOf("</section>", start));
	};

	it("always shows its five rows, in order, under its head", async () => {
		const text = betrieb(await page());
		expect(text).toContain(
			`<h2 id="betrieb-heading">Betrieb <small>letzte 30 Tage</small></h2>`,
		);
		expect(
			[...text.matchAll(/<li id="([^"]+)"><details>/g)].map((m) => m[1]),
		).toEqual(["waiting", "strava-calls", "recheck", "routing", "cpu"]);
	});

	it("says each one's state in one line", async () => {
		const text = await page();
		const sub = (id: string) =>
			summaryOf(figure(text, id as AllowanceId)).match(
				/<span class="settings-sub">([^<]*)<\/span>/,
			)?.[1];
		expect(sub("strava-calls")).toBe(
			"Heute 0 Aufrufe dieses Teams · nichts zurückgehalten",
		);
		expect(sub("recheck")).toBe(
			"150 Prüfungen am Tag · 0 aktive Rider · noch nicht gelaufen",
		);
		expect(sub("routing")).toBe("Noch keine Zahlen");
		expect(sub("cpu")).toBe(`Noch keine Zahlen · Limit 10${NB}ms je Lauf`);
	});

	it("keeps today's section inside the opened row", async () => {
		const row = figure(await page(), "cpu" as AllowanceId);
		expect(row).toContain('<div class="settings-panel is-wide">');
		expect(row).toContain(de["admin.cpu.none"]);
		expect(row).not.toContain("<h2>");
	});

	it("opens Strava-Aufrufe when a day is asked for", async () => {
		const text = await page("de", `/admin?calls=${TODAY}`);
		expect(text).toContain('<li id="strava-calls"><details open>');
		expect(text).toContain('<li id="recheck"><details>');
	});
});

describe("updating now (FR-040)", () => {
	const refresh = async (target = ctx) =>
		handleFetch(
			request("/admin/refresh", {
				form: {},
				cookies: await sessionCookie(target, ADMIN),
			}),
			target,
		);

	it("records Cloudflare's figures, and a repeat doesn't count twice", async () => {
		installCloudflare(() =>
			Response.json(cloudflareBody({ [TODAY]: { requests: 1234 } })),
		);
		const target = { ...ctx, env: { ...ctx.env, ...WITH_ANALYTICS } };
		for (const _ of [1, 2]) {
			const res = await refresh(target);
			expect(res.status).toBe(303);
			expect(res.headers.get("Location")).toBe("/admin");
		}
		const { results } = await env.DB.prepare(
			"SELECT used FROM usage_daily WHERE allowance = 'cf_worker_requests'",
		).all();
		expect(results).toEqual([{ used: 1234 }]);
		vi.mocked(globalThis.fetch).mockRestore();
	});

	it("still answers without the secrets", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect((await refresh()).status).toBe(303);
		expect(await page()).toContain(de["admin.cloudflare.unavailable"]);
		warn.mockRestore();
	});
});

describe("usage alerts switch (FR-039)", () => {
	const set = async (athleteId: string, value: string) =>
		handleFetch(
			request("/admin/alerts", {
				form: { admin_alerts: value },
				cookies: await sessionCookie(ctx, athleteId),
			}),
			ctx,
		);
	const stored = (athleteId: string) =>
		env.DB.prepare("SELECT admin_alerts FROM riders WHERE athlete_id = ?")
			.bind(athleteId)
			.first("admin_alerts");

	/** The switch row, in its own section under Betrieb (feature 048 R11). */
	const alerts = (text: string) =>
		text.match(
			/<section class="settings-section" id="alerts"[\s\S]*?<\/section>/,
		)?.[0] ?? "";

	it("is on by default", async () => {
		expect(await stored(ADMIN)).toBe(1);
		const text = alerts(await page());
		expect(text).toContain(
			`<h2 id="alerts-heading">${de["admin.alerts.heading"]}</h2>`,
		);
		expect(text).toContain('<form method="post" action="/admin/alerts">');
		expect(text).toContain(
			'<input type="hidden" name="admin_alerts" value="off">',
		);
		expect(text).toContain(
			'<button role="switch" aria-checked="true" aria-labelledby="alerts-on"></button>',
		);
		// Feature 048 FR-011: the switch names the three levels.
		expect(text).toContain(
			"Benachrichtigung bei Hinweis, Warnung und kritisch",
		);
		expect(text).toContain(de["admin.alerts.levels"]);
	});

	it("sets only the viewer's own, and stays set after a reload", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, administrator: true });
		const res = await set(ADMIN, "off");
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/admin");
		expect(await stored(ADMIN)).toBe(0);
		expect(await stored(ATHLETE_B)).toBe(1);
		const text = alerts(await page());
		expect(text).toContain('aria-checked="false"');
		expect(text).toContain(
			'<input type="hidden" name="admin_alerts" value="on">',
		);
		expect(text).toContain(de["admin.alerts.off"]);
		await set(ADMIN, "on");
		expect(await stored(ADMIN)).toBe(1);
	});

	it("says under it when no device gets notifications, and when recording began", async () => {
		const without = alerts(await page());
		expect(without).toContain(
			`<span class="settings-sub is-warn">${de["admin.lage.deviceLine"]}</span>`,
		);
		expect(without).toContain(
			`<p class="settings-note">${de["admin.history.none"]}</p>`,
		);
		await seedSubscription(ADMIN, pushEndpoint(1));
		expect(alerts(await page())).not.toContain("is-warn");
	});

	it("ignores anything but on and off", async () => {
		await set(ADMIN, "maybe");
		expect(await stored(ADMIN)).toBe(1);
	});
});

describe("the notifications hint (US5 scenario 5, feature 048 FR-019)", () => {
	it("appears in the list without a device, linking to the settings", async () => {
		const text = await page();
		expect(lage(text)).toContain(`>${de["admin.lage.device"]}<`);
		expect(lage(text)).toContain(
			'<a class="settings-row" href="/me/settings">',
		);
	});

	it("goes with a device", async () => {
		await seedSubscription(ADMIN, pushEndpoint(1));
		expect(await page()).not.toContain(de["admin.lage.device"]);
	});
});
