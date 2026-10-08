import { describe, expect, it } from "vitest";
import { SHARING_SINCE_VERSION } from "../../src/consent";
import type { Rider } from "../../src/db/riders";
import type { Viewer } from "../../src/http/viewer";
import {
	audienceOf,
	maySee,
	type RiderData,
	SINCE_VERSION,
	VISIBILITY,
} from "../../src/visibility";

// What one rider may see of another (feature 004 US3, data-model.md "Audience
// and visibility", FR-020, FR-021, FR-022, FR-007). Synthetic athlete IDs only.

const ORGANISER_ROW: Record<RiderData, boolean> = {
	firstName: true,
	profileLink: true,
	accumulatedRynke: true,
	progress: true,
	breakdown: true,
	attendance: true,
	corrections: true,
	rides: false,
	consentRecords: false,
};

const RIDER_ROW: Record<RiderData, boolean> = {
	firstName: false,
	profileLink: false,
	accumulatedRynke: true,
	progress: false,
	breakdown: false,
	attendance: false,
	corrections: false,
	rides: false,
	consentRecords: false,
};

const ALL_DATA = Object.keys(ORGANISER_ROW) as RiderData[];

function rider(athleteId: number, organiser: boolean): Rider {
	return {
		athleteId,
		firstName: `Synthetic ${athleteId}`,
		status: "connected",
		scopeReadAll: true,
		scopeWrite: false,
		scopes: "read,activity:read,activity:read_all",
		connectedAt: 0,
		scopesUpdatedAt: 0,
		membershipCheckedAt: 0,
		importStatus: "done",
		reconnectRequestedAt: null,
		figuresVersion: 1,
		organiser,
	};
}

function riderViewer(athleteId: number, organiser: boolean): Viewer {
	return {
		kind: "rider",
		rider: rider(athleteId, organiser),
		consentVersion: 1,
	};
}

describe("VISIBILITY", () => {
	it("matches the data-model table for organisers and riders", () => {
		for (const data of ALL_DATA) {
			expect(VISIBILITY[data].has("organiser"), data).toBe(ORGANISER_ROW[data]);
			expect(VISIBILITY[data].has("rider"), data).toBe(RIDER_ROW[data]);
		}
		expect(Object.keys(VISIBILITY).sort()).toEqual([...ALL_DATA].sort());
	});

	it("lists no visitor", () => {
		for (const data of ALL_DATA) {
			expect(VISIBILITY[data].has("visitor"), data).toBe(false);
		}
	});
});

describe("SINCE_VERSION", () => {
	it("shares every item from the first sharing version (research R13)", () => {
		expect(SHARING_SINCE_VERSION).toBe(1);
		expect(Object.keys(SINCE_VERSION).sort()).toEqual([...ALL_DATA].sort());
		for (const data of ALL_DATA) {
			expect(SINCE_VERSION[data], data).toBe(SHARING_SINCE_VERSION);
		}
	});
});

describe("maySee", () => {
	it("shows the rider everything about themselves", () => {
		for (const data of ALL_DATA) {
			expect(maySee("self", data, 1), data).toBe(true);
			expect(maySee("self", data, null), data).toBe(true);
		}
	});

	it("shows a visitor nothing", () => {
		for (const data of ALL_DATA) {
			expect(maySee("visitor", data, 1), data).toBe(false);
		}
	});

	it("shows nothing of a rider without consent (FR-021)", () => {
		for (const data of ALL_DATA) {
			expect(maySee("organiser", data, null), data).toBe(false);
			expect(maySee("rider", data, null), data).toBe(false);
		}
	});

	it("follows the table for a rider with consent", () => {
		for (const data of ALL_DATA) {
			expect(maySee("organiser", data, 1), data).toBe(ORGANISER_ROW[data]);
			expect(maySee("rider", data, 1), data).toBe(RIDER_ROW[data]);
		}
	});

	it("hides an item shared from a later version until the subject agrees to it (US4 scenario 3)", () => {
		const since = { ...SINCE_VERSION, accumulatedRynke: 2 };
		for (const audience of ["organiser", "rider"] as const) {
			expect(maySee(audience, "accumulatedRynke", 1, since)).toBe(false);
			expect(maySee(audience, "accumulatedRynke", 2, since)).toBe(true);
		}
		expect(maySee("organiser", "firstName", 1, since)).toBe(true);
		expect(maySee("self", "accumulatedRynke", 1, since)).toBe(true);
	});

	it("shows nobody else the rides or the consent records", () => {
		for (const audience of ["organiser", "rider", "visitor"] as const) {
			expect(maySee(audience, "rides", 1)).toBe(false);
			expect(maySee(audience, "consentRecords", 1)).toBe(false);
		}
	});
});

describe("audienceOf", () => {
	it("names a visitor a visitor", () => {
		expect(audienceOf({ kind: "visitor" }, 900001)).toBe("visitor");
	});

	it("names the rider themselves self, organiser or not", () => {
		expect(audienceOf(riderViewer(900001, false), 900001)).toBe("self");
		expect(audienceOf(riderViewer(900001, true), 900001)).toBe("self");
	});

	it("names another viewer from their own flag", () => {
		expect(audienceOf(riderViewer(900001, true), 900002)).toBe("organiser");
		expect(audienceOf(riderViewer(900001, false), 900002)).toBe("rider");
	});
});

describe("a synthetic team (SC-002)", () => {
	// Two organisers, three riders, one of them (900005) without consent.
	const team = [
		{ athleteId: 900001, organiser: true, consentVersion: 1 },
		{ athleteId: 900002, organiser: true, consentVersion: 1 },
		{ athleteId: 900003, organiser: false, consentVersion: 1 },
		{ athleteId: 900004, organiser: false, consentVersion: 1 },
		{ athleteId: 900005, organiser: false, consentVersion: null },
	];

	function expected(
		viewer: (typeof team)[number],
		subject: (typeof team)[number],
		data: RiderData,
	): boolean {
		if (viewer.athleteId === subject.athleteId) return true;
		if (subject.consentVersion === null) return false;
		return viewer.organiser ? ORGANISER_ROW[data] : RIDER_ROW[data];
	}

	it("answers every viewer × subject × item as FR-020 and FR-021 say", () => {
		for (const viewer of team) {
			const v = riderViewer(viewer.athleteId, viewer.organiser);
			for (const subject of team) {
				const audience = audienceOf(v, subject.athleteId);
				for (const data of ALL_DATA) {
					expect(
						maySee(audience, data, subject.consentVersion),
						`${viewer.athleteId} → ${subject.athleteId} ${data}`,
					).toBe(expected(viewer, subject, data));
				}
			}
		}
	});

	it("shows a visitor nothing of anyone", () => {
		for (const subject of team) {
			const audience = audienceOf({ kind: "visitor" }, subject.athleteId);
			for (const data of ALL_DATA) {
				expect(maySee(audience, data, subject.consentVersion)).toBe(false);
			}
		}
	});

	it("ignores the subject's own organiser flag (FR-007)", () => {
		// An organiser (900002) and a rider (900003), both with consent, look
		// the same to every other viewer.
		for (const viewer of [team[0], team[3]]) {
			if (!viewer) throw new Error("team too small");
			const v = riderViewer(viewer.athleteId, viewer.organiser);
			for (const data of ALL_DATA) {
				expect(maySee(audienceOf(v, 900002), data, 1), data).toBe(
					maySee(audienceOf(v, 900003), data, 1),
				);
			}
		}
	});
});
