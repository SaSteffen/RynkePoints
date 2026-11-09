import { createScheduledController, env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch, handleScheduled } from "../../src/index";
import { europe } from "../../src/teams/europe";
import { hamburg } from "../../src/teams/hamburg";
import { GATEWAY_WORKER } from "../../src/usage/split";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import {
	installCloudflare,
	setStravaUsage,
	WITH_ANALYTICS,
} from "../support/usage";

// Cloudflare's figures split by team (feature 026 FR-040,
// contracts/usage-exchange.md › Cloudflare). Hamburg's deployment reads the
// account's synthetic answer: its own Worker and database, Europe's, the
// gateway's, and one of nobody's. No test reaches Cloudflare.

const NOW = Date.UTC(2026, 10, 4, 12, 58, 0) / 1000;
const TODAY = "2026-11-04";
const en = CATALOGS.en;
const ADMIN = ATHLETE_A;
const OWN = en["admin.history.team"];
const OTHER = en["admin.teams.other"];
const SHARED = en["admin.teams.shared"];

const hourly = () =>
	createScheduledController({
		scheduledTime: new Date(NOW * 1000),
		cron: "58 * * * *",
	});

/** The account's answer for today: 1,000 requests and 10,000 rows read. */
function accountBody() {
	const worker = (scriptName: string, requests: number) => ({
		sum: { requests },
		dimensions: { date: TODAY, scriptName },
	});
	const database = (databaseId: string, rowsRead: number) => ({
		sum: { rowsRead, rowsWritten: 0 },
		dimensions: { date: TODAY, databaseId },
	});
	return {
		data: {
			viewer: {
				accounts: [
					{
						workers: [
							worker(hamburg.cloudflare.worker, 600),
							worker(europe.cloudflare.worker, 300),
							worker(GATEWAY_WORKER, 50),
							worker("some-sandbox", 50),
						],
						queues: [
							{
								sum: { billableOperations: 80 },
								dimensions: { date: TODAY, queueId: "queue-0" },
							},
						],
						databases: [
							database(hamburg.cloudflare.databaseId, 7000),
							database(europe.cloudflare.databaseId, 3000),
						],
						storage: [
							{
								max: { databaseSizeBytes: 4000 },
								dimensions: {
									date: TODAY,
									databaseId: hamburg.cloudflare.databaseId,
								},
							},
						],
					},
				],
			},
		},
		errors: null,
	};
}

let ctx: TestCtx;

function withPeers(): TestCtx {
	const base = makeCtx({ now: NOW });
	return {
		...base,
		env: {
			...base.env,
			...WITH_ANALYTICS,
			USAGE_PEERS: JSON.stringify([
				{ id: "europe", origin: "https://europe.example.org" },
			]),
		},
	};
}

async function page(path = "/admin") {
	const res = await handleFetch(
		request(path, {
			cookies: await sessionCookie(ctx, ADMIN),
			acceptLanguage: "en",
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

function figure(text: string, id: keyof typeof en): string {
	return (
		text
			.split('<li class="usage-figure')
			.find((item) => item.includes(`>${en[id]}<`)) ?? `missing ${String(id)}`
	);
}

const teamCount = (team: string, n: string, percent: string) =>
	escapeHtml(
		en["admin.figure.teamCount"]
			.replace("{team}", team)
			.replace("{n}", n)
			.replace("{percent}", percent),
	);

beforeEach(async () => {
	await resetDb();
	ctx = withPeers();
	vi.spyOn(console, "warn").mockImplementation(() => {});
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
	await setStravaUsage({ observedAt: NOW - 60 });
	installCloudflare(() => Response.json(accountBody()));
	await handleScheduled(hourly(), ctx);
});

describe("the hourly recording", () => {
	it("records this team's share and the other teams' and the gateway's", async () => {
		const own = await env.DB.prepare(
			"SELECT allowance, used, team_used FROM usage_daily WHERE day = ? AND allowance LIKE 'cf_%' ORDER BY allowance",
		)
			.bind(TODAY)
			.all();
		expect(own.results).toEqual([
			{ allowance: "cf_d1_rows_read", used: 10000, team_used: 7000 },
			{ allowance: "cf_d1_rows_written", used: 0, team_used: 0 },
			{ allowance: "cf_d1_storage_bytes", used: 4000, team_used: 4000 },
			// No queue IDs in team data yet.
			{ allowance: "cf_queue_operations", used: 80, team_used: null },
			{ allowance: "cf_worker_requests", used: 1000, team_used: 600 },
		]);
		const others = await env.DB.prepare(
			"SELECT team, used FROM usage_team_daily WHERE day = ? AND allowance = 'cf_worker_requests' ORDER BY team",
		)
			.bind(TODAY)
			.all();
		expect(others.results).toEqual([
			{ team: "europe", used: 300 },
			{ team: "shared", used: 50 },
		]);
	});
});

describe("/admin", () => {
	it("splits a Cloudflare figure into teams, the gateway and the rest", async () => {
		const item = figure(await page(), "admin.allowance.cf_worker_requests");
		expect(item).toContain(teamCount(OWN, "600", "60"));
		expect(item).toContain(teamCount(OTHER, "300", "30"));
		expect(item).toContain(teamCount(SHARED, "50", "5"));
		expect(item).toContain(en["admin.figure.rest"].replace("{n}", "50"));
	});

	it("says when a figure can't be split", async () => {
		const item = figure(await page(), "admin.allowance.cf_queue_operations");
		expect(item).toContain(escapeHtml(en["admin.figure.notSplit"]));
	});

	it("shows the gateway's part without other teams too", async () => {
		ctx = { ...ctx, env: { ...ctx.env, USAGE_PEERS: "[]" } };
		const item = figure(await page(), "admin.allowance.cf_worker_requests");
		expect(item).toContain(teamCount(OWN, "600", "60"));
		expect(item).toContain(teamCount(SHARED, "50", "5"));
		expect(item).toContain(en["admin.figure.rest"].replace("{n}", "350"));
		expect(item).not.toContain(OTHER);
	});

	it("gives the teams and the gateway a column in the day table", async () => {
		const text = await page("/admin?days=cf_worker_requests");
		const table = text.slice(text.indexOf('<div class="usage-table">'));
		expect(table).toContain(`<th scope="col">${OTHER}</th>`);
		expect(table).toContain(`<th scope="col">${escapeHtml(SHARED)}</th>`);
		expect(table).toContain("<td>600</td><td>300</td><td>50</td>");
	});
});
