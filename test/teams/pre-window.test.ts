import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { badgeWindow } from "../../src/badges/evaluate";
import { evaluateTeamBadges } from "../../src/badges/team";
import { upsertActivity } from "../../src/db/activities";
import { readTeamBadgeSums } from "../../src/db/team";
import { CATALOGS } from "../../src/i18n/catalogs";
import { evaluateChange } from "../../src/rynke/apply";
import { countingWindow, currentRules } from "../../src/rynke/rules";
import type { ActivityRecord } from "../../src/strava/activity";
import { teamFor } from "../../src/teams";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { rideCards, riderPage } from "../support/rider-view";
import { activityRecord, balanceRow } from "../support/rynke";

// Pre-window rides (feature 040 US3, US4): a team whose window opens after its
// season start lists a ride from before the opening orange, with its reason
// open, and counts it for no Rynke: a rider with only such rides has the same
// Rynke, gauges, pace and progress as a rider with no rides at all (FR-009,
// FR-010). The badges about rides count it as any ride (FR-014), the Training
// Rynke badges don't (FR-015). Hamburg's window opens on its season start, so
// it has no such day.

const team = teamFor(env);
const window = countingWindow(env);
const TODAY = "2026-12-28";
/** 28 December 2026, in the season and before Europe's window opens. */
const ctx = makeCtx({ now: Date.parse(`${TODAY}T12:00:00Z`) / 1000 });
const { de } = CATALOGS;

/** A 60 km ride with 450 m, meeting every rule but the window. */
function ride(
	id: number,
	date: string,
	overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
	return activityRecord(id, {
		start_date: `${date}T07:00:00Z`,
		start_date_local: `${date}T08:00:00Z`,
		distance_m: 60000,
		moving_time_s: 9000,
		elapsed_time_s: 9000,
		elevation_gain_m: 450,
		...overrides,
	});
}

/**
 * The page without its ride list, the only part about the rides themselves,
 * and the hero coin, which differs from rider to rider.
 */
function withoutRides(page: string): string {
	return page
		.replace(/<section id="rides"[\s\S]*?<\/section>/, "")
		.replace(/<img class="coin-art coin coin-hero"[^>]*>/, "");
}

async function earned(athleteId: number): Promise<string[]> {
	const { results } = await env.DB.prepare(
		"SELECT badge_id FROM rider_badges WHERE athlete_id = ? ORDER BY badge_id",
	)
		.bind(athleteId)
		.all<{ badge_id: string }>();
	return results.map((row) => row.badge_id);
}

describe.runIf(window.windowStart > window.seasonStart)(
	`${team.id}'s pre-window rides (040 US3, US4)`,
	() => {
		beforeEach(async () => {
			await resetDb();
			// One first name, so the two pages differ only by their rides.
			await seedRider(ctx, { athleteId: ATHLETE_A, firstName: "Kim" });
			await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Kim" });
			await upsertActivity(env.DB, ride(1, "2026-09-15"));
			await upsertActivity(env.DB, ride(2, "2026-11-15"));
			await upsertActivity(env.DB, ride(3, "2026-12-24"));
			// Too short as well: a plain ride that doesn't count (FR-013).
			await upsertActivity(
				env.DB,
				ride(4, "2026-12-25", {
					distance_m: 12000,
					moving_time_s: 2400,
					elapsed_time_s: 2400,
				}),
			);
			await evaluateChange(ctx, ATHLETE_A, { kind: "none" });
			await evaluateChange(ctx, ATHLETE_B, { kind: "none" });
		});

		it("adds nothing to the rider's Rynke (FR-009)", async () => {
			const own = await balanceRow(ATHLETE_A);
			const none = await balanceRow(ATHLETE_B);
			expect(none).not.toBeNull();
			expect(own).toEqual({
				...none,
				athlete_id: ATHLETE_A,
				computed_at: own?.computed_at,
			});
		});

		it("stays out of the team's weeks and the ride figures (FR-010)", async () => {
			const row = await env.DB.prepare(
				"SELECT weeks, rides, days FROM rider_summaries WHERE athlete_id = ?",
			)
				.bind(ATHLETE_A)
				.first<{ weeks: string; rides: string; days: string }>();
			expect(row?.weeks).toBe("[]");
			expect(row?.rides).toBe("[]");
			// The badges' days have them.
			expect(JSON.parse(row?.days ?? "[]")).toEqual([
				["2026-09-15", 60000, 0, 4500],
				["2026-11-15", 60000, 0, 4500],
				["2026-12-24", 60000, 0, 4500],
			]);
		});

		it("stores exactly the reasons the badge queries look for (research R4)", async () => {
			const { results } = await env.DB.prepare(
				"SELECT strava_activity_id, reasons FROM ride_results WHERE athlete_id = ? ORDER BY 1",
			)
				.bind(ATHLETE_A)
				.all<{ strava_activity_id: number; reasons: string }>();
			expect(results.map((r) => r.reasons)).toEqual([
				'["before_window"]',
				'["before_window"]',
				'["before_window"]',
				'["before_window","too_short"]',
			]);
		});

		it("shows the same Overview as a rider without rides (FR-010)", async () => {
			const [own, none] = await Promise.all([
				riderPage(ctx, ATHLETE_A, "/me", "de"),
				riderPage(ctx, ATHLETE_B, "/me", "de"),
			]);
			expect(own.status).toBe(200);
			expect(withoutRides(own.html)).toBe(withoutRides(none.html));
		});

		it("lists them orange, with dashes and the reason open", async () => {
			const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides", "de");
			const cards = rideCards(html);
			expect(cards.map((card) => card.status)).toEqual([
				"ride-not-counting",
				"ride-not-yet",
				"ride-not-yet",
				"ride-not-yet",
			]);
			const newest = cards[1];
			expect(newest?.cells).toEqual([
				"24.12.2026",
				"60,0 km",
				de["rynke.ride.notYet"],
				"–",
				"–",
			]);
			expect(newest?.open).toBe(true);
			expect(newest?.why).toContain(
				de["rynke.reason.before_window"].replace(
					"{date}",
					window.windowStart.split("-").reverse().join("."),
				),
			);
		});

		it("counts them for the badges about rides, not for Training Rynke (FR-014, FR-015)", async () => {
			const ids = await earned(ATHLETE_A);
			for (const badge of [
				"distance-100",
				"elevation-1000",
				"winter-november-1",
				"winter-december-1",
				"surprise-christmas-eve",
			]) {
				expect(ids, badge).toContain(badge);
			}
			// The short ride on Christmas Day counts for nothing.
			expect(ids).not.toContain("surprise-christmas");
			expect(ids.filter((id) => id.startsWith("training-rynke"))).toEqual([]);
			expect(await earned(ATHLETE_B)).toEqual([]);
		});

		it("counts them for the team's badges, not for its Training Rynke", async () => {
			const values = async () => {
				const { progress } = evaluateTeamBadges(
					await readTeamBadgeSums(env.DB),
					currentRules(team.rules),
					badgeWindow(window, TODAY),
				);
				const value = (category: string) =>
					progress.find((p) => p.category === category)?.value;
				return [
					value("team_distance"),
					value("team_elevation"),
					value("team_training_rynke"),
				];
			};
			expect(await values()).toEqual([180, 1350, 0]);
			// The same added up from the rides, for riders without a summary.
			await env.DB.prepare("DELETE FROM rider_summaries").run();
			expect(await values()).toEqual([180, 1350, 0]);
		});
	},
);
