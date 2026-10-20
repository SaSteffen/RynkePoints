import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
	advanceTeamBadgeNoticesStatement,
	seedTeamBadgeNoticesStatement,
} from "../../src/db/badges";
import { CATALOGS } from "../../src/i18n/catalogs";
import { BADGE_NAMES } from "../../src/i18n/messages/badges.de";
import { handleFetch } from "../../src/index";
import { teamEventChange } from "../../src/rynke/apply";
import { countingWindow } from "../../src/rynke/rules";
import { teamBadgeNews } from "../../src/work/team-badge-news";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A, NOW } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import { seedBalance } from "../support/rider-view";
import { attendRaw, insertEvent } from "../support/rynke";

// Team badges notify the listed riders they are new to, once per season
// (issue #125, amending feature 013 FR-032). Synthetic riders and events only.

const TEAM = [ATHLETE_A, 900011, 900012, 900013, 900014];
const { seasonStart } = countingWindow(env);
// NOW is 6 October 2026, the day every seeded rider connected.
const TODAY = "2026-10-06";

let ctx: TestCtx;

async function announced(): Promise<string[] | null> {
	const ids = await env.DB.prepare(
		"SELECT badge_ids FROM team_badge_notices WHERE season_start = ?",
	)
		.bind(seasonStart)
		.first<string>("badge_ids");
	return ids === null ? null : (JSON.parse(ids) as string[]);
}

async function badgeRise(athleteId: number): Promise<string[] | null> {
	const ids = await env.DB.prepare(
		"SELECT badge_ids FROM badge_rises WHERE athlete_id = ?",
	)
		.bind(athleteId)
		.first<string>("badge_ids");
	return ids === null ? null : (JSON.parse(ids) as string[]);
}

/** The riders the change queued a push for, sorted. */
function notified(): number[] {
	return [
		...new Set(
			ctx.queue.sent
				.map((m) => m.body)
				.filter((b) => b.kind === "send-notification")
				.map((b) => b.athleteId),
		),
	].sort((a, b) => a - b);
}

/** Five riders at one team training: the team's first Big Training badge. */
async function bigTraining(date: string) {
	const eventId = await insertEvent("team_training", date);
	await teamEventChange(ctx, {
		kind: "add-attendance",
		eventId,
		athleteIds: TEAM,
	});
	return eventId;
}

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
	for (const [i, athleteId] of TEAM.entries()) {
		await seedRider(ctx, { athleteId });
		await seedSubscription(athleteId, pushEndpoint(i + 1));
	}
});

