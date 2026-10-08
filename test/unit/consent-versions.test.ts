import { describe, expect, it } from "vitest";
import {
	CONSENT_VERSION,
	CONSENT_VERSIONS,
	currentVersion,
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
