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

export interface ConsentVersion {
	version: number;
	/** `"YYYY-MM-DD"`, the team's calendar day it was published. */
	published: string;
	/** Strava scopes the rider must have granted to take part (FR-012). */
	requiredScopes: readonly string[];
	/** What grew compared with the version before; empty for version 1. */
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
	},
];

export function currentVersion(versions: ConsentVersions): ConsentVersion {
	return versions[versions.length - 1] ?? versions[0];
}

/** The current version, for code that has no `Ctx`. */
export const CONSENT_VERSION = currentVersion(CONSENT_VERSIONS).version;

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
	const changes = versions
		.filter((entry) => entry.version > accepted)
		.flatMap((entry) => entry.changes);
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
