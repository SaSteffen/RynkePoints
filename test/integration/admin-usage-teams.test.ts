import { createScheduledController, env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch, handleScheduled } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	type SentMessage,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import { seedUsageDay, setStravaUsage } from "../support/usage";

// Usage across teams (feature 026 FR-039 to FR-041,
// contracts/usage-exchange.md). Hamburg's deployment with Europe as its other
// team; Europe's export is a stub with synthetic counts. No test reaches
// another team, Strava or Cloudflare.

const NOW = Date.UTC(2026, 10, 4, 12, 58, 0) / 1000;
const TODAY = "2026-11-04";
const YESTERDAY = "2026-11-03";
const TOKEN = "synthetic-exchange-token";
const EUROPE = "https://europe.example.org";
const en = CATALOGS.en;
const ADMIN = ATHLETE_A;
const OWN = en["admin.history.team"];
const OTHER = en["admin.teams.other"];

const hourly = () =>
	createScheduledController({
		scheduledTime: new Date(NOW * 1000),
		cron: "58 * * * *",
	});

let ctx: TestCtx;

function withPeers(token: string | null = TOKEN): TestCtx {
	const base = makeCtx({ now: NOW });
	return {
		...base,
		env: {
			...base.env,
			USAGE_PEERS: JSON.stringify([{ id: "europe", origin: EUROPE }]),
			...(token === null ? {} : { USAGE_EXCHANGE_TOKEN: token }),
		},
	};
}

interface ExportCall {
	url: URL;
	authorization: string | null;
}

/** Answers Europe's export with `answer`; anything else is refused. */
function installEurope(answer: () => Response | "throw"): ExportCall[] {
	const calls: ExportCall[] = [];
	vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
		const req = new Request(input, init);
		const url = new URL(req.url);
		if (url.origin !== EUROPE) throw new Error(`Unexpected fetch to ${url}`);
		calls.push({ url, authorization: req.headers.get("Authorization") });
		const response = answer();
		if (response === "throw") throw new TypeError("Network connection lost");
		return response;
	});
	return calls;
}

const europeCounts = (counts: Record<string, number>, day = TODAY) =>
	Response.json({
		team: "europe",
		days: Object.entries(counts).map(([allowance, count]) => ({
			day,
			allowance,
			count,
		})),
	});

async function seedTeamCount(
	day: string,
	allowance: string,
	used: number,
	team = "europe",
) {
	await env.DB.prepare(
		`INSERT INTO usage_team_daily (day, allowance, team, used, recorded_at)
		VALUES (?, ?, ?, ?, ?)`,
	)
		.bind(day, allowance, team, used, NOW - 3600)
		.run();
}

async function setTeamState(success: number | null, failure: number | null) {
	await env.DB.prepare(
		`INSERT OR REPLACE INTO usage_source_state (source, last_success_at,
			last_failure_at) VALUES ('team:europe', ?, ?)`,
	)
		.bind(success, failure)
		.run();
}

async function exportFrom(
	query = "",
	headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}` },
	method = "GET",
) {
	return handleFetch(
		new Request(`https://rynke.example/admin/usage/export${query}`, {
			method,
			headers,
		}),
		ctx,
	);
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

/** The list item of an allowance, by its English name. */
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
	await seedRider(ctx, { athleteId: ATHLETE_B });
	await setStravaUsage({
		observedAt: NOW - 60,
		readDaily: 1200,
		allDaily: 1500,
		ownReadDaily: 900,
		ownAllDaily: 1000,
	});
});

