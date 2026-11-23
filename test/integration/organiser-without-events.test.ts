import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { europe } from "../../teams/europe/team";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { seedBalance } from "../support/rider-view";
import { insertEvent, reportRaw, storedCorrections } from "../support/rynke";

// The routes, the Orga switch, the team overview and the corrections form of a
// team without Team Rynke and events, next to Hamburg's (feature 039 US4,
// contracts/team-surfaces.md "Organiser pages"). Both teams run on the same
// database and clock; only the team data differs. Synthetic riders only.

const hamburg = makeCtx();
const other = makeCtx({ team: europe });
const { en } = CATALOGS;

const ORGANISER = "930001";
const PAULA = "930002";
const JONAS = "930003";

/** The page's text for a catalog entry. */
const text = (id: keyof typeof en) => escapeHtml(en[id] as string);

async function get(ctx: typeof hamburg, path: string, by = ORGANISER) {
	const response = await handleFetch(
		request(path, {
			cookies: await sessionCookie(ctx, by),
			acceptLanguage: "en",
		}),
		ctx,
	);
	return { response, html: await response.text() };
}

async function post(
	ctx: typeof hamburg,
	path: string,
	form: Record<string, string> = {},
	by = ORGANISER,
) {
	return handleFetch(
		request(path, { form, cookies: await sessionCookie(ctx, by) }),
		ctx,
	);
}

/** What each Corrections cell holds of the Training and Team coin pair. */
function coinPairs(page: string): string[] {
	return [
		...page.matchAll(
			/<span class="coin-pair" aria-hidden="true">(.*?)<\/span><span class="visually-hidden">/g,
		),
	].map((m) => m[1] ?? "");
}

beforeEach(async () => {
	await resetDb();
	await seedRider(hamburg, {
		athleteId: ORGANISER,
		firstName: "Olga",
		organiser: true,
	});
	await seedRider(hamburg, { athleteId: PAULA, firstName: "Paula" });
	await seedRider(hamburg, { athleteId: JONAS, firstName: "Jonas" });
	await seedBalance(PAULA, {
		distanceRynke: 260,
		elevationRynke: 30,
		trainingRynke: 300,
		trainingMissing: 0,
		teamRynke: 0,
		teamMissing: 0,
		trainingWithoutVirtual: 250,
		virtualShareMissing: 0,
		qualified: true,
	});
	await seedBalance(JONAS, {
		distanceRynke: 90,
		trainingRynke: 100,
		trainingMissing: 150,
		// What a team with Team Rynke would show; a team without it never does.
		teamRynke: 7,
		teamMissing: 18,
		trainingWithoutVirtual: 90,
		virtualShareMissing: 77,
	});
});

describe("the routes of events", () => {
	const GETS = [
		"/events",
		"/organiser/events",
		"/organiser/events/1",
		"/organiser/requests",
		"/organiser/requests/undo",
	];
	const POSTS = [
		"/events/1/report",
		"/events/1/report/delete",
		"/organiser/events",
		"/organiser/events/1",
		"/organiser/events/1/delete",
		"/organiser/events/1/attendance",
		"/organiser/events/1/self",
		"/organiser/requests",
		"/organiser/requests/undo",
	];

	it("answers 404 for a team without events, GET and POST", async () => {
		for (const path of GETS) {
			expect((await get(other, path)).response.status, path).toBe(404);
			expect((await get(other, path, PAULA)).response.status, path).toBe(404);
		}
		for (const path of POSTS) {
			expect((await post(other, path)).status, path).toBe(404);
			expect((await post(other, path, {}, PAULA)).status, path).toBe(404);
		}
	});

	it("keeps them for a team with events", async () => {
		expect((await get(hamburg, "/organiser")).response.status).toBe(200);
		expect((await get(hamburg, "/events", PAULA)).response.status).toBe(200);
		expect((await post(hamburg, "/organiser/requests")).status).not.toBe(404);
	});

	it("sends /organiser to the riders for a team without events only", async () => {
		const sent = (await get(other, "/organiser")).response;
		expect(sent.status).toBe(302);
		expect(sent.headers.get("location")).toBe("/organiser/riders");
		expect((await get(other, "/organiser/riders")).response.status).toBe(200);
		expect(
			(await get(hamburg, "/organiser")).response.headers.get("location"),
		).toBeNull();
	});
});

describe("Orga's switch and its open-request count", () => {
	beforeEach(async () => {
		const event = await insertEvent("team_training", "2026-10-01");
		await reportRaw(event, PAULA);
	});

	it("has the switch and the count with events", async () => {
		const { html } = await get(hamburg, "/organiser/riders");
		expect(html).toContain('<nav class="organiser-switch"');
		expect(html).toContain(
			'<span class="count-badge" aria-hidden="true">1</span>',
		);
	});

	it("has neither without events", async () => {
		for (const path of ["/organiser/riders", "/team", "/me/settings"]) {
			const { html } = await get(other, path);
			expect(html, path).not.toContain("organiser-switch");
			expect(html, path).not.toContain("count-badge");
			expect(html, path).not.toContain('href="/organiser"');
			expect(html, path).not.toContain('href="/events"');
		}
	});
});

