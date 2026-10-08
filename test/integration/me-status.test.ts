import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_VERSIONS } from "../../src/consent";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";

const ctx = makeCtx();
const { de, en } = CATALOGS;

async function getMe(acceptLanguage?: string, path = "/me") {
	const res = await handleFetch(
		request(path, {
			cookies: await sessionCookie(ctx, ATHLETE_A),
			acceptLanguage,
		}),
		ctx,
	);
	return { res, page: await res.text() };
}

/** Settings holds the connection, permissions, consent and account (011 FR-014). */
function getSettings(acceptLanguage?: string) {
	return getMe(acceptLanguage, "/me/settings");
}

beforeEach(resetDb);

describe("GET /me signed out", () => {
	it("redirects without a session", async () => {
		const res = await handleFetch(request("/me"), ctx);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it("redirects when the rider no longer exists", async () => {
		const { res } = await getMe();
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});
});

describe("GET /me for a connected rider", () => {
	it("greets the rider and shows the connection", async () => {
		await seedRider(ctx);
		const { res, page } = await getMe();
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Language")).toBe("de");
		expect(page).toContain("<title>Deine RynkePoints</title>");
		expect(page).toContain("Hallo Testrider A!");
		expect(page).not.toContain("Erneut verbinden");
		const settings = (await getSettings()).page;
		expect(settings).toContain("Mit Strava verbunden");
		expect(settings).toContain(
			'<a href="/connect">Berechtigungen auf Strava ändern</a>',
		);
		expect(settings).not.toContain("Erneut verbinden");
	});

	it("keeps settings, consent and account off the Overview (011 FR-010)", async () => {
		await seedRider(ctx, { scopeWrite: true });
		const { page } = await getMe();
		for (const hidden of [
			de["me.status.connected"],
			escapeHtml(de["me.scope.readAll"]),
			escapeHtml(de["me.scope.write"]),
			escapeHtml(de["me.changePermissions"]),
			escapeHtml(de["me.consent.heading"]),
			escapeHtml(de["landing.dataRead"]),
			'href="/me/disconnect"',
			'action="/logout"',
			'id="notifications"',
		]) {
			expect(page).not.toContain(hidden);
		}
	});

	it("shows whether write access was granted", async () => {
		await seedRider(ctx, { scopeWrite: true });
		expect((await getSettings()).page).toContain(
			"Schreibzugriff erteilt: Sobald es die Funktion gibt, schreibt RynkePoints einen Rynke-Abschnitt in deine Fahrtbeschreibungen.",
		);
		await resetDb();
		await seedRider(ctx, { scopeWrite: false });
		expect((await getSettings()).page).toContain(
			"Kein Schreibzugriff: RynkePoints schreibt nichts in deine Fahrtbeschreibungen.",
		);
	});

	it("shows the stored consent on its Berlin date, what is read and who sees what", async () => {
		const late = makeCtx({ now: Date.parse("2026-10-06T23:30:00Z") / 1000 });
		await seedRider(late, { consentVersion: 1 });
		const { page } = await getSettings();
		expect(page).toContain("<h2>Deine Zustimmung</h2>");
		expect(page).toMatch(
			/<p>Zugestimmt am 07\.10\.2026 \(Version 1\):<\/p>\n<p>Wir lesen von deinen Radfahrten nur Namen, .*<\/p>\n<p>Die Organisatorinnen und Organisatoren des Teams sehen .*<\/p>\n<p>Alle anderen im Team sehen deine gesammelten Rynke/,
		);
		expect(page).not.toContain("noch keine Zustimmung");
	});

	it("shows the granted level", async () => {
		await seedRider(ctx, { scopeReadAll: true });
		expect((await getSettings()).page).toContain(
			"Einschließlich deiner privaten Aktivitäten",
		);
		await resetDb();
		await seedRider(ctx, { scopeReadAll: false });
		expect((await getSettings()).page).toContain(
			"Nur geteilte Aktivitäten – private („Nur du“) Aktivitäten werden nicht importiert.",
		);
	});

	it.each(["pending", "running"] as const)(
		"shows a %s import with the season start",
		async (importStatus) => {
			await seedRider(ctx, { importStatus });
			const { page } = await getMe();
			expect(page).toContain(
				"Deine Fahrten seit dem 01.01.2026 werden noch importiert.",
			);
			expect(page).not.toContain("Import abgeschlossen");
		},
	);

	it("shows a finished import", async () => {
		await seedRider(ctx, { importStatus: "done" });
		const { page } = await getMe();
		expect(page).toContain("Import abgeschlossen");
		expect(page).not.toContain("werden noch importiert");
	});

	it("offers the switcher and sign-out in Settings", async () => {
		await seedRider(ctx);
		const { page } = await getSettings();
		expect(page).toContain(
			'<input type="hidden" name="next" value="/me/settings">',
		);
		expect(page).toMatch(
			/<form method="post" action="\/logout"><input type="hidden" name="push_endpoint" value=""><button>Abmelden<\/button><\/form>/,
		);
	});

	it("shows what was agreed, the permissions, who sees what and how to leave (004 US4 scenario 1, R12)", async () => {
		await seedRider(ctx, { consentVersion: 1, scopeWrite: true });
		const { page } = await getSettings();
		for (const shown of [
			"Zugestimmt am 06.10.2026 (Version 1):",
			escapeHtml(de["landing.dataRead"]),
			escapeHtml(de["consent.organisers"]),
			escapeHtml(de["consent.team"]),
			escapeHtml(de["me.scope.readAll"]),
			escapeHtml(de["me.scope.write"]),
			`<a href="/me/disconnect">${escapeHtml(de["me.disconnect.button"])}</a>`,
		]) {
			expect(page).toContain(shown);
		}
	});

	it("escapes the first name", async () => {
		await seedRider(ctx, { firstName: "<b>Testrider</b>" });
		const { page } = await getMe();
		expect(page).toContain("Hallo &lt;b&gt;Testrider&lt;/b&gt;!");
	});
});

describe("GET /me for a rider without a consent record (004 US1, R14)", () => {
	it("shows only the consent gate, in order", async () => {
		await seedRider(ctx, { consentVersion: null, importStatus: "running" });
		const { res, page } = await getMe();
		expect(res.status).toBe(200);
		expect(page).toContain("<title>Deine RynkePoints</title>");
		const order = [
			`<h1>${escapeHtml(de["me.consent.renew.heading"])}</h1>`,
			`<p>${escapeHtml(de["me.consent.none"])}</p>`,
			`<h2>${escapeHtml(de["consent.heading"])}</h2>`,
			...(
				[
					"landing.dataRead",
					"landing.private",
					"landing.purpose",
					"landing.leave",
					"consent.organisers",
					"consent.team",
					"consent.required",
					"consent.write",
				] as const
			).map((id) => `<p>${escapeHtml(de[id])}</p>`),
			'<form method="post" action="/connect">',
			'<input type="checkbox" name="consent" value="1" required>',
			`<p>${escapeHtml(de["me.consent.renew.leave"])}</p>`,
			`<a class="danger" href="/me/disconnect">${escapeHtml(de["me.disconnect.button"])}</a>`,
			'<form method="post" action="/logout">',
		];
		let at = -1;
		for (const part of order) {
			const next = page.indexOf(part, at + 1);
			expect(next, part).toBeGreaterThan(at);
			at = next;
		}
	});

	it("hides the rest of /me until the rider agrees", async () => {
		await seedRider(ctx, { consentVersion: null, importStatus: "running" });
		const { page } = await getMe();
		for (const hidden of [
			"Hallo Testrider A!",
			de["me.status.connected"],
			de["me.scope.readAll"],
			de["me.scope.noWrite"],
			de["me.changePermissions"],
			"werden noch importiert",
			de["me.recent.heading"],
			de["me.consent.heading"],
			'id="install"',
			'id="notifications"',
		]) {
			expect(page).not.toContain(hidden);
		}
	});

	it("offers the current version from ctx.consentVersions", async () => {
		const v2Ctx = makeCtx({
			consentVersions: [
				...CONSENT_VERSIONS,
				{
					version: 2,
					published: "2026-11-01",
					requiredScopes: ["read", "activity:read"],
					changes: ["consent.team"],
				},
			],
		});
		await seedRider(v2Ctx, { consentVersion: null });
		const res = await handleFetch(
			request("/me", { cookies: await sessionCookie(v2Ctx, ATHLETE_A) }),
			v2Ctx,
		);
		const page = await res.text();
		expect(page).toContain(
			'<input type="checkbox" name="consent" value="2" required>',
		);
	});

	it("speaks English for an English browser", async () => {
		await seedRider(ctx, { consentVersion: null });
		const { page } = await getMe("en");
		expect(page).toContain(
			`<h1>${escapeHtml(en["me.consent.renew.heading"])}</h1>`,
		);
		expect(page).toContain(escapeHtml(en["me.consent.none"]));
	});

	it("shows a rider with a record the page and no consent form", async () => {
		await seedRider(ctx, { consentVersion: 1 });
		const { page } = await getMe();
		expect(page).toContain("Hallo Testrider A!");
		expect(page).not.toContain('action="/connect"');
		expect(page).not.toContain(escapeHtml(de["me.consent.renew.heading"]));
		expect((await getSettings()).page).toContain("(Version 1):");
	});
});

describe("GET /me for a needs_reconnect rider", () => {
	it("asks the rider to reconnect", async () => {
		await seedRider(ctx, { status: "needs_reconnect" });
		const { page } = await getMe();
		expect(page).toContain(
			'<aside class="notice notice-error">\n<p>Die Verbindung zu Strava muss erneuert werden.</p>',
		);
		expect(page).toContain(
			'<a class="button" href="/connect">Erneut verbinden</a>',
		);
		const settings = (await getSettings()).page;
		expect(settings).toContain(
			"Die Verbindung zu Strava muss erneuert werden.",
		);
		expect(settings).toContain(
			'<a class="button" href="/connect">Erneut verbinden</a>',
		);
		expect(settings).not.toContain("Mit Strava verbunden");
	});
});

describe("GET /me in English", () => {
	it("renders English for an English browser", async () => {
		await seedRider(ctx, { importStatus: "running" });
		const { res, page } = await getMe("en");
		expect(res.headers.get("Content-Language")).toBe("en");
		expect((await getSettings("en")).page).toContain("Connected to Strava");
		expect(page).toContain(
			"Your rides since 01/01/2026 are still being imported.",
		);
	});
});