describe("GET /admin/usage/export", () => {
	it("gives this team's own counts: past days as recorded, today live", async () => {
		await seedUsageDay(YESTERDAY, "strava_read_daily", 2000, 3000, {
			team: 1500,
		});
		await seedUsageDay(YESTERDAY, "cf_worker_requests", 900, 100_000);
		const res = await exportFrom(`?since=${YESTERDAY}`);
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		const body = await res.json();
		expect(body).toEqual({
			team: "hamburg",
			days: [
				{ day: YESTERDAY, allowance: "strava_read_daily", count: 1500 },
				{ day: TODAY, allowance: "strava_read_daily", count: 900 },
				{ day: TODAY, allowance: "strava_all_daily", count: 1000 },
				{ day: TODAY, allowance: "riders_connected", count: 2 },
			],
		});
		// Counts only: no rider crosses teams (FR-039).
		expect(JSON.stringify(body)).not.toContain(String(ADMIN));
	});

	it("starts yesterday when nothing valid is asked for", async () => {
		await seedUsageDay("2026-11-01", "strava_read_daily", 10, 3000, {
			team: 5,
		});
		const body = (await (await exportFrom("?since=nonsense")).json()) as {
			days: { day: string }[];
		};
		expect(body.days.every((count) => count.day >= YESTERDAY)).toBe(true);
	});

	it.each([
		["without the token", {}],
		["with a wrong token", { Authorization: "Bearer wrong" }],
	])("is an unknown address %s", async (_, headers) => {
		const res = await exportFrom("", headers);
		expect(res.status).toBe(404);
	});

	it("is an unknown address while the exchange token isn't set", async () => {
		ctx = withPeers(null);
		expect((await exportFrom()).status).toBe(404);
	});

	it("is an unknown address for anything but GET", async () => {
		expect(
			(await exportFrom("", { Authorization: `Bearer ${TOKEN}` }, "POST"))
				.status,
		).toBe(404);
	});
});

describe("the hourly recording with another team", () => {
	it("stores the other team's counts and counts connected riders together", async () => {
		const calls = installEurope(() =>
			europeCounts({
				strava_read_daily: 200,
				strava_all_daily: 300,
				riders_connected: 40,
			}),
		);
		await handleScheduled(hourly(), ctx);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.authorization).toBe(`Bearer ${TOKEN}`);
		expect(calls[0]?.url.pathname).toBe("/admin/usage/export");
		expect(calls[0]?.url.searchParams.get("since")).toBe(YESTERDAY);
		const { results } = await env.DB.prepare(
			"SELECT allowance, used FROM usage_team_daily WHERE team = 'europe' AND day = ? ORDER BY allowance",
		)
			.bind(TODAY)
			.all();
		expect(results).toEqual([
			{ allowance: "riders_connected", used: 40 },
			{ allowance: "strava_all_daily", used: 300 },
			{ allowance: "strava_read_daily", used: 200 },
		]);
		const riders = await env.DB.prepare(
			"SELECT used, team_used FROM usage_daily WHERE day = ? AND allowance = 'riders_connected'",
		)
			.bind(TODAY)
			.first();
		expect(riders).toEqual({ used: 42, team_used: 2 });
	});

	it("asks from the last day it has, to fill missed days", async () => {
		await seedTeamCount("2026-10-30", "riders_connected", 30);
		const calls = installEurope(() => europeCounts({ riders_connected: 30 }));
		await handleScheduled(hourly(), ctx);
		expect(calls[0]?.url.searchParams.get("since")).toBe("2026-10-30");
	});

	it("keeps the other team's last riders when it doesn't answer", async () => {
		await seedTeamCount(YESTERDAY, "riders_connected", 35);
		installEurope(() => new Response("down", { status: 503 }));
		await handleScheduled(hourly(), ctx);
		const riders = await env.DB.prepare(
			"SELECT used FROM usage_daily WHERE day = ? AND allowance = 'riders_connected'",
		)
			.bind(TODAY)
			.first<number>("used");
		expect(riders).toBe(37);
		const state = await env.DB.prepare(
			"SELECT last_success_at, last_failure_at FROM usage_source_state WHERE source = 'team:europe'",
		).first();
		expect(state).toEqual({ last_success_at: null, last_failure_at: NOW });
	});

	it("refuses an answer from another team or with a wrong shape", async () => {
		installEurope(() =>
			Response.json({
				team: "hamburg",
				days: [{ day: TODAY, allowance: "riders_connected", count: 5 }],
			}),
		);
		await handleScheduled(hourly(), ctx);
		const stored = await env.DB.prepare(
			"SELECT COUNT(*) AS n FROM usage_team_daily",
		).first<number>("n");
		expect(stored).toBe(0);
	});

	it("asks nobody without the exchange token", async () => {
		ctx = withPeers(null);
		const calls = installEurope(() => europeCounts({}));
		await handleScheduled(hourly(), ctx);
		expect(calls).toEqual([]);
	});

	it("alerts this team's administrators on all teams' riders (FR-041)", async () => {
		await seedSubscription(ADMIN, pushEndpoint(1));
		installEurope(() => europeCounts({ riders_connected: 800 }));
		await handleScheduled(hourly(), ctx);
		const notified = ctx.queue.sent.flatMap(({ body }: SentMessage) =>
			body.kind === "send-notification" ? [body.athleteId] : [],
		);
		expect(notified).toEqual([ADMIN]);
		const { results } = await env.DB.prepare(
			"SELECT allowance, level FROM usage_alerts",
		).all();
		expect(results).toEqual([{ allowance: "riders_connected", level: 80 }]);
	});
});

