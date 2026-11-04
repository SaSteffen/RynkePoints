import { createScheduledController, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { handleFetch, handleScheduled } from "../../src/index";
import { evaluateChange } from "../../src/rynke/apply";
import { teamBadgeNews } from "../../src/work/team-badge-news";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { countRows } from "../support/d1-rows";
import { NOW } from "../support/fixtures";
import { activityRecord } from "../support/rynke";

// The database rows each use reads with a full-season team (feature 030 SC-001,
// SC-003, research R12): this is what keeps the app in D1's free daily limit.
// Local SQLite's counts may differ a little from production's. Synthetic riders.

const ctx = makeCtx();
const FIRST = 700_000;
const RIDERS = 40;
const ORGANISER = FIRST;
const RIDER = FIRST + 7;

/** 40 riders with `rides` rides, 20 runs and 10 swims each, and 20 events. */
async function seedTeam(rides: number): Promise<void> {
	await resetDb();
	const db = env.DB;
	for (let i = 0; i < RIDERS; i++) {
		await seedRider(ctx, {
			athleteId: FIRST + i,
			firstName: `Rider${i}`,
			organiser: i === 0,
		});
	}
	await db
		.prepare("UPDATE riders SET onboarded_at = ?1, organiser_onboarded_at = ?1")
		.bind(NOW)
		.run();
	// Over the same months, whatever their number: two rides a day at 300.
	const perDay = rides / 150;
	await db
		.prepare(
			`INSERT INTO activities (strava_activity_id, athlete_id, sport_type,
				start_date, start_date_local, timezone, distance_m, moving_time_s,
				elevation_gain_m, is_private, refreshed_at)
			WITH RECURSIVE n(x) AS (SELECT 0 UNION ALL SELECT x + 1 FROM n WHERE x < ?1 - 1)
			SELECT r.athlete_id * 1000 + x, r.athlete_id, 'Ride',
				date('2026-01-10', '+' || (x * 17 / (10 * ?2)) || ' day')
					|| (CASE x % 2 WHEN 0 THEN 'T08:00:00Z' ELSE 'T16:00:00Z' END),
				date('2026-01-10', '+' || (x * 17 / (10 * ?2)) || ' day')
					|| (CASE x % 2 WHEN 0 THEN 'T09:00:00Z' ELSE 'T17:00:00Z' END),
				'Europe/Berlin', 40000, 5400, 300, 0, 1
			FROM riders r, n`,
		)
		.bind(rides, perDay)
		.run();
	await db
		.prepare(
			`INSERT INTO runs (strava_activity_id, athlete_id, start_date,
				start_date_local, distance_m, is_private, refreshed_at)
			WITH RECURSIVE n(x) AS (SELECT 0 UNION ALL SELECT x + 1 FROM n WHERE x < 19)
			SELECT r.athlete_id * 2000 + x, r.athlete_id,
				date('2026-02-01', '+' || (x * 9) || ' day') || 'T17:00:00Z',
				date('2026-02-01', '+' || (x * 9) || ' day') || 'T18:00:00Z',
				8000, 0, 1
			FROM riders r, n`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO swims (strava_activity_id, athlete_id, start_date,
				start_date_local, distance_m, is_private, refreshed_at)
			WITH RECURSIVE n(x) AS (SELECT 0 UNION ALL SELECT x + 1 FROM n WHERE x < 9)
			SELECT r.athlete_id * 3000 + x, r.athlete_id,
				date('2026-02-03', '+' || (x * 20) || ' day') || 'T17:00:00Z',
				date('2026-02-03', '+' || (x * 20) || ' day') || 'T18:00:00Z',
				1500, 0, 1
			FROM riders r, n`,
		)
		.run();
	for (let e = 0; e < 20; e++) {
		const month = String(2 + (e % 8)).padStart(2, "0");
		const eventId = await db
			.prepare(
				"INSERT INTO team_events (kind, event_date, name) VALUES ('team_training', ?, NULL) RETURNING event_id",
			)
			.bind(`2026-${month}-${String(5 + e).padStart(2, "0")}`)
			.first<number>("event_id");
		await db
			.prepare(
				"INSERT INTO attendances (event_id, athlete_id) SELECT ?, athlete_id FROM riders WHERE athlete_id % 4 <> 0",
			)
			.bind(eventId)
			.run();
	}
	for (let i = 0; i < RIDERS; i++) {
		await evaluateChange(ctx, FIRST + i, { kind: "none" });
	}
}

interface Uses {
	start: number;
	team: number;
	badges: number;
	organiserRiders: number;
	newRide: number;
	dailyJob: number;
	/** The rider's own badges, whose rows the Badges page also reads. */
	ownBadges: number;
}

/** The rows of a page's second view, once a first has marked what it marks. */
async function pageRows(path: string, athleteId: number): Promise<number> {
	const { ctx: counted, counter } = countRows(ctx);
	const cookies = await sessionCookie(ctx, athleteId);
	await (await handleFetch(request(path, { cookies }), ctx)).arrayBuffer();
	await Promise.all(ctx.pending);
	counter.reset();
	const response = await handleFetch(request(path, { cookies }), counted);
	expect(response.status).toBeLessThan(400);
	await response.arrayBuffer();
	await Promise.all(ctx.pending);
	return counter.read();
}

async function measure(): Promise<Uses> {
	// Badges first: once they're revealed, the start page works out the team's.
	const badges = await pageRows("/me/badges", RIDER);
	const uses = {
		start: await pageRows("/", RIDER),
		team: await pageRows("/team", RIDER),
		badges,
		organiserRiders: await pageRows("/organiser/riders", ORGANISER),
	};
	const ownBadges = await env.DB.prepare(
		"SELECT count(*) AS n FROM rider_badges WHERE athlete_id = ?",
	)
		.bind(RIDER)
		.first<number>("n");
	const { ctx: counted, counter } = countRows(ctx);
	counter.reset();
	await evaluateChange(counted, RIDER, {
		kind: "upsert",
		records: [
			activityRecord(999_000_111, {
				athlete_id: RIDER,
				start_date: "2026-09-29T08:00:00Z",
				start_date_local: "2026-09-29T09:00:00Z",
			}),
		],
	});
	await teamBadgeNews(counted, []);
	await Promise.all(ctx.pending);
	const newRide = counter.read();
	counter.reset();
	await handleScheduled(
		createScheduledController({
			scheduledTime: new Date(NOW * 1000),
			cron: "17 3 * * *",
		}),
		counted,
	);
	await Promise.all(ctx.pending);
	return {
		...uses,
		newRide,
		dailyJob: counter.read(),
		ownBadges: ownBadges ?? 0,
	};
}

describe("rows read with a full-season team (feature 030)", () => {
	it("stays within the limits at 150 rides, and hardly grows at 300", async () => {
		await seedTeam(150);
		const season = await measure();
		expect(season.start).toBeLessThanOrEqual(400);
		expect(season.team).toBeLessThanOrEqual(500);
		expect(season.badges).toBeLessThanOrEqual(1500);
		expect(season.organiserRiders).toBeLessThanOrEqual(1000);
		expect(season.newRide).toBeLessThanOrEqual(1500);
		// The usage estimate in the spec, against D1's 5 million a day (SC-002).
		const daily =
			80 * (season.start + season.team) +
			40 * season.badges +
			10 * season.organiserRiders +
			24 * season.newRide +
			season.dailyJob;
		expect(daily).toBeLessThan(0.05 * 5_000_000);

		await seedTeam(300);
		const doubled = await measure();
		expect(doubled.start).toBeLessThan(season.start * 1.1);
		expect(doubled.team).toBeLessThan(season.team * 1.1);
		expect(doubled.organiserRiders).toBeLessThan(season.organiserRiders * 1.1);
		// These two read the one rider's own rides, and must (research R13).
		// More rides also earn the rider more badges: three rows each.
		expect(doubled.badges - season.badges).toBeLessThanOrEqual(
			5 * 150 + 3 * (doubled.ownBadges - season.ownBadges),
		);
		expect(doubled.newRide - season.newRide).toBeLessThanOrEqual(5 * 150);
	}, 300_000);

	it("costs no more than before while no rider has a row (research R11)", async () => {
		await seedTeam(150);
		await env.DB.prepare("DELETE FROM rider_summaries").run();
		// Once the rider's badges are revealed, or the start page would answer
		// without working out the team's.
		const badges = await pageRows("/me/badges", RIDER);
		const start = await pageRows("/", RIDER);
		const team = await pageRows("/team", RIDER);
		const organiserRiders = await pageRows("/organiser/riders", ORGANISER);
		// The spec's "Today" column, measured before this feature.
		expect(start).toBeLessThanOrEqual(45_396);
		expect(team).toBeLessThanOrEqual(20_793);
		expect(badges).toBeLessThanOrEqual(46_280);
		expect(organiserRiders).toBeLessThanOrEqual(21_152);
	}, 300_000);
});
