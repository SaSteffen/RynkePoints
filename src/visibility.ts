import { SHARING_SINCE_VERSION } from "./consent";
import type { Viewer } from "./http/viewer";

// What one rider may see of another (feature 004 US3, FR-020, FR-021, FR-022,
// data-model.md "Audience and visibility"). Pure: no D1, no clock, no text.
// Data without a `RiderData` value is shown only to the rider themselves.

export type RiderData =
	| "firstName"
	| "profileLink"
	| "accumulatedRynke"
	| "progress"
	| "breakdown"
	| "attendance"
	| "corrections"
	| "rides"
	| "consentRecords";

export type Audience = "self" | "organiser" | "rider" | "visitor";

const ORGANISER_ONLY: ReadonlySet<Audience> = new Set(["organiser"]);
const TEAM: ReadonlySet<Audience> = new Set(["organiser", "rider"]);
const NOBODY: ReadonlySet<Audience> = new Set();

/** The FR-020 table; `self` sees every item and isn't listed. */
export const VISIBILITY: Readonly<Record<RiderData, ReadonlySet<Audience>>> = {
	firstName: ORGANISER_ONLY,
	profileLink: ORGANISER_ONLY,
	accumulatedRynke: TEAM,
	progress: ORGANISER_ONLY,
	breakdown: ORGANISER_ONLY,
	attendance: ORGANISER_ONLY,
	corrections: ORGANISER_ONLY,
	rides: NOBODY,
	consentRecords: NOBODY,
};

/** The first consent version that shares each item with others (R13). */
export const SINCE_VERSION: Readonly<Record<RiderData, number>> = {
	firstName: SHARING_SINCE_VERSION,
	profileLink: SHARING_SINCE_VERSION,
	accumulatedRynke: SHARING_SINCE_VERSION,
	progress: SHARING_SINCE_VERSION,
	breakdown: SHARING_SINCE_VERSION,
	attendance: SHARING_SINCE_VERSION,
	corrections: SHARING_SINCE_VERSION,
	rides: SHARING_SINCE_VERSION,
	consentRecords: SHARING_SINCE_VERSION,
};

export function audienceOf(viewer: Viewer, subjectAthleteId: number): Audience {
	if (viewer.kind === "visitor") return "visitor";
	if (viewer.rider.athleteId === subjectAthleteId) return "self";
	return viewer.rider.organiser ? "organiser" : "rider";
}

/**
 * Whether `audience` may see `data` of a subject whose highest accepted
 * consent version is `subjectVersion`. The subject's own role is not an input
 * (FR-007). `since` is for tests only; views never pass it.
 */
export function maySee(
	audience: Audience,
	data: RiderData,
	subjectVersion: number | null,
	since: Readonly<Record<RiderData, number>> = SINCE_VERSION,
): boolean {
	if (audience === "self") return true;
	if (audience === "visitor") return false;
	if (subjectVersion === null || subjectVersion < since[data]) return false;
	return VISIBILITY[data].has(audience);
}
