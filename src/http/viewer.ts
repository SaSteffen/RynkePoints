import {
	type ConsentState,
	consentState,
	grantedScopes,
	hasAgreed,
} from "../consent";
import type { Ctx } from "../ctx";
import {
	type Consent,
	type ConsentRow,
	currentConsentStatement,
	toConsent,
} from "../db/consents";
import {
	type Rider,
	type RiderRow,
	riderStatement,
	toRider,
} from "../db/riders";
import { redirect } from "./redirect";
import { readSession } from "./session";

// Who is asking (feature 004 contracts/viewer-and-visibility.md). The role
// lives only in `riders.organiser` and is read afresh on every request, never
// put in a cookie or kept between requests (FR-003, research R4). The rider
// and their current consent come in one batch, one round trip (issue #184).

export type Viewer =
	| { kind: "visitor" }
	// rider.organiser: the flag (R2); consentVersion: highest accepted (R15);
	// consent: that record, null without one
	| {
			kind: "rider";
			rider: Rider;
			consentVersion: number | null;
			consent: Consent | null;
	  };

/** Who is asking, decided afresh on every request (FR-003). */
export async function readViewer(request: Request, ctx: Ctx): Promise<Viewer> {
	const athleteId = await readSession(request, ctx.env, ctx.now());
	if (athleteId === null) return { kind: "visitor" };
	const db = ctx.env.DB;
	const [riders, consents] = await db.batch([
		riderStatement(db, athleteId),
		currentConsentStatement(db, athleteId),
	]);
	if (!riders || !consents) {
		throw new Error("D1 batch returned too few results");
	}
	const row = (riders.results as RiderRow[])[0];
	if (!row) return { kind: "visitor" };
	const record = (consents.results as ConsentRow[])[0];
	const consent = record ? toConsent(record) : null;
	return {
		kind: "rider",
		rider: toRider(row),
		consentVersion: consent?.version ?? null,
		consent,
	};
}

/** `302 /` for a visitor (where they sign in with Strava), else null. */
export function requireRider(viewer: Viewer): Response | null {
	return viewer.kind === "visitor" ? redirect("/", 302) : null;
}

/** A rider's consent state against `ctx.consentVersions` (004 research R14). */
export function riderConsentState(
	viewer: Extract<Viewer, { kind: "rider" }>,
	ctx: Ctx,
): ConsentState {
	return consentState(
		ctx.consentVersions,
		viewer.consentVersion,
		grantedScopes(viewer.rider.scopes),
	);
}

/**
 * `302 /me` for a rider who hasn't agreed to the current version, where the
 * gate asks them (contracts/re-consent.md "Planned views"), else null. Call
 * after `requireRider`, which handles visitors.
 */
export function requireConsent(viewer: Viewer, ctx: Ctx): Response | null {
	if (viewer.kind === "visitor") return null;
	return hasAgreed(riderConsentState(viewer, ctx))
		? null
		: redirect("/me", 302);
}
