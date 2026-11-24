import { createScheduledController, env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleFetch, handleScheduled } from "../../src/index";
import { daysBefore, historyStart } from "../../src/usage/allowances";
import { parseExport } from "../../src/usage/peers";
import { pruneUsage } from "../../src/work/scheduled";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { seedCalls, seedSeen } from "../support/usage";

// Strava call counts across teams (feature 047 contracts/usage-exchange.md):
// each team exports its calls, held-back calls and Strava's count per day, and
// pulls the others'. Totals per day only. Europe is a stub; no test reaches
// another team, Strava or Cloudflare.

const NOW = Date.UTC(2026, 10, 4, 12, 58, 0) / 1000;
const TODAY = "2026-11-04";
const TOKEN = "synthetic-exchange-token";
const EUROPE = "https://europe.example.org";

let ctx: TestCtx;

function withPeers(): TestCtx {
	const base = makeCtx({ now: NOW });
	return {
		...base,
		env: {
			...base.env,
			USAGE_PEERS: JSON.stringify([{ id: "europe", origin: EUROPE }]),
			// A secret set by hand, so not in the generated `Env`.
			...EXCHANGE,
		},
	};
}

const EXCHANGE = { USAGE_EXCHANGE_TOKEN: TOKEN };

interface Entry {
	day: string;
	allowance: string;
	count: number;
}

const CALL_ALLOWANCES = ["strava_calls", "strava_held_back", "strava_seen"];

