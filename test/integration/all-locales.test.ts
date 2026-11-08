import { beforeEach, describe, expect, it } from "vitest";
import { CATALOGS, type Locale } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { seedBalance, seedRides } from "../support/rider-view";

// Every shipped locale renders every rider page and the public routes without
// throwing (feature 026 T026, US5).

const ctx = makeCtx();
const LOCALES = Object.keys(CATALOGS) as Locale[];

const RIDER_PAGES = [
	"/me",
	"/me/rides",
	"/me/badges",
	"/team",
	"/events",
	"/me/settings",
	"/me/disconnect",
];
const PUBLIC_PAGES = ["/", "/privacy"];
/** Pages that carry the language picker. */
const WITH_PICKER = new Set(["/", "/privacy", "/me/settings"]);

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedBalance(ATHLETE_A, { trainingRynke: 3, teamRynke: 2 });
	await seedRides(ATHLETE_A, 3, "2026-10-01");
	await seedRider(ctx, { athleteId: ATHLETE_B, consentVersion: null });
});

async function get(
	path: string,
	lang: Locale,
	athleteId?: number,
): Promise<{ status: number; body: string }> {
	const session = athleteId ? await sessionCookie(ctx, athleteId) : {};
	const res = await handleFetch(
		request(path, { cookies: { ...session, rp_lang: lang } }),
		ctx,
	);
	return { status: res.status, body: await res.text() };
}

describe.each(LOCALES)("in %s", (lang) => {
	const name = CATALOGS[lang]["meta.languageName"] as string;

	it.each([...RIDER_PAGES, ...PUBLIC_PAGES])("renders %s", async (path) => {
		const signedIn = RIDER_PAGES.includes(path) ? ATHLETE_A : undefined;
		const { status, body } = await get(path, lang, signedIn);
		expect(status).toBe(200);
		expect(body).toContain(`<html lang="${lang}">`);
		if (WITH_PICKER.has(path)) expect(body).toContain(`>${name}`);
	});

	it("renders the consent gate", async () => {
		const { status, body } = await get("/me", lang, ATHLETE_B);
		expect(status).toBe(200);
		expect(body).toContain(`<html lang="${lang}">`);
		expect(body).toContain(CATALOGS[lang]["consent.heading"] as string);
	});

	it("renders the offline page and the notification text", async () => {
		const offline = await handleFetch(request(`/offline?lang=${lang}`), ctx);
		expect(await offline.text()).toContain(
			CATALOGS[lang]["offline.title"] as string,
		);
		const text = await handleFetch(
			request(`/notification-text?lang=${lang}`),
			ctx,
		);
		expect(text.status).toBe(200);
		expect(await text.json()).toBeTruthy();
	});
});
