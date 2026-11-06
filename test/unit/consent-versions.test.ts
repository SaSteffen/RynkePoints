import { describe, expect, it } from "vitest";
import {
	CONSENT_VERSION,
	CONSENT_VERSIONS,
	type ConsentVersions,
	consentLabel,
	consentState,
	currentRevision,
	currentVersion,
	hasAgreed,
	SHARING_SINCE_VERSION,
} from "../../src/consent";
import { CATALOGS } from "../../src/i18n/catalogs";

// The consent-version registry (feature 004 research R11, data-model.md
// "Consent Version").

/** What later versions added: text named without a new version isn't in it. */
const NEW_TEXT_SINCE_FIRST_VERSION = CONSENT_VERSIONS.flatMap((v) => v.changes);

describe("CONSENT_VERSIONS", () => {
	it("starts at 1 and is ordered and consecutive", () => {
		expect(CONSENT_VERSIONS.length).toBeGreaterThan(0);
		CONSENT_VERSIONS.forEach((entry, i) => {
			expect(entry.version).toBe(i + 1);
		});
	});

	it("holds version 1 with the scopes taking part needs and no changes", () => {
		expect(CONSENT_VERSIONS[0]).toEqual({
			version: 1,
			published: "2026-10-06",
			requiredScopes: ["read", "activity:read"],
			changes: [],
			revisions: [],
		});
	});

	it("dates every version as a calendar day", () => {
		for (const entry of CONSENT_VERSIONS) {
			expect(entry.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		}
	});

	it("names only changes every catalog has", () => {
		for (const entry of CONSENT_VERSIONS) {
			for (const id of [
				...entry.changes,
				...entry.revisions.flatMap((r) => r.changes),
			]) {
				for (const catalog of Object.values(CATALOGS)) {
					expect(catalog[id]).toBeTruthy();
				}
			}
		}
	});

	it("asks again for daily figures, with no new scope (organiser graphs)", () => {
		const third = CONSENT_VERSIONS[2];
		expect(third?.version).toBe(3);
		expect(third?.changes).toEqual(["consent.dailyFigures"]);
		expect(third?.requiredScopes).toEqual(CONSENT_VERSIONS[1]?.requiredScopes);
		expect(CATALOGS.en["consent.dailyFigures"]).toContain("per day");
		expect(CATALOGS.de["consent.dailyFigures"]).toContain("pro Tag");
	});

	it("names runs and team sums without a new version (013 FR-023, R22)", () => {
		expect(CATALOGS.de["consent.short.read"]).toContain("Lauf");
		expect(CATALOGS.de["consent.team"]).toContain("Team-Summen");
		expect(CATALOGS.en["consent.short.read"]).toContain("runs");
		expect(NEW_TEXT_SINCE_FIRST_VERSION).not.toContain("consent.short.read");
		expect(NEW_TEXT_SINCE_FIRST_VERSION).not.toContain("consent.team");
	});

	it("names the team surprises' days and hours without a new version (013 part E)", () => {
		expect(CATALOGS.de["consent.team"]).toContain("Team-Überraschungen");
		expect(CATALOGS.de["consent.team"]).toContain("schwimmst");
		expect(CATALOGS.en["consent.team"]).toContain("team surprises");
		expect(NEW_TEXT_SINCE_FIRST_VERSION).not.toContain("consent.short.read");
		expect(NEW_TEXT_SINCE_FIRST_VERSION).not.toContain("consent.team");
	});

	it("names swims without a new version (013 part C, R30)", () => {
		expect(CATALOGS.de["consent.short.read"]).toContain("Schwimm");
		expect(CATALOGS.en["consent.short.read"]).toContain("swims");
		expect(NEW_TEXT_SINCE_FIRST_VERSION).not.toContain("consent.short.read");
		expect(NEW_TEXT_SINCE_FIRST_VERSION).not.toContain("consent.team");
	});

	it("asks again for the administrators and the block list (025 FR-032)", () => {
		expect(CONSENT_VERSIONS[1]).toMatchObject({
			version: 2,
			requiredScopes: ["read", "activity:read"],
			changes: ["consent.admins", "landing.leave"],
		});
		expect(SHARING_SINCE_VERSION).toBe(1);
		expect(CATALOGS.de["consent.admins"]).toContain("Sperrliste");
		expect(CATALOGS.en["consent.admins"]).toContain("block list");
		expect(CATALOGS.de["landing.leave"]).toContain("Strava-ID");
		expect(CATALOGS.en["landing.leave"]).toContain("Strava ID");
		expect(CATALOGS.de["consent.short.shown"]).toContain("Admins");
		expect(CATALOGS.en["consent.short.shown"]).toContain("Administrators");
	});

	it("names the daily figures where a new rider always reads them", () => {
		expect(CATALOGS.de["consent.short.shown"]).toContain(
			"Kilometer und Höhenmeter pro Tag",
		);
		expect(CATALOGS.en["consent.short.shown"]).toContain(
			"kilometres and elevation per day",
		);
		expect(CATALOGS.de["consent.agree"]).toContain("Tagessummen");
		expect(CATALOGS.en["consent.agree"]).toContain("daily totals");
	});

	// Constitution 2.4.0: figures from data already read, newly shown to others,
	// are a minor revision; riders who accepted the version aren't asked again.
	it("revises version 3 for the ride figures, with no new scope (ride stats)", () => {
		expect(CONSENT_VERSIONS[0]?.revisions).toEqual([]);
		expect(CONSENT_VERSIONS[1]?.revisions).toEqual([]);
		expect(CONSENT_VERSIONS[2]?.revisions).toEqual([
			{
				revision: 1,
				published: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
				changes: ["consent.rideFigures"],
			},
		]);
	});

	it("numbers revisions from 1, dated no earlier than their version", () => {
		for (const entry of CONSENT_VERSIONS) {
			entry.revisions.forEach((revision, i) => {
				expect(revision.revision).toBe(i + 1);
				expect(revision.published >= entry.published).toBe(true);
			});
		}
	});

	it("never adds a scope in a revision, which would be a new version", () => {
		for (const entry of CONSENT_VERSIONS) {
			for (const revision of entry.revisions) {
				expect(Object.keys(revision).sort()).toEqual(
					["changes", "published", "revision"].sort(),
				);
			}
		}
	});

	it("names the ride figures where a new rider always reads them", () => {
		expect(CATALOGS.de["consent.short.shown"]).toContain(
			"Fahrten, Kilometer und Höhenmeter ohne Namen",
		);
		expect(CATALOGS.en["consent.short.shown"]).toContain(
			"sessions, kilometres and elevation, without your name",
		);
		expect(CATALOGS.en["consent.rideFigures"]).toContain("typical ride");
		expect(CATALOGS.de["consent.rideFigures"]).toContain("typische Fahrt");
	});

	it("is at revision 3.1", () => {
		expect(currentRevision(CONSENT_VERSIONS)).toEqual({
			version: 3,
			revision: 1,
		});
		expect(consentLabel({ version: 3, revision: 1 })).toBe("3.1");
		expect(consentLabel({ version: 3, revision: 0 })).toBe("3");
	});

	it("keeps CONSENT_VERSION at the last entry", () => {
		expect(CONSENT_VERSION).toBe(CONSENT_VERSIONS.at(-1)?.version);
		expect(currentVersion(CONSENT_VERSIONS).version).toBe(CONSENT_VERSION);
	});
});

describe("consentState (research R14)", () => {
	const VERSIONS: ConsentVersions = [
		CONSENT_VERSIONS[0],
		{
			version: 2,
			published: "2026-11-01",
			requiredScopes: ["read", "activity:read"],
			changes: ["consent.team"],
			revisions: [],
		},
		{
			version: 3,
			published: "2026-12-01",
			requiredScopes: ["read", "activity:read", "activity:write"],
			changes: ["consent.organisers", "consent.short.read"],
			revisions: [
				{ revision: 1, published: "2026-12-05", changes: ["consent.admins"] },
			],
		},
	];
	const ALL = ["read", "activity:read", "activity:read_all", "activity:write"];

	it("is missing without a record, always through Strava", () => {
		expect(consentState(VERSIONS, null, ALL)).toEqual({
			kind: "missing",
			viaStrava: true,
		});
	});

	it("is older below the current version, with every change since in order", () => {
		expect(consentState(VERSIONS, 1, ALL)).toEqual({
			kind: "older",
			accepted: 1,
			changes: [
				"consent.team",
				"consent.organisers",
				"consent.short.read",
				"consent.admins",
			],
			viaStrava: false,
		});
		expect(consentState(VERSIONS, 2, ALL)).toMatchObject({
			kind: "older",
			accepted: 2,
			changes: ["consent.organisers", "consent.short.read", "consent.admins"],
		});
	});

	it("keeps a rider on the version without its revision current (no re-ask)", () => {
		expect(consentState(VERSIONS, 3, ALL)).toEqual({
			kind: "current",
			viaStrava: false,
		});
		expect(consentState(CONSENT_VERSIONS, 3, ALL).kind).toBe("current");
	});

	it("lists the ride figures for a rider renewing from version 2", () => {
		const state = consentState(CONSENT_VERSIONS, 2, ALL);
		expect(state).toMatchObject({ kind: "older" });
		expect(state.kind === "older" && state.changes).toEqual([
			"consent.dailyFigures",
			"consent.rideFigures",
		]);
	});

	it("is current at or above the current version", () => {
		expect(consentState(VERSIONS, 3, ALL)).toEqual({
			kind: "current",
			viaStrava: false,
		});
		expect(consentState(VERSIONS, 4, ALL).kind).toBe("current");
	});

	it("goes through Strava when a scope the current version requires is missing", () => {
		const noWrite = ["read", "activity:read", "activity:read_all"];
		expect(consentState(VERSIONS, 1, noWrite)).toMatchObject({
			kind: "older",
			viaStrava: true,
		});
		expect(consentState(CONSENT_VERSIONS, 1, noWrite).viaStrava).toBe(false);
	});

	it("lets only a current rider with every required scope use the app", () => {
		const noWrite = ["read", "activity:read", "activity:read_all"];
		expect(hasAgreed(consentState(VERSIONS, 3, ALL))).toBe(true);
		expect(hasAgreed(consentState(VERSIONS, 3, noWrite))).toBe(false);
		expect(hasAgreed(consentState(VERSIONS, 2, ALL))).toBe(false);
		expect(hasAgreed(consentState(VERSIONS, null, ALL))).toBe(false);
	});
});