/** The export's call entries, from `since`. */
async function exported(since: string): Promise<Entry[]> {
	const res = await handleFetch(
		new Request(`https://rynke.example/admin/usage/export?since=${since}`, {
			headers: { Authorization: `Bearer ${TOKEN}` },
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	const body = (await res.json()) as { days: Entry[] };
	return body.days.filter((e) => CALL_ALLOWANCES.includes(e.allowance));
}

const day = (d: string, calls: number, heldBack: number, seen: number) => [
	{ day: d, allowance: "strava_calls", count: calls },
	{ day: d, allowance: "strava_held_back", count: heldBack },
	{ day: d, allowance: "strava_seen", count: seen },
];

beforeEach(async () => {
	await resetDb();
	ctx = withPeers();
	vi.spyOn(console, "warn").mockImplementation(() => {});
	await seedRider(ctx, { athleteId: ATHLETE_A });
});

describe("the export's Strava calls", () => {
	it("gives each day from the first counted one to today, zero without calls", async () => {
		await seedCalls("2026-11-01", "import", "GET /athlete/activities", 30, 2);
		await seedCalls("2026-11-03", "ride-event", "GET /activities/{id}", 5);
		await seedCalls("2026-11-03", "ride-event", "POST /oauth/token", 1);
		await seedSeen("2026-11-03", 40);
		await seedCalls(TODAY, "ride-event", "GET /activities/{id}", 7, 1);
		await seedSeen(TODAY, 12);
		expect(await exported("2026-10-01")).toEqual([
			...day("2026-11-01", 30, 2, 0),
			...day("2026-11-02", 0, 0, 0),
			...day("2026-11-03", 6, 0, 40),
			...day(TODAY, 7, 1, 12),
		]);
	});

	it("starts at the day asked for when that is later", async () => {
		await seedCalls("2026-11-01", "import", "GET /athlete/activities", 30);
		expect(await exported("2026-11-03")).toEqual([
			...day("2026-11-03", 0, 0, 0),
			...day(TODAY, 0, 0, 0),
		]);
	});

	it("gives no day before the 30 days", async () => {
		await seedCalls("2026-10-01", "import", "GET /athlete/activities", 9);
		await seedCalls("2026-10-20", "import", "GET /athlete/activities", 1);
		const entries = await exported("2025-11-04");
		expect(entries[0]).toEqual({
			day: "2026-10-20",
			allowance: "strava_calls",
			count: 1,
		});
		expect(entries).toHaveLength(16 * 3);
	});

	it("gives today live", async () => {
		await seedCalls(TODAY, "connect", "GET /athlete/clubs", 2);
		expect(await exported(TODAY)).toEqual(day(TODAY, 2, 0, 0));
		await seedCalls(TODAY, "connect", "POST /oauth/token", 1);
		expect(await exported(TODAY)).toEqual(day(TODAY, 3, 0, 0));
	});

	it("gives nothing while no call was counted", async () => {
		expect(await exported("2026-10-01")).toEqual([]);
	});

	it("gives nothing by action or endpoint, and no rider", async () => {
		await seedCalls(TODAY, "import", "GET /athlete/activities", 3);
		const res = await handleFetch(
			new Request(`https://rynke.example/admin/usage/export?since=${TODAY}`, {
				headers: { Authorization: `Bearer ${TOKEN}` },
			}),
			ctx,
		);
		const text = await res.text();
		expect(text).not.toContain("import");
		expect(text).not.toContain("/athlete");
		expect(text).not.toContain(ATHLETE_A);
	});
});

describe("parsing an export", () => {
	const body = (days: unknown[]) => ({ team: "europe", days });

	it("accepts the three call allowances", () => {
		expect(parseExport(body(day(TODAY, 120, 3, 425)), "europe")).toEqual(
			day(TODAY, 120, 3, 425),
		);
	});

	it("skips an allowance it doesn't know instead of refusing the export", () => {
		expect(
			parseExport(
				body([
					{ day: TODAY, allowance: "something_later", count: 4 },
					{ day: TODAY, allowance: "strava_calls", count: 120 },
				]),
				"europe",
			),
		).toEqual([{ day: TODAY, allowance: "strava_calls", count: 120 }]);
	});

	it.each([
		[
			"a malformed day",
			{ day: "2026-11-4", allowance: "strava_calls", count: 1 },
		],
		["a negative count", { day: TODAY, allowance: "strava_calls", count: -1 }],
		["a count as text", { day: TODAY, allowance: "strava_calls", count: "1" }],
		[
			"an unknown allowance's bad count",
			{ day: TODAY, allowance: "later", count: 0.5 },
		],
	])("still refuses %s", (_, entry) => {
		expect(parseExport(body([entry]), "europe")).toBeNull();
	});

	it("takes 13 months of the other figures and 30 days of calls", () => {
		const days: Entry[] = [];
		for (let d = TODAY; d >= historyStart(TODAY); d = daysBefore(d, 1)) {
			for (const allowance of [
				"strava_read_daily",
				"strava_all_daily",
				"riders_connected",
			]) {
				days.push({ day: d, allowance, count: 1 });
			}
		}
		for (let i = 0; i < 30; i++)
			days.push(...day(daysBefore(TODAY, i), 1, 0, 1));
		expect(parseExport(body(days), "europe")).toHaveLength(days.length);
	});
});

describe("pulling another team's calls", () => {
	it("stores them with the other counts", async () => {
		vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
			const url = new URL(new Request(input, init).url);
			if (url.origin !== EUROPE) throw new Error(`Unexpected fetch to ${url}`);
			return Response.json(body());
		});
		const body = () => ({ team: "europe", days: day(TODAY, 120, 3, 425) });
		await handleScheduled(
			createScheduledController({
				scheduledTime: new Date(NOW * 1000),
				cron: "58 * * * *",
			}),
			ctx,
		);
		const { results } = await env.DB.prepare(
			`SELECT allowance, used FROM usage_team_daily
			WHERE team = 'europe' AND day = ? ORDER BY allowance`,
		)
			.bind(TODAY)
			.all();
		expect(results).toEqual([
			{ allowance: "strava_calls", used: 120 },
			{ allowance: "strava_held_back", used: 3 },
			{ allowance: "strava_seen", used: 425 },
		]);
	});
});

describe("the daily clean-up", () => {
	it("keeps another team's calls 30 days and its other counts 13 months", async () => {
		const insert = (d: string, allowance: string) =>
			env.DB.prepare(
				`INSERT INTO usage_team_daily (day, allowance, team, used, recorded_at)
				VALUES (?, ?, 'europe', 1, 0)`,
			)
				.bind(d, allowance)
				.run();
		for (const allowance of [...CALL_ALLOWANCES, "riders_connected"]) {
			await insert("2026-10-05", allowance);
			await insert("2026-10-06", allowance);
		}
		await pruneUsage(ctx);
		const { results } = await env.DB.prepare(
			"SELECT day, allowance FROM usage_team_daily ORDER BY allowance, day",
		).all();
		expect(results).toEqual([
			{ day: "2026-10-05", allowance: "riders_connected" },
			{ day: "2026-10-06", allowance: "riders_connected" },
			{ day: "2026-10-06", allowance: "strava_calls" },
			{ day: "2026-10-06", allowance: "strava_held_back" },
			{ day: "2026-10-06", allowance: "strava_seen" },
		]);
	});
});
