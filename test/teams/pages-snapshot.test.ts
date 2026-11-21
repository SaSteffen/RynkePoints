import { env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readOnly } from "../../album/guard";
import { loadAlbum } from "../../album/load";
import { renderAlbum } from "../../album/render";
import { SAMPLE_RIDERS } from "../../dev/fake-strava/samples.hamburg";
import { APP_VERSION } from "../../src/changelog";
import { TEAMS } from "../../src/teams";
import { NOW } from "../support/fixtures";
import PINNED_VARS from "../support/pinned.json";
import {
	endSampleSeason,
	getPage,
	pageText,
	riderCookie,
	rows,
	seedSampleSeason,
} from "../support/sample-season";

// The founding team's pages that Team Europe's own rules touch (feature 039
// research R11, SC-001), pinned on the code before that change: with the
// sample season of season-snapshot.test.ts, the start, privacy and consent
// texts, the event and Orga pages, Settings with the rules, every tour step
// and the season album, each in German and English. season-snapshot pins
// `/me`, `/me/rides`, `/me/badges` and `/team` in German; here they are added
// in English for one rider. None of it may change for the founding team, so
// this snapshot is never updated for that feature; a deliberate change of a
// text updates it with `vitest -u`.

const LANGS = ["de", "en"] as const;

/** A rider who isn't an organiser, with team events and many rides. */
const RIDER = 990007;
/** An organiser. */
const ORGANISER = 990011;
/** A rider on the Tour de Paris days, for the album's events page. */
const TOUR_RIDER = 990003;
const TODAY = "2026-10-06";

function heldBack(): number {
	const rider = SAMPLE_RIDERS.find((r) => r.consentVersion !== undefined);
	if (!rider) throw new Error("no sample rider is held back on consent");
	return rider.athleteId;
}

/** The page's text, without the app's version that every release raises. */
async function pinnedText(markup: string): Promise<string> {
	return (await pageText(markup)).replaceAll(APP_VERSION, "x.y.z");
}

async function pinPage(
	path: string,
	lang: string,
	cookie?: string,
): Promise<void> {
	const { status, markup } = await getPage(path, lang, cookie);
	expect
		.soft(`${status}\n${await pinnedText(markup)}\n`)
		.toMatchSnapshot(`${path} ${lang}`);
}

/** The tour card's way on, or `null` on its last step. */
function nextStep(markup: string): string | null {
	const card = markup.match(/<aside class="tour"[\s\S]*?<\/aside>/)?.[0];
	const href = card?.match(/<a class="button" href="([^"]*)"/)?.[1];
	return href === undefined ? null : href.replaceAll("&amp;", "&");
}

/** Every step of a tour, followed from `first` as a rider would. */
async function pinTour(
	name: string,
	first: string,
	lang: string,
	cookie: string,
): Promise<void> {
	let path: string | null = first;
	for (let step = 1; path !== null; step++) {
		if (step > 30) throw new Error(`the ${name} tour doesn't end`);
		const { status, markup } = await getPage(path, lang, cookie);
		expect
			.soft(`${status}\n${await pinnedText(markup)}\n`)
			.toMatchSnapshot(`${name} tour step ${step} ${path} ${lang}`);
		expect(markup).toContain('<aside class="tour"');
		path = nextStep(markup);
	}
}

async function pastEvent(kind: string): Promise<number> {
	const [row] = (await rows(
		"SELECT event_id FROM team_events WHERE kind = ? AND event_date < ? ORDER BY event_date DESC, event_id LIMIT 1",
		kind,
		TODAY,
	)) as { event_id: number }[];
	if (!row) throw new Error(`no past ${kind} in the sample season`);
	return row.event_id;
}

describe.skipIf(env.TEAM_ID !== TEAMS[0]?.id)(
	"the founding team's pages (feature 039 SC-001)",
	() => {
		beforeAll(async () => {
			await seedSampleSeason();
		}, 120_000);

		afterAll(endSampleSeason);

		it("pins the start, privacy and consent pages", async () => {
			const held = await riderCookie(heldBack());
			for (const lang of LANGS) {
				await pinPage("/", lang);
				await pinPage("/privacy", lang);
				await pinPage("/me", lang, held);
			}
		}, 120_000);

		it("pins a rider's pages", async () => {
			const cookie = await riderCookie(RIDER);
			for (const lang of LANGS) {
				for (const path of [
					"/me",
					"/me/rides",
					"/me/badges",
					"/team",
					"/team?kind=team",
					"/events",
					"/me/settings",
				]) {
					await pinPage(path, lang, cookie);
				}
			}
		}, 120_000);

		it("pins the organiser's pages", async () => {
			const cookie = await riderCookie(ORGANISER);
			const training = await pastEvent("team_training");
			const tourDay = await pastEvent("tour_de_paris");
			for (const lang of LANGS) {
				for (const path of [
					"/organiser",
					"/organiser/riders",
					"/organiser/riders?view=graphs",
					`/organiser/events/${training}`,
					`/organiser/events/${tourDay}`,
					`/organiser/riders/${RIDER}`,
					"/me",
					"/team",
				]) {
					await pinPage(path, lang, cookie);
				}
			}
		}, 120_000);

		it("pins every tour step", async () => {
			const rider = await riderCookie(RIDER);
			const organiser = await riderCookie(ORGANISER);
			for (const lang of LANGS) {
				await pinTour("rider", "/team?tour=rider&step=1", lang, rider);
				await pinTour(
					"organiser",
					"/organiser/riders?tour=organiser&step=1",
					lang,
					organiser,
				);
			}
		}, 120_000);

		it("pins the season album", async () => {
			const albumEnv = { ...env, ...PINNED_VARS };
			for (const athleteId of [RIDER, TOUR_RIDER]) {
				const rider = SAMPLE_RIDERS.find((r) => r.athleteId === athleteId);
				if (!rider) throw new Error(`no sample rider ${athleteId}`);
				const data = await loadAlbum(
					readOnly(env.DB),
					albumEnv,
					{ athleteId, firstName: rider.firstName },
					TODAY,
					NOW,
				);
				for (const lang of LANGS) {
					expect
						.soft(`${await pageText(renderAlbum({ ...data, locale: lang }))}\n`)
						.toMatchSnapshot(`album ${athleteId} ${lang}`);
				}
			}
		}, 120_000);
	},
);