describe("teamBadgeNews", () => {
	it("stores what the team has on the season's first check, announcing nothing", async () => {
		await attendRaw(await insertEvent("team_training", TODAY), TEAM);
		expect(await teamBadgeNews(ctx, [])).toEqual([]);
		expect(await announced()).toEqual(["big-training-5"]);
		expect(await badgeRise(ATHLETE_A)).toBeNull();
	});

	it("notifies every listed rider of a new team badge, with their own news", async () => {
		await teamBadgeNews(ctx, []);
		await bigTraining(TODAY);
		expect(await announced()).toEqual(["big-training-5"]);
		expect(notified()).toEqual([...TEAM].sort((a, b) => a - b));
		// The same change's personal badges stay in the rise.
		expect(await badgeRise(ATHLETE_A)).toEqual(
			expect.arrayContaining(["big-training-5", "team-events-1"]),
		);
	});

	it("tells only the rider of their new Tour de Paris badge, no team notice (021 FR-012)", async () => {
		await teamBadgeNews(ctx, []);
		const eventId = await insertEvent(
			"tour_de_paris",
			TODAY,
			"Hamburg – Bremen",
		);
		await teamEventChange(ctx, {
			kind: "add-attendance",
			eventId,
			athleteIds: [ATHLETE_A],
		});
		expect(await announced()).not.toContain("tour-de-paris-1");
		expect(notified()).toEqual([ATHLETE_A]);
		expect(await badgeRise(ATHLETE_A)).toContain("tour-de-paris-1");
		expect(await badgeRise(TEAM[1] as number)).toBeNull();
	});

	it("announces a team badge once, even when taken back and earned again", async () => {
		await teamBadgeNews(ctx, []);
		const eventId = await bigTraining(TODAY);
		await teamEventChange(ctx, {
			kind: "remove-attendance",
			eventId,
			athleteIds: [ATHLETE_A],
		});
		ctx.queue.sent.length = 0;
		await teamEventChange(ctx, {
			kind: "add-attendance",
			eventId,
			athleteIds: [ATHLETE_A],
		});
		// Only the rider's own badges, earned again, notify.
		expect(notified()).toEqual([ATHLETE_A]);
		expect(await badgeRise(ATHLETE_A)).not.toContain("big-training-5");
	});

	it("leaves out riders who connected after the badge's date", async () => {
		await teamBadgeNews(ctx, []);
		await bigTraining("2026-09-12");
		expect(await announced()).toEqual(["big-training-5"]);
		for (const athleteId of TEAM) {
			expect(await badgeRise(athleteId)).not.toContain("big-training-5");
		}
	});

	it("leaves out riders who don't share their data, who don't count either", async () => {
		const outsider = 900099;
		await seedRider(ctx, { athleteId: outsider, consentVersion: null });
		await seedSubscription(outsider, pushEndpoint(99));
		await teamBadgeNews(ctx, []);
		await bigTraining(TODAY);
		expect(notified()).not.toContain(outsider);
		expect(await badgeRise(outsider)).toBeNull();
	});

	it("announces a new season's first badges, once an earlier season was checked", async () => {
		await seedTeamBadgeNoticesStatement(env.DB, "2025-01-01", [], NOW).run();
		await bigTraining(TODAY);
		expect(await announced()).toEqual(["big-training-5"]);
		for (const athleteId of TEAM) {
			expect(await badgeRise(athleteId)).toContain("big-training-5");
		}
	});

	it("replaces an earlier change's rise, and joins the same change's", async () => {
		await teamBadgeNews(ctx, []);
		for (const athleteId of [ATHLETE_A, 900011]) {
			await env.DB.prepare(
				"INSERT INTO badge_rises (athlete_id, badge_ids, risen_at) VALUES (?, ?, ?)",
			)
				.bind(athleteId, JSON.stringify(["distance-500"]), NOW - 30)
				.run();
		}
		await attendRaw(await insertEvent("team_training", TODAY), TEAM);

		expect(await teamBadgeNews(ctx, [ATHLETE_A])).toEqual(
			[...TEAM].sort((a, b) => a - b),
		);
		expect(await badgeRise(ATHLETE_A)).toEqual(
			expect.arrayContaining(["distance-500", "big-training-5"]),
		);
		expect(await badgeRise(900011)).toEqual(["big-training-5"]);
	});

	it("announces nothing when another check got there first", async () => {
		await teamBadgeNews(ctx, []);
		await attendRaw(await insertEvent("team_training", TODAY), TEAM);
		await advanceTeamBadgeNoticesStatement(
			env.DB,
			seasonStart,
			"[]",
			["big-training-5"],
			NOW,
		).run();
		expect(await teamBadgeNews(ctx, [])).toEqual([]);
		expect(await badgeRise(ATHLETE_A)).toBeNull();
	});
});

describe("GET /me/notification-text with a team badge rise", () => {
	async function riderText() {
		const res = await handleFetch(
			request("/me/notification-text?lang=de", {
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(res.status).toBe(200);
		return (await res.json()) as { body: string; url: string };
	}

	async function seedBadgeRise(ids: string[]) {
		await env.DB.prepare(
			"INSERT INTO badge_rises (athlete_id, badge_ids, risen_at) VALUES (?, ?, ?)",
		)
			.bind(ATHLETE_A, JSON.stringify(ids), NOW)
			.run();
	}

	beforeEach(async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 30 });
	});

	it("names one team badge as the team's and opens the badges page", async () => {
		await seedBadgeRise(["big-training-5"]);
		expect(await riderText()).toEqual({
			title: CATALOGS.de["app.name"],
			body: CATALOGS.de["notification.teamBadge"].replace(
				"{name}",
				BADGE_NAMES["big-training-5"] ?? "",
			),
			url: "/me/badges",
		});
	});

	it("counts several team badges", async () => {
		await seedBadgeRise(["big-training-5", "attendances-25"]);
		expect((await riderText()).body).toBe(
			CATALOGS.de["notification.teamBadges"].replace("{n}", "2"),
		);
	});

	it("counts personal and team badges together and opens the badges page", async () => {
		await seedBadgeRise(["team-events-1", "big-training-5"]);
		const text = await riderText();
		expect(text.body).toBe(
			CATALOGS.de["notification.badges"].replace("{n}", "2"),
		);
		expect(text.url).toBe("/me/badges");
	});
});
