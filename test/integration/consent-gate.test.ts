import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONSENT_VERSIONS, type ConsentVersion } from "../../src/consent";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, NOW } from "../support/fixtures";

// A rider whose consent is older than the current version meets the gate on
// `/me` and agrees again (feature 004 US4, contracts/re-consent.md). Version 2
// is synthetic and reuses existing keys as its changes (research R11).

const { de } = CATALOGS;

function withVersion2(extra: Partial<ConsentVersion> = {}): TestCtx {
	return makeCtx({
		consentVersions: [
			...CONSENT_VERSIONS,
			{
				version: 2,
				published: "2026-11-01",
				requiredScopes: ["read", "activity:read"],
				changes: ["consent.team", "consent.organisers"],
				...extra,
			},
		],
	});
}

/** Version 2 requires write access, which the seeded rider hasn't granted. */
function withScopeVersion2(): TestCtx {
	return withVersion2({
		requiredScopes: ["read", "activity:read", "activity:write"],
	});
}

let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	ctx = withVersion2();
});

async function getMe(path = "/me"): Promise<string> {
	const res = await handleFetch(
		request(path, { cookies: await sessionCookie(ctx, ATHLETE_A) }),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

async function postConsent(
	form: Record<string, string>,
	options: { origin?: string | null; signedIn?: boolean } = {},
): Promise<Response> {
	const cookies =
		options.signedIn === false ? {} : await sessionCookie(ctx, ATHLETE_A);
	return handleFetch(
		request("/me/consent", {
			method: "POST",
			form,
			cookies,
			origin: options.origin,
		}),
		ctx,
	);
}

async function consentRows() {
	const { results } = await env.DB.prepare(
		"SELECT version, accepted_at FROM consent_records ORDER BY version",
	).all();
	return results;
}

function expectInOrder(page: string, parts: string[]) {
	let at = -1;
	for (const part of parts) {
		const next = page.indexOf(part, at + 1);
		expect(next, part).toBeGreaterThan(at);
		at = next;
	}
}

function expectSeeOther(res: Response) {
	expect(res.status).toBe(303);
	expect(res.headers.get("Location")).toBe("/me");
}

const CONSENT_TEXTS = [
	"landing.dataRead",
	"landing.private",
	"landing.purpose",
	"landing.leave",
	"consent.organisers",
	"consent.team",
	"consent.required",
	"consent.write",
] as const;

const HIDDEN = [
	"Hallo Testrider A!",
	de["me.status.connected"],
	de["me.scope.readAll"],
	de["me.recent.heading"],
	de["me.consent.heading"],
	'id="install"',
	'id="notifications"',
];

describe("GET /me on an older version (US4 scenario 2)", () => {
	it("shows what changed, the current consent and a form to agree", async () => {
		await seedRider(ctx, { consentVersion: 1 });
		const page = await getMe();
		const older = de["me.consent.renew.older"]
			.replace("{accepted}", "1")
			.replace("{date}", "06.10.2026")
			.replace("{version}", "2");
		expectInOrder(page, [
			`<h1>${escapeHtml(de["me.consent.renew.heading"])}</h1>`,
			`<p>${escapeHtml(older)}</p>`,
			`<li>${escapeHtml(de["consent.team"])}</li>`,
			`<li>${escapeHtml(de["consent.organisers"])}</li>`,
			`<h2>${escapeHtml(de["consent.heading"])}</h2>`,
			...CONSENT_TEXTS.map((id) => `<p>${escapeHtml(de[id])}</p>`),
			'<form method="post" action="/me/consent">',
			`<input type="checkbox" name="consent" value="2" required> ${escapeHtml(de["consent.agree"])}`,
			`<button>${escapeHtml(de["me.consent.renew.button"])}</button>`,
			`<p>${escapeHtml(de["me.consent.renew.leave"])}</p>`,
			`<a href="/me/disconnect">${escapeHtml(de["me.disconnect.button"])}</a>`,
			'<form method="post" action="/logout">',
		]);
		expect(page).not.toContain('action="/connect"');
		expect(page).not.toContain(escapeHtml(de["me.consent.renew.strava"]));
	});

	it("hides the rest of /me until the rider agrees", async () => {
		await seedRider(ctx, { consentVersion: 1 });
		const page = await getMe();
		for (const hidden of HIDDEN) expect(page).not.toContain(hidden);
	});

	it("records version 2 on POST /me/consent and then shows /me as usual", async () => {
		await seedRider(ctx, { consentVersion: 1 });
		expectSeeOther(await postConsent({ consent: "2" }));
		expect(await consentRows()).toEqual([
			{ version: 1, accepted_at: NOW },
			{ version: 2, accepted_at: NOW },
		]);
		const page = await getMe();
		expect(page).toContain("Hallo Testrider A!");
		expect(page).not.toContain(escapeHtml(de["me.consent.renew.heading"]));
		expect(await getMe("/me/settings")).toContain("(Version 2):");
	});
});

describe("GET /me when version 2 needs a new permission (US4 scenario 4)", () => {
	beforeEach(() => {
		ctx = withScopeVersion2();
	});

	it("asks the rider to agree through Strava", async () => {
		await seedRider(ctx, { consentVersion: 1 });
		const page = await getMe();
		expectInOrder(page, [
			`<li>${escapeHtml(de["consent.team"])}</li>`,
			`<p>${escapeHtml(de["me.consent.renew.strava"])}</p>`,
			'<form method="post" action="/connect">',
			'<input type="checkbox" name="consent" value="2" required>',
		]);
		expect(page).not.toContain('action="/me/consent"');
	});

	it("records nothing on POST /me/consent", async () => {
		await seedRider(ctx, { consentVersion: 1 });
		expectSeeOther(await postConsent({ consent: "2" }));
		expect(await consentRows()).toEqual([{ version: 1, accepted_at: NOW }]);
	});

	it("goes straight to /me/consent once the scope is granted", async () => {
		await seedRider(ctx, { consentVersion: 1, scopeWrite: true });
		const page = await getMe();
		expect(page).toContain('<form method="post" action="/me/consent">');
		expect(page).not.toContain(escapeHtml(de["me.consent.renew.strava"]));
	});
});

describe("leaving instead of agreeing (US4 scenario 5)", () => {
	let fake: FakeStrava;

	beforeEach(() => {
		fake = installFakeStrava();
	});

	afterEach(() => fake.restore());

	it("keeps /me/disconnect working for a rider on an older version", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { consentVersion: 1 });
		const cookies = await sessionCookie(ctx, ATHLETE_A);
		const page = await handleFetch(request("/me/disconnect", { cookies }), ctx);
		expect(page.status).toBe(200);
		const res = await handleFetch(
			request("/me/disconnect", { method: "POST", cookies }),
			ctx,
		);
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toMatch(/^\/notice\/deleted/);
		expect(await consentRows()).toEqual([]);
	});
});

