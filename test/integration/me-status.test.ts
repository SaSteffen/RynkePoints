import { beforeEach, describe, expect, it } from "vitest";
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

async function getMe(acceptLanguage?: string) {
	const res = await handleFetch(
		request("/me", {
			cookies: await sessionCookie(ctx, ATHLETE_A),
			acceptLanguage,
		}),
		ctx,
	);
	return { res, page: await res.text() };
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
		expect(page).toContain("Mit Strava verbunden");
		expect(page).not.toContain('href="/connect"');
	});

	it("shows the granted level", async () => {
		await seedRider(ctx, { scopeReadAll: true });
		expect((await getMe()).page).toContain(
			"Einschließlich deiner privaten Aktivitäten",
		);
		await resetDb();
		await seedRider(ctx, { scopeReadAll: false });
		expect((await getMe()).page).toContain(
			"Nur geteilte Aktivitäten – private („Nur du“) Aktivitäten werden nicht importiert.",
		);
	});

	it.each(["pending", "running"] as const)(
		"shows a %s import with the season start",
		async (importStatus) => {
			await seedRider(ctx, { importStatus });
			const { page } = await getMe();
			expect(page).toContain(
				"Deine Fahrten seit dem 01.01.2026 werden importiert …",
			);
			expect(page).not.toContain("Import abgeschlossen");
		},
	);

	it("shows a finished import", async () => {
		await seedRider(ctx, { importStatus: "done" });
		const { page } = await getMe();
		expect(page).toContain("Import abgeschlossen");
		expect(page).not.toContain("werden importiert");
	});

	it("offers the switcher and sign-out", async () => {
		await seedRider(ctx);
		const { page } = await getMe();
		expect(page).toContain('<input type="hidden" name="next" value="/me">');
		expect(page).toMatch(
			/<form method="post" action="\/logout"><button>Abmelden<\/button><\/form>/,
		);
	});

	it("escapes the first name", async () => {
		await seedRider(ctx, { firstName: "<b>Testrider</b>" });
		const { page } = await getMe();
		expect(page).toContain("Hallo &lt;b&gt;Testrider&lt;/b&gt;!");
	});
});

describe("GET /me for a needs_reconnect rider", () => {
	it("asks the rider to reconnect", async () => {
		await seedRider(ctx, { status: "needs_reconnect" });
		const { page } = await getMe();
		expect(page).toContain("Die Verbindung zu Strava muss erneuert werden.");
		expect(page).toContain('<a href="/connect">Erneut verbinden</a>');
		expect(page).not.toContain("Mit Strava verbunden");
	});
});

describe("GET /me in English", () => {
	it("renders English for an English browser", async () => {
		await seedRider(ctx, { importStatus: "running" });
		const { res, page } = await getMe("en");
		expect(res.headers.get("Content-Language")).toBe("en");
		expect(page).toContain("Connected to Strava");
		expect(page).toContain("Importing your rides since 01/01/2026 …");
	});
});
