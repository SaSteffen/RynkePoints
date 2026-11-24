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
		text.indexOf('id="cpu"'),
		text.indexOf("</section>", text.indexOf('id="cpu"')),
	);

const cell = (slowest: string, cut: string, runs: string) =>
	escapeHtml(
		en["admin.cpu.cell"]
			.replace("{slowest}", en["admin.cpu.ms"].replace("{n}", slowest))
			.replace("{cut}", cut)
			.replace("{runs}", runs),
	);

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
		expect(table).toContain(`<th scope="col">${en["admin.history.team"]}</th>`);
		expect(table).toContain(`<th scope="col">${en["admin.teams.other"]}</th>`);
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
		expect(section(text)).toContain("usage-mark-critical");
		// Listed and counted, but notified by that team (feature 048 FR-002).
		expect(text).toContain(
			escapeHtml(
				en["admin.lage.cpu"].replace("{owner}", en["admin.teams.other"]),
			),
		);
		expect(text).toContain(">1 critical<");
	});
});