describe("POST /me/consent", () => {
	it("refuses another origin", async () => {
		await seedRider(ctx, { consentVersion: 1 });
		const res = await postConsent(
			{ consent: "2" },
			{ origin: "https://evil.example" },
		);
		expect(res.status).toBe(403);
		expect(await consentRows()).toEqual([{ version: 1, accepted_at: NOW }]);
	});

	it("sends a signed-out visitor to the start page", async () => {
		const res = await postConsent({ consent: "2" }, { signedIn: false });
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it.each([
		["without the tick", {}],
		["with the older version", { consent: "1" }],
	])("records nothing %s", async (_name, form) => {
		await seedRider(ctx, { consentVersion: 1 });
		expectSeeOther(await postConsent(form));
		expect(await consentRows()).toEqual([{ version: 1, accepted_at: NOW }]);
	});

	it("writes nothing for a rider already current", async () => {
		await seedRider(ctx, { consentVersion: 2 });
		expectSeeOther(await postConsent({ consent: "2" }));
		expect(await consentRows()).toEqual([{ version: 2, accepted_at: NOW }]);
	});

	it.each([
		["/me/settings", "/me/settings"],
		["/me/rides?page=2", "/me/rides?page=2"],
		["/team", "/team"],
		["https://evil.example/", "/me"],
		["/", "/me"],
	])("returns to next=%s at %s (011 R9)", async (next, location) => {
		await seedRider(ctx, { consentVersion: 1 });
		const res = await postConsent({ consent: "2", next });
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe(location);
		expect(await consentRows()).toHaveLength(2);
	});

	it("keeps the first acceptance when posted twice", async () => {
		await seedRider(ctx, { consentVersion: 1 });
		expectSeeOther(await postConsent({ consent: "2" }));
		ctx = makeCtx({
			now: NOW + 3600,
			consentVersions: ctx.consentVersions,
		});
		expectSeeOther(await postConsent({ consent: "2" }));
		expect(await consentRows()).toEqual([
			{ version: 1, accepted_at: NOW },
			{ version: 2, accepted_at: NOW },
		]);
	});
});
