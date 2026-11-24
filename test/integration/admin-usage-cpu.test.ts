import { createScheduledController, env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch, handleScheduled } from "../../src/index";
import { GATEWAY_WORKER } from "../../src/usage/split";
import { europe } from "../../teams/europe/team";
import { hamburg } from "../../teams/hamburg/team";
import {
	makeCtx,
	request,
	resetDb,
	type SentMessage,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import {
	type CpuFigures,
	cloudflareBody,
	cpuBody,
	installCloudflare,
	setStravaUsage,
	WITH_ANALYTICS,
} from "../support/usage";

// The Workers' CPU time on the usage view (feature 025 User Story 6, FR-041 to
// FR-045): Hamburg's deployment reads the account's synthetic CPU answer for its
// own Worker, Europe's, the gateway's and a sandbox's. No test reaches
// Cloudflare.

const NOW = Date.UTC(2026, 10, 4, 12, 58, 0) / 1000;
const TODAY = "2026-11-04";
const YESTERDAY = "2026-11-03";
const en = CATALOGS.en;
const ADMIN = ATHLETE_A;

const hourly = () =>
	createScheduledController({
		scheduledTime: new Date(NOW * 1000),
		cron: "58 * * * *",
	});

const worker = (
	scriptName: string,
	runs: number,
	cutOff: number,
	cpuTimeP99: number,
	date = TODAY,
): CpuFigures => ({ date, scriptName, runs, cutOff, cpuTimeP99 });

let ctx: TestCtx;

/** Records with this CPU answer (or failure) and a plain usage answer. */
async function record(cpu: CpuFigures[] | "fail") {
	installCloudflare(
		() => Response.json(cloudflareBody({ [TODAY]: { requests: 10 } })),
		() =>
			cpu === "fail"
				? new Response("unavailable", { status: 503 })
				: Response.json(cpuBody(cpu)),
	);
	await handleScheduled(hourly(), ctx);
}

async function page() {
	const res = await handleFetch(
		request("/admin", {
			cookies: await sessionCookie(ctx, ADMIN),
			acceptLanguage: "en",
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

const section = (text: string) =>
	text.slice(
		text.indexOf('<li id="cpu">'),
		text.indexOf("</details></li>", text.indexOf('<li id="cpu">')),
	);

/** A table cell's text: "median / slowest ms", then the runs cut off. */
const cell = (slowest: string, cut: string, runs: string, median = "0.0") =>
	`${escapeHtml(
		en["admin.cpu.pair"]
			.replace("{median}", median)
			.replace("{slowest}", slowest),
	)}<br>${escapeHtml(
		en["admin.cpu.cutOff"].replace("{cut}", cut).replace("{runs}", runs),
	)}`;

const notified = (sent: readonly SentMessage[]) =>
	sent.filter(({ body }) => body.kind === "send-notification").length;

const alerts = async () =>
	(
		await env.DB.prepare(
			"SELECT allowance, period, level FROM usage_alerts WHERE allowance = 'cpu_cut_off' ORDER BY level",
		).all()
	).results;

beforeEach(async () => {
	await resetDb();
	const base = makeCtx({ now: NOW });
	ctx = { ...base, env: { ...base.env, ...WITH_ANALYTICS } };
	vi.spyOn(console, "warn").mockImplementation(() => {});
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
	await seedSubscription(ADMIN, pushEndpoint(1));
	await setStravaUsage({ observedAt: NOW - 60 });
});

describe("the hourly recording (FR-041)", () => {
	it("keeps each owner's day and leaves out Workers of no team", async () => {
		await record([
			worker(hamburg.cloudflare.worker, 900, 0, 4200),
			worker(europe.cloudflare.worker, 300, 0, 2100),
			worker(GATEWAY_WORKER, 1200, 0, 800),
			worker("some-sandbox", 50, 50, 20000),
			worker(hamburg.cloudflare.worker, 700, 0, 3900, YESTERDAY),
		]);
		const rows = await env.DB.prepare(
			"SELECT day, owner, runs, cut_off, cpu_p99_us FROM usage_cpu_daily ORDER BY day, owner",
		).all();
		expect(rows.results).toEqual([
			{
				day: YESTERDAY,
				owner: "hamburg",
				runs: 700,
				cut_off: 0,
				cpu_p99_us: 3900,
			},
			{ day: TODAY, owner: "europe", runs: 300, cut_off: 0, cpu_p99_us: 2100 },
			{ day: TODAY, owner: "hamburg", runs: 900, cut_off: 0, cpu_p99_us: 4200 },
			{ day: TODAY, owner: "shared", runs: 1200, cut_off: 0, cpu_p99_us: 800 },
		]);
	});

	it("replaces today's values on the next recording", async () => {
		await record([worker(hamburg.cloudflare.worker, 900, 0, 4200)]);
		await record([worker(hamburg.cloudflare.worker, 950, 1, 4300)]);
		const row = await env.DB.prepare(
			"SELECT runs, cut_off, cpu_p99_us FROM usage_cpu_daily WHERE owner = 'hamburg'",
		).first();
		expect(row).toEqual({ runs: 950, cut_off: 1, cpu_p99_us: 4300 });
	});

	it("keeps the other Cloudflare figures when the CPU query fails (FR-045)", async () => {
		await record("fail");
		const requests = await env.DB.prepare(
			"SELECT used FROM usage_daily WHERE allowance = 'cf_worker_requests'",
		).first("used");
		expect(requests).toBe(10);
		const text = await page();
		expect(section(text)).toContain(escapeHtml(en["admin.cpu.unavailable"]));
		expect(text).not.toContain(escapeHtml(en["admin.cloudflare.unavailable"]));
	});
});

describe("the view (FR-042, FR-043)", () => {
	it("shows a day per row: this team, the other teams, the gateway", async () => {
		await record([
			worker(hamburg.cloudflare.worker, 900, 0, 4200),
			worker(europe.cloudflare.worker, 300, 0, 2100),
			worker(GATEWAY_WORKER, 1200, 0, 800),
			worker(hamburg.cloudflare.worker, 700, 0, 3900, YESTERDAY),
		]);
		const table = section(await page());
		const head = `<br><span class="cpu-head">${escapeHtml(en["admin.cpu.pairHead"])}</span></th>`;
		expect(table).toContain(
			`<th scope="col">${escapeHtml(en["admin.history.team"])}${head}`,
		);
		expect(table).toContain(
			`<th scope="col">${escapeHtml(en["admin.teams.other"])}${head}`,
		);
		expect(table).toContain(
			`<th scope="col">${escapeHtml(en["admin.teams.shared"])}${head}`,
		);
		expect(table).toContain(
			escapeHtml(
				en["admin.cpu.intro"].replace(
					"{limit}",
					en["admin.cpu.ms"].replace("{n}", "10"),
				),
			),
		);
		expect(table).toContain(cell("4.2", "0", "900"));
		expect(table).toContain(cell("2.1", "0", "300"));
		expect(table).toContain(cell("0.8", "0", "1,200"));
		expect(table).toContain(cell("3.9", "0", "700"));
		expect(table.indexOf(cell("4.2", "0", "900"))).toBeLessThan(
			table.indexOf(cell("3.9", "0", "700")),
		);
		expect(table).not.toContain("usage-mark");
		expect(table).not.toContain(europe.name);
	});

	it("never marks the slowest runs alone, only runs cut off", async () => {
		await record([
			worker(hamburg.cloudflare.worker, 1000, 0, 14000),
			worker(europe.cloudflare.worker, 1000, 1, 2000),
			worker(GATEWAY_WORKER, 1000, 11, 900),
		]);
		const text = await page();
		const table = section(text);
		expect(table).toContain(`${cell("14.0", "0", "1,000")}</td>`);
		expect(table).toContain(
			`${cell("2.0", "1", "1,000")} <span class="usage-mark usage-mark-warning">${en["admin.level.warning"]}</span>`,
		);
		expect(table).toContain(
			`${cell("0.9", "11", "1,000")} <span class="usage-mark usage-mark-critical">${en["admin.level.critical"]}</span>`,
		);
	});

	it("shows the median beside the slowest runs, a dash where none was recorded (feature 049)", async () => {
		await record([
			{
				date: TODAY,
				scriptName: hamburg.cloudflare.worker,
				runs: 1234,
				cutOff: 0,
				cpuTimeP99: 7800,
				cpuTimeP50: 1400,
			},
		]);
		// A day the release before recorded, without a median.
		await env.DB.prepare(
			`INSERT INTO usage_cpu_daily (day, owner, runs, cut_off, cpu_p99_us,
				recorded_at) VALUES (?, 'hamburg', 1234, 3, 7800, 1)`,
		)
			.bind(YESTERDAY)
			.run();
		const table = section(await page());
		expect(table).toContain(`<td>${cell("7.8", "0", "1,234", "1.4")}</td>`);
		expect(table).toContain(
			`<td>${cell("7.8", "3", "1,234", "–")} <span class="usage-mark usage-mark-warning">`,
		);
		// No other team and no gateway that day.
		expect(table).toContain("<td>–</td><td>–</td></tr>");
	});

	it("says when nothing was recorded yet", async () => {
		await record([]);
		expect(section(await page())).toContain(escapeHtml(en["admin.cpu.none"]));
	});
});

describe("alerts (FR-044)", () => {
	it("notifies once per level and day for this team's Worker", async () => {
		await record([worker(hamburg.cloudflare.worker, 1000, 1, 9000)]);
		expect(notified(ctx.queue.sent)).toBe(1);
		expect(await alerts()).toEqual([
			{ allowance: "cpu_cut_off", period: TODAY, level: 80 },
		]);
		ctx.queue.sent.length = 0;
		await record([worker(hamburg.cloudflare.worker, 1000, 1, 9000)]);
		expect(notified(ctx.queue.sent)).toBe(0);
		await record([worker(hamburg.cloudflare.worker, 1000, 20, 9000)]);
		expect(notified(ctx.queue.sent)).toBe(1);
		expect(await alerts()).toHaveLength(2);
	});

	it("notifies for the gateway and lists it, counted (feature 048 FR-002)", async () => {
		await record([worker(GATEWAY_WORKER, 1000, 2, 900)]);
		expect(notified(ctx.queue.sent)).toBe(1);
		const text = await page();
		expect(text).toContain(
			escapeHtml(
				en["admin.lage.cpu"].replace("{owner}", en["admin.teams.shared"]),
			),
		);
		expect(text).toContain('<a class="settings-row" href="#cpu">');
		expect(text).toContain(">1 warning<");
	});

	it("leaves another team's cut-off runs to that team", async () => {
		await record([worker(europe.cloudflare.worker, 1000, 50, 9000)]);
		expect(notified(ctx.queue.sent)).toBe(0);
		expect(await alerts()).toEqual([]);
		const text = await page();
		expect(section(text)).toContain(
			`<span class="settings-title">${escapeHtml(en["admin.cpu.heading"])}<span class="usage-mark usage-mark-critical">Critical</span></span><span class="settings-sub">Today 50 of 1,000 runs cut off</span>`,
		);
		// Listed and counted, but notified by that team (feature 048 FR-002).
		expect(text).toContain(
			escapeHtml(
				en["admin.lage.cpu"].replace("{owner}", en["admin.teams.other"]),
			),
		);
		expect(text).toContain(">1 critical<");
	});
});

describe("the season graph (feature 049 User Story 1)", () => {
	const SEASON_NOW = Date.UTC(2026, 10, 24, 12, 0, 0) / 1000;
	const self = env.TEAM_ID;
	const other = self === "europe" ? "hamburg" : "europe";

	const cpuDay = (day: string, owner: string, p50: number | null, p99 = 5000) =>
		env.DB.prepare(
			`INSERT INTO usage_cpu_daily (day, owner, runs, cut_off, cpu_p99_us,
				cpu_p50_us, recorded_at) VALUES (?, ?, 1000, 0, ?, ?, 1)`,
		)
			.bind(day, owner, p99, p50)
			.run();

	async function seasonPage() {
		ctx = { ...ctx, now: () => SEASON_NOW };
		return section(await page());
	}

	const ms = (n: string) => escapeHtml(en["admin.cpu.ms"].replace("{n}", n));

	it("draws the three owners' weeks over the season, then the table", async () => {
		await cpuDay("2026-11-16", self, 1100);
		await cpuDay("2026-11-18", self, 1800);
		await cpuDay("2026-11-17", other, 1200);
		await cpuDay("2026-11-17", "shared", 400);
		await cpuDay("2026-11-24", self, 1500);
		await cpuDay("2026-09-02", self, 900);
		vi.mocked(globalThis.fetch).mockClear();
		const row = await seasonPage();
		expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
		const at = (piece: string) => {
			const i = row.indexOf(piece);
			expect(i, piece).toBeGreaterThan(-1);
			return i;
		};
		const intro = at(escapeHtml(en["admin.cpu.intro"]).slice(0, 20));
		const graph = at('<div class="cpu-graph">');
		const legend = at('<ul class="cpu-legend">');
		const under = at(
			escapeHtml(
				en["admin.cpu.under"].replace(
					"{limit}",
					en["admin.cpu.ms"].replace("{n}", "10"),
				),
			),
		);
		const table = at("<table>");
		expect(intro).toBeLessThan(graph);
		expect(graph).toBeLessThan(legend);
		expect(legend).toBeLessThan(under);
		expect(under).toBeLessThan(table);

		expect(row).toContain('data-slots="53"');
		const weeks = row.match(/data-weeks="([^"]*)"/)?.[1]?.split(",") ?? [];
		expect(weeks).toHaveLength(13);
		expect(weeks[0]).toBe("2026-09-01/2026-09-06/900//");
		expect(weeks[1]).toBe("2026-09-07/2026-09-13///");
		expect(weeks[11]).toBe("2026-11-16/2026-11-22/1800/1200/400");
		expect(weeks[12]).toBe("2026-11-23/2026-11-29/1500//");
		const names = [
			en["admin.history.team"],
			en["admin.teams.other"],
			en["admin.teams.shared"],
		];
		expect(row).toContain(`data-names="${escapeHtml(names.join("|"))}"`);
		expect(row).toContain(`data-gap="${escapeHtml(en["admin.history.gap"])}"`);
		expect(row).toContain(
			`aria-label="${escapeHtml(
				en["admin.cpu.chart"]
					.replace("{season}", "2026/27")
					.replace("{names}", names.join(", ")),
			)}"`,
		);
		expect(row).toContain(
			`<div class="cpu-scale" aria-hidden="true"><span>${ms("2")}</span><span>${ms("1")}</span><span>${ms("0")}</span></div>`,
		);
		expect(row).toContain(
			`<p class="usage-axis cpu-axis" aria-hidden="true">${en[
				"admin.cpu.months"
			]
				.split("|")
				.map((m) => `<span>${escapeHtml(m)}</span>`)
				.join("")}</p>`,
		);
		for (const name of names) expect(row).toContain(`${escapeHtml(name)}</li>`);
		expect(row).not.toContain("cpu-limit");
		expect(row).not.toContain(europe.name);
		expect(row).not.toContain(hamburg.name);
	});

	it("draws the limit when a week reaches it", async () => {
		await cpuDay("2026-11-10", self, 11000, 15000);
		const row = await seasonPage();
		expect(row).toContain('<line class="cpu-limit"');
		expect(row).toContain(
			escapeHtml(
				en["admin.cpu.underLimit"].replace(
					"{limit}",
					en["admin.cpu.ms"].replace("{n}", "10"),
				),
			),
		);
		expect(row).not.toContain(
			escapeHtml(
				en["admin.cpu.under"].replace(
					"{limit}",
					en["admin.cpu.ms"].replace("{n}", "10"),
				),
			),
		);
		expect(row).toContain(`<span>${ms("20")}</span>`);
	});

	it("says so in one line when the season has no median yet, the table as before", async () => {
		await cpuDay("2026-11-23", self, null);
		const row = await seasonPage();
		expect(row).toContain(
			`<p class="usage-detail cpu-empty">${escapeHtml(en["admin.cpu.seasonNone"])}</p>`,
		);
		expect(row).not.toContain("cpu-graph");
		expect(row).not.toContain("cpu-legend");
		expect(row).toContain("<table>");
	});
});