describe("/admin with another team", () => {
	beforeEach(async () => {
		await setTeamState(NOW - 120, null);
		await seedTeamCount(TODAY, "strava_read_daily", 200);
		await seedTeamCount(TODAY, "riders_connected", 40);
	});

	it("shows each team's count and share, then what no team counts", async () => {
		const text = await page();
		const item = figure(text, "admin.allowance.strava_read_daily");
		expect(item).toContain(teamCount(OWN, "900", "75"));
		expect(item).toContain(teamCount(OTHER, "200", "16"));
		expect(item).toContain(en["admin.figure.rest"].replace("{n}", "100"));
		// No page names another team (FR-023).
		expect(text).not.toContain("Team Rynkeby Europe");
	});

	it("says when a team has no count of a figure yet", async () => {
		const item = figure(await page(), "admin.allowance.strava_all_daily");
		expect(item).toContain(
			escapeHtml(en["admin.figure.teamNone"].replace("{team}", OTHER)),
		);
	});

	it("shows all teams' connected riders against the capacity", async () => {
		const item = figure(await page(), "admin.allowance.riders_connected");
		expect(item).toContain("42 of 999");
		expect(item).toContain(teamCount(OWN, "2", "4"));
		expect(item).toContain(teamCount(OTHER, "40", "95"));
		expect(item).not.toContain(en["admin.figure.rest"].replace("{n}", ""));
	});

	it("says that 15-minute counts aren't exchanged", async () => {
		const item = figure(await page(), "admin.allowance.strava_read_15m");
		expect(item).toContain(escapeHtml(en["admin.figure.windowNote"]));
	});

	it("still shows the view when a team didn't answer, with its last figures", async () => {
		await setTeamState(NOW - 7200, NOW - 60);
		const text = await page();
		expect(text).toContain(
			escapeHtml(
				en["admin.teams.stale"]
					.replace("{team}", OTHER)
					.replace("{time}", "04/11/2026, 10:58"),
			),
		);
		expect(figure(text, "admin.allowance.strava_read_daily")).toContain(
			teamCount(OTHER, "200", "16"),
		);
	});

	it("says when a team has never answered", async () => {
		await env.DB.prepare("DELETE FROM usage_source_state").run();
		expect(await page()).toContain(
			escapeHtml(en["admin.teams.never"].replace("{team}", OTHER)),
		);
	});

	it("gives each team a column in the day table", async () => {
		await seedUsageDay(TODAY, "strava_read_daily", 1200, 3000, { team: 900 });
		const text = await page("/admin?days=strava_read_daily");
		const table = text.slice(text.indexOf('<div class="usage-table">'));
		expect(table).toContain(`<th scope="col">${OWN}</th>`);
		expect(table).toContain(`<th scope="col">${OTHER}</th>`);
		expect(table).toContain("<td>900</td><td>200</td>");
	});

	it("doesn't call another team while viewing", async () => {
		const calls = installEurope(() => europeCounts({}));
		await page();
		expect(calls).toEqual([]);
	});
});

describe("/admin without other teams", () => {
	it("keeps the one-team split", async () => {
		ctx = makeCtx({ now: NOW });
		await seedTeamCount(TODAY, "strava_read_daily", 200);
		const item = figure(await page(), "admin.allowance.strava_read_daily");
		expect(item).toContain(
			en["admin.figure.split"]
				.replace("{team}", "900")
				.replace("{rest}", "300"),
		);
		expect(item).not.toContain(OTHER);
	});
});
