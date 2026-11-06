import type { MessageId } from "./i18n/catalogs";

// The versions of the consent text a rider agrees to on the landing page
// (research R21): `landing.dataRead`, `landing.private`, `landing.purpose`,
// `landing.leave` and `consent.*` (contracts/messages.md). A new version means
// the text changed what is read, written or shown; riders who agreed to an
// older one are asked again (feature 004-roles-and-consent FR-013, research R11).
// Feature 008 named the ride's name without a new version: every response read
// already carried the name, it needs no new scope or request, and only the
// rider sees it (008 FR-007, clarification Q1; constitution v2.1.0).
// Feature 010 named the push service without one either: notifications need no
// Strava scope or request and show nothing to anyone but the rider
// (010 research R14; constitution v2.1.0).
// Feature 013 named runs and the team sums without one either: every read
// already returned the runs, they only give the rider their own badges, and
// others see only sums without names (013 FR-023, research R22). Swims
// followed the same way: read anyway, kept for the rider's own badges only
// (013 part C, research R30). The days and hours of rides, runs and swims
// counting for the team surprises, without names, were named the same way
// (013 part E, FR-016).
// Feature 025 is a new version: connection state and dates are newly shown to
// administrators, someone other than the rider (constitution Principle I), and
// `landing.leave` promised deleting everything, which a removal no longer does.
// The organiser graphs are a new version: organisers newly see daily figures. It
// needs no new scope, and no setting changes it (029 FR-022, FR-028).
// The ride figures (feature 032) are a minor revision, 3.1 (constitution
// 2.4.0): figures from data already read, newly shown to the team and the
// organisers. The text and the privacy notice name them; new acceptances record
// the revision, and riders who accepted 3 aren't asked again. Only a new scope,
// a new kind of Strava request or new data read from Strava is a new version.

export interface ConsentVersion {
	version: number;
	/** `"YYYY-MM-DD"`, the team's calendar day it was published. */
	published: string;
	/** Strava scopes the rider must have granted to take part (FR-012). */
	requiredScopes: readonly string[];
	/** What grew compared with the version before; empty for version 1. */
	changes: readonly MessageId[];
	/** Minor revisions, consecutive from 1; they never add a scope. */
	revisions: readonly ConsentRevision[];
}

/** A minor change of a version's text (constitution 2.4.0). */
export interface ConsentRevision {
	revision: number;
	/** `"YYYY-MM-DD"`, the team's calendar day it was published. */
	published: string;
	changes: readonly MessageId[];
}

/** Ordered and consecutive from 1; the last entry is the current version. */
export type ConsentVersions = readonly [ConsentVersion, ...ConsentVersion[]];

export const CONSENT_VERSIONS: ConsentVersions = [
	{
		version: 1,
		published: "2026-10-06",
		requiredScopes: ["read", "activity:read"],
		changes: [],
		revisions: [],
	},
	{
		version: 2,
		published: "2026-11-04",
		requiredScopes: ["read", "activity:read"],
		changes: ["consent.admins", "landing.leave"],
		revisions: [],
	},
	{
		version: 3,
		published: "2026-11-04",
		requiredScopes: ["read", "activity:read"],
		changes: ["consent.dailyFigures"],
		revisions: [
			{
				revision: 1,
				published: "2026-11-06",
				changes: ["consent.rideFigures"],
			},
		],
	},
];

export function currentVersion(versions: ConsentVersions): ConsentVersion {
	return versions[versions.length - 1] ?? versions[0];
}

/** The current version, for code that has no `Ctx`. */
export const CONSENT_VERSION = currentVersion(CONSENT_VERSIONS).version;

/** A version and the revision of it a rider accepted; 0 for none. */
export interface ConsentRevisionOf {
	version: number;
	revision: number;
}

/** The current version and its latest revision, which new acceptances record. */
export function currentRevision(versions: ConsentVersions): ConsentRevisionOf {
	const current = currentVersion(versions);
	return {
		version: current.version,
		revision: current.revisions.at(-1)?.revision ?? 0,
	};
}

/** `"3.1"`, or `"3"` without a revision. */
export function consentLabel({ version, revision }: ConsentRevisionOf): string {
	return revision > 0 ? `${version}.${revision}` : String(version);
}

/**
 * Where a rider stands against the current version (004 data-model.md
 * "Consent state", research R14). `viaStrava`: agreeing needs a trip through
 * Strava, always for `missing`, else when a scope the current version
 * requires isn't granted.
 */
export type ConsentState = (
	| { kind: "current" }
	| { kind: "missing" }
	| { kind: "older"; accepted: number; changes: readonly MessageId[] }
) & { viaStrava: boolean };

export function consentState(
	versions: ConsentVersions,
	accepted: number | null,
	grantedScopes: readonly string[],
): ConsentState {
	const current = currentVersion(versions);
	if (accepted === null) return { kind: "missing", viaStrava: true };
	const viaStrava = current.requiredScopes.some(
		(scope) => !grantedScopes.includes(scope),
	);
	if (accepted >= current.version) return { kind: "current", viaStrava };
	// Only major versions ask again; a rider renewing also reads what every
	// revision of a newer version added.
	const changes = versions
		.filter((entry) => entry.version > accepted)
		.flatMap((entry) => [
			...entry.changes,
			...entry.revisions.flatMap((revision) => revision.changes),
		]);
	return { kind: "older", accepted, changes, viaStrava };
}

/**
 * Whether the rider may use the app: agreed to the current version and granted
 * every scope it requires. A rider who agreed through Strava but left out a
 * newly required scope keeps meeting the gate (contracts/re-consent.md
 * "Through Strava").
 */
export function hasAgreed(state: ConsentState): boolean {
	return state.kind === "current" && !state.viaStrava;
}

/** The scopes a rider granted, as stored in `riders.scopes`. */
export function grantedScopes(scopes: string): string[] {
	return scopes.split(/[\s,]+/).filter((scope) => scope !== "");
}

/**
 * The lowest consent version whose text includes the FR-020 sharing with
 * organisers and the team (004 research R6, R13).
 */
export const SHARING_SINCE_VERSION = 1;

/** The first version that shows organisers a rider's daily figures (feature 029). */
export const DAILY_FIGURES_SINCE_VERSION = 3;

/**
 * The first version whose text, from revision 3.1, shows the ride figures to
 * the team and the organisers (feature 032 research R4).
 */
export const RIDE_FIGURES_SINCE_VERSION = 3;