describe("the team overview", () => {
	it("shows each rider's Team part with Team Rynke", async () => {
		const { html } = await get(hamburg, "/organiser/riders");
		expect(html).toContain("amount-team");
		expect(html).toContain("bar-team");
		expect(html).toContain('class="team-hint"');
		expect(html).toContain(text("organiser.overview.qualifiedHint"));
		expect(coinPairs(html).every((i) => i.split("<span>").length === 3)).toBe(
			true,
		);
	});

	it("leaves out Team amounts, missing, pace and event breakdown without it", async () => {
		const { response, html } = await get(other, "/organiser/riders");
		expect(response.status).toBe(200);
		expect(html).toContain("Jonas");
		for (const part of [
			"amount-team",
			"bar-team",
			"Team to go",
			"Team behind pace",
			"Team Rynke",
			"Team training",
			"Technique training",
		]) {
			expect(html, part).not.toContain(part);
		}
		// The corrections pair has Training's coin alone, read out without Team.
		const pairs = coinPairs(html);
		expect(pairs.length).toBeGreaterThan(0);
		expect(pairs.every((inner) => inner.split("<span>").length === 2)).toBe(
			true,
		);
		expect(html).not.toContain(", 0 Team");
		// The pace tick explained with Training alone.
		expect(html).toMatch(
			/<p class="team-hint" id="tour-pace">The tick on each bar marks the even pace to the deadline: today [^<]* Training\.<\/p>/,
		);
		// No open reports without events.
		expect(html).not.toContain("tile-requests");
		expect(html).not.toContain("requests-cell");
		// The qualified hint without Team.
		expect(html).not.toContain(text("organiser.overview.qualifiedHint"));
		expect(html).toContain(text("organiser.overview.qualifiedHint.noEvents"));
	});

	it("still lists Training and the outdoor reason without Team Rynke", async () => {
		const { html } = await get(other, "/organiser/riders");
		expect(html).toContain("amount-training");
		expect(html).toContain("bar-training");
		expect(html).toContain("outdoor Training to go");
	});
});

describe("the corrections form", () => {
	const field = (name: string) => `name="${name}"`;

	it("has the Training and Team fields with Team Rynke", async () => {
		const { html } = await get(hamburg, `/organiser/riders/${JONAS}`);
		expect(html).toContain(field("training"));
		expect(html).toContain(field("team"));
	});

	it("has the Training field only without it", async () => {
		const { response, html } = await get(other, `/organiser/riders/${JONAS}`);
		expect(response.status).toBe(200);
		expect(html).toContain(field("training"));
		expect(html).not.toContain(field("team"));
		expect(html).toContain(field("reason"));
		expect(html).toContain(field("date"));
	});

	const FORM = { reason: "Ride lost", date: "2026-10-06" };

	it("takes a Training correction without it", async () => {
		const res = await post(other, `/organiser/riders/${JONAS}/corrections`, {
			...FORM,
			training: "10",
		});
		expect(res.status).toBe(303);
		expect(res.headers.get("location")).toBe(
			`/organiser/riders/${JONAS}?done=added`,
		);
		expect(await storedCorrections(JONAS)).toHaveLength(1);
	});

	it("refuses a Team amount without it, with the invalid amount notice", async () => {
		for (const form of [
			{ ...FORM, training: "10", team: "5" },
			{ ...FORM, team: "-3" },
		]) {
			const res = await post(
				other,
				`/organiser/riders/${JONAS}/corrections`,
				form,
			);
			expect(res.status).toBe(303);
			expect(res.headers.get("location")).toBe(
				`/organiser/riders/${JONAS}?error=invalid_amount`,
			);
		}
		expect(await storedCorrections(JONAS)).toHaveLength(0);
		const { html } = await get(
			other,
			`/organiser/riders/${JONAS}?error=invalid_amount`,
		);
		expect(html).toContain(text("organiser.error.invalid_amount"));
	});

	it("still takes a Team amount with Team Rynke", async () => {
		const res = await post(hamburg, `/organiser/riders/${JONAS}/corrections`, {
			...FORM,
			team: "5",
		});
		expect(res.status).toBe(303);
		expect(res.headers.get("location")).toBe(
			`/organiser/riders/${JONAS}?done=added`,
		);
	});
});

describe("the tours' wording", () => {
	const hint = (page: string) =>
		page.match(/<aside class="tour"[\s\S]*?<\/aside>/)?.[0] ?? "";

	beforeEach(() => seedBalance(ORGANISER, { trainingRynke: 100 }));

	it("names Team Rynke and events with them", async () => {
		const organiser = await get(
			hamburg,
			"/organiser/riders?tour=organiser&step=1",
		);
		expect(hint(organiser.html)).toContain("Training and Team Rynke");
		const outdoor = await get(hamburg, "/me?tour=rider&step=6", PAULA);
		expect(hint(outdoor.html)).toContain("team events included");
	});

	it("leaves them out without them", async () => {
		const organiser = await get(
			other,
			"/organiser/riders?tour=organiser&step=1",
		);
		expect(hint(organiser.html)).toContain("with their Training Rynke");
		expect(hint(organiser.html)).not.toContain("Team Rynke");
		// Europe's rider tour has no Team Rynke step: the outdoor one is fifth.
		const outdoor = await get(other, "/me?tour=rider&step=5", PAULA);
		expect(hint(outdoor.html)).toContain("riding outside.");
		expect(hint(outdoor.html)).not.toContain("team events");
	});
});
