import { describe, expect, it } from "vitest";
import {
	CONSENT_VERSION,
	CONSENT_VERSIONS,
	type ConsentVersions,
	consentState,
	currentVersion,
	hasAgreed,
} from "../../src/consent";
import { CATALOGS } from "../../src/i18n/catalogs";

// The consent-version registry (feature 004 research R11, data-model.md
// "Consent Version").

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
		});
	});

	it("dates every version as a calendar day", () => {
		for (const entry of CONSENT_VERSIONS) {
			expect(entry.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		}
	});

	it("names only changes every catalog has", () => {
		for (const entry of CONSENT_VERSIONS) {
			for (const id of entry.changes) {
				for (const catalog of Object.values(CATALOGS)) {
					expect(catalog[id]).toBeTruthy();
				}
			}
		}
	});

	it("keeps CONSENT_VERSION at the last entry", () => {
		expect(CONSENT_VERSION).toBe(CONSENT_VERSIONS.at(-1)?.version);
		expect(currentVersion(CONSENT_VERSIONS).version).toBe(CONSENT_VERSION);
	});
});

describe("consentState (research R14)", () => {
	const VERSIONS: ConsentVersions = [
		...CONSENT_VERSIONS,
		{
			version: 2,
			published: "2026-11-01",
			requiredScopes: ["read", "activity:read"],
			changes: ["consent.team"],
		},
		{
			version: 3,
			published: "2026-12-01",
			requiredScopes: ["read", "activity:read", "activity:write"],
			changes: ["consent.organisers", "consent.write"],
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
			changes: ["consent.team", "consent.organisers", "consent.write"],
			viaStrava: false,
		});
		expect(consentState(VERSIONS, 2, ALL)).toMatchObject({
			kind: "older",
			accepted: 2,
			changes: ["consent.organisers", "consent.write"],
		});
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
