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
 * The lowest consent version whose text includes the FR-020 sharing with
 * organisers and the team (004 research R6, R13).
 */
export const SHARING_SINCE_VERSION = 1;
