import { describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import { makeCtx, request } from "../support/ctx";

const ctx = makeCtx();

async function get(path: string, acceptLanguage?: string) {
	const res = await handleFetch(request(path, { acceptLanguage }), ctx);
	return { res, page: await res.text() };
}

// German title and first body sentence per notice (contracts/messages.md).
const GERMAN: Record<string, [string, string]> = {
	expired: [
		"Anmeldung abgelaufen",
		"Die Anmeldung ist abgelaufen. Bitte versuche es noch einmal.",
	],
	denied: [
		"RynkePoints braucht Lesezugriff auf deine Aktivitäten",
		"Ohne diese Berechtigung kann RynkePoints nicht funktionieren.",
	],
	"denied-deleted": [
		"RynkePoints braucht Lesezugriff auf deine Aktivitäten",
		"Ohne diese Berechtigung kann RynkePoints nicht funktionieren.",
	],
	"team-full": [
		"Das Team ist im Moment voll",
		"Strava erlaubt RynkePoints gerade keine weiteren Fahrerinnen und Fahrer.",
	],
	failed: [
		"Verbindung fehlgeschlagen",
		"Die Verbindung zu Strava hat nicht geklappt.",
	],
	"not-member": ["Nur für Club-Mitglieder", "Nur Mitglieder"],
	"not-member-deleted": ["Nur für Club-Mitglieder", "Nur Mitglieder"],
	"strava-busy": [
		"Strava ist gerade ausgelastet",
		"Bitte versuche es in ein paar Minuten noch einmal.",
	],
	deleted: [
		"Deine Daten wurden gelöscht",
		"Wir haben alle Daten über dich gelöscht.",
	],
	"deleted-revoke-failed": [
		"Deine Daten wurden gelöscht",
		"Wir konnten den Zugriff bei Strava nicht zurückgeben.",
	],
};

const RETRY = ["expired", "denied", "denied-deleted", "failed", "strava-busy"];
const CLUB = ["not-member", "not-member-deleted"];
const NOTHING_STORED = "Wir haben kein Konto für dich angelegt";
const DELETED = "Wir haben alle Daten über dich gelöscht";
const BACKUPS = "spätestens nach 7 Tagen";

describe("GET /notice/:id", () => {
	it.each(Object.entries(GERMAN))(
		"renders %s in German",
		async (id, [title, body]) => {
			const { res, page } = await get(`/notice/${id}`);
			expect(res.status).toBe(200);
			expect(res.headers.get("Content-Language")).toBe("de");
			expect(page).toContain('<html lang="de">');
			expect(page).toContain(`<title>${title}</title>`);
			expect(page).toContain(`<h1>${title}</h1>`);
			expect(page).toContain(body);
			expect(page).toContain('<a href="/">Zur Startseite</a>');
			expect(page).toContain(
				`<input type="hidden" name="next" value="/notice/${id}">`,
			);

			const retry = '<a href="/connect">Noch einmal versuchen</a>';
			if (RETRY.includes(id)) expect(page).toContain(retry);
			else expect(page).not.toContain(retry);

			const club = 'href="https://www.strava.com/clubs/2372209"';
			if (CLUB.includes(id)) expect(page).toContain(club);
			else expect(page).not.toContain(club);
		},
	);

	it("says nothing was stored for not-member and strava-busy", async () => {
		for (const id of ["not-member", "strava-busy"]) {
			const { page } = await get(`/notice/${id}`);
			expect(page).toContain(NOTHING_STORED);
			expect(page).not.toContain(DELETED);
		}
	});

	it("makes no claim about stored data on denied", async () => {
		const { page } = await get("/notice/denied");
		expect(page).not.toContain(NOTHING_STORED);
		expect(page).not.toContain("gelöscht");
	});

	it("confirms deletion and backup expiry on the *-deleted notices", async () => {
		for (const id of ["denied-deleted", "not-member-deleted"]) {
			const { page } = await get(`/notice/${id}`);
			expect(page).toContain(DELETED);
			expect(page).toContain(BACKUPS);
			expect(page).not.toContain(NOTHING_STORED);
		}
	});

	it("mentions backup expiry on deleted", async () => {
		const { page } = await get("/notice/deleted");
		expect(page).toContain(BACKUPS);
	});

	it("points to „Meine Apps“ when the revoke failed", async () => {
		const { page } = await get("/notice/deleted-revoke-failed");
		expect(page).toContain(BACKUPS);
		expect(page).toContain("„Meine Apps“");
	});

	it("links the club with the catalog's link text", async () => {
		const { page } = await get("/notice/not-member");
		expect(page).toContain(
			'<a href="https://www.strava.com/clubs/2372209">unseres Team-Clubs auf Strava</a>',
		);
	});

	it("renders English when the browser asks for it", async () => {
		const { res, page } = await get("/notice/team-full", "en");
		expect(res.headers.get("Content-Language")).toBe("en");
		expect(page).toContain("The team is full for now");
	});

	it.each(["/notice/unknown", "/nope", "/notice/"])(
		"answers %s with the German 404 page",
		async (path) => {
			const { res, page } = await get(path);
			expect(res.status).toBe(404);
			expect(page).toContain('<html lang="de">');
			expect(page).toContain("Seite nicht gefunden");
		},
	);
});
