import {
	clientId,
	memberClubIds,
	returnVia,
	seasonFetchAfter,
	teamId,
} from "../config";
import { currentRevision, currentVersion, grantedScopes } from "../consent";
import type { Ctx } from "../ctx";
import { isBlocked } from "../db/blocked";
import { recordConsent } from "../db/consents";
import { isOnGuestList } from "../db/guests";
import { forgetPendingRevocation } from "../db/pending-revocations";
import {
	deleteRider,
	getRider,
	insertRider,
	type RiderGrant,
	saveCredentials,
	setImportStatus,
	setMembershipChecked,
	updateRiderOnReconnect,
} from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { queueReport } from "../routing/report";
import { evaluateChange } from "../rynke/apply";
import { isClubMember } from "../strava/client";
import { STRAVA_ORIGIN } from "../strava/result";
import { exchangeCode } from "../strava/tokens";
import {
	askOtherTeams,
	letGoElsewhere,
	withdrawGrant,
} from "../strava/withdraw";
import { forbidden } from "./errors";
import { arrival, sectionNext } from "./lang";
import type { NoticeId } from "./notice";
import { redirect } from "./redirect";
import {
	clearOAuthStateCookie,
	clearSessionCookie,
	createOAuthStateCookie,
	createSessionCookie,
	isSameOrigin,
	readOAuthState,
	readSession,
} from "./session";

// Connecting through Strava OAuth (contracts/http-routes.md, research R1, R4).
// A new rider first agrees to the consent on the landing page; the OAuth state
// cookie carries the agreed version to the callback, which stores it with the
// rider (R21). Every outcome is a redirect, so a reload never re-submits a used
// code (R18).

// `activity:write` is never requested: the app writes nothing to Strava
// (constitution Principle III).
const REQUESTED_SCOPES = "read,activity:read,activity:read_all";

function randomState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The team's own callback, or the gateway's return address for this team,
 * which forwards Strava's answer to that callback (feature 026 FR-007).
 */
function redirectUri(request: Request, ctx: Ctx): string {
	const via = returnVia(ctx.env);
	if (via === null) return `${new URL(request.url).origin}/auth/callback`;
	return `${via}/auth/return/${encodeURIComponent(teamId(ctx.env))}`;
}

async function authorizeRedirect(
	request: Request,
	ctx: Ctx,
	consentVersion: number,
	next: string,
	switchTeam = false,
): Promise<Response> {
	const state = randomState();
	const authorize = new URL(`${STRAVA_ORIGIN}/oauth/authorize`);
	authorize.search = new URLSearchParams({
		client_id: clientId(ctx.env),
		redirect_uri: redirectUri(request, ctx),
		response_type: "code",
		// A switch follows an approval seconds ago: Strava needn't ask again
		// (feature 044 R3).
		approval_prompt: switchTeam ? "auto" : "force",
		scope: REQUESTED_SCOPES,
		state,
	}).toString();
	return redirect(authorize.href, 302, [
		await createOAuthStateCookie(
			state,
			consentVersion,
			next,
			ctx.now(),
			ctx.env,
			switchTeam,
		),
	]);
}

/**
 * `POST /connect`: the consent form on the landing page and the consent gate,
 * which also sends the section to return to (feature 011 research R9).
 */
export async function handleConnectForm(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	if (!isSameOrigin(request)) return forbidden(ctx, i18n, "/");
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		form = new FormData();
	}
	const version = currentVersion(ctx.consentVersions).version;
	if (form.get("consent") !== String(version)) {
		return redirect("/notice/consent-required", 303);
	}
	return authorizeRedirect(
		request,
		ctx,
		version,
		sectionNext(form.get("next")),
		// The choice page's "switch to this team" (feature 044 R3).
		form.get("switch") === "1",
	);
}

/** `GET /connect?next=`: reconnecting or changing permissions, signed in only. */
export async function handleReconnect(
	request: Request,
	ctx: Ctx,
): Promise<Response> {
	// Null too for a rider who is gone (research R9).
	if ((await readSession(request, ctx.env, ctx.now())) === null) {
		return redirect("/", 302);
	}
	// Settings asks to come back to it (feature 011 research R9).
	const next = new URL(request.url).searchParams.get("next");
	return authorizeRedirect(request, ctx, 0, sectionNext(next));
}

function notice(id: NoticeId, cookies: string[] = []): Response {
	return redirect(`/notice/${id}`, 303, [clearOAuthStateCookie(), ...cookies]);
}

/**
 * Strava's redirect after the person approved or declined. Its Strava calls,
 * giving access back to someone turned away among them, count under
 * connecting (feature 047 research R1).
 */
export function handleCallback(request: Request, ctx: Ctx): Promise<Response> {
	return signIn(request, { ...ctx, stravaAction: "connect" });
}

async function signIn(request: Request, ctx: Ctx): Promise<Response> {
	const params = new URL(request.url).searchParams;
	const expected = await readOAuthState(request, ctx.env, ctx.now());
	if (!expected || params.get("state") !== expected.state) {
		return notice("expired");
	}
	if (params.has("error")) return notice("denied");
	const code = params.get("code");
	if (!code) return notice("failed");

	const exchange = await exchangeCode(ctx, code);
	if (exchange.kind === "forbidden") return notice("team-full");
	// Even the reserve for sign-ins is used up (feature 024 FR-008).
	if (exchange.kind === "budget") return notice("strava-busy");
	if (exchange.kind !== "ok") return notice("failed");
	const token = exchange.value;
	// Every refusal from here on withdraws the token just exchanged, unless
	// another team holds the person: the grant belongs to the app every team
	// shares, and a revoke ends it everywhere (feature 041 FR-009, R14). It
	// settles after the answer, so the person doesn't wait for it.
	const withdraw = () =>
		ctx.waitUntil(
			withdrawGrant(ctx, token.athleteId, token.refreshToken).catch((err) => {
				// The daily run settles a kept token; one never kept is lost.
				console.error(
					`Withdrawal at sign-in failed: ${err instanceof Error ? err.name : "unknown error"}`,
				);
			}),
		);
	// Strava only reveals who is connecting here. A blocked rider gets no club
	// request, and nothing they returned is kept (feature 025 FR-030, R7).
	if (await isBlocked(ctx.env.DB, token.athleteId)) {
		withdraw();
		return notice("blocked");
	}
	const auth = { accessToken: token.accessToken };
	const existing = await getRider(ctx.env.DB, token.athleteId);

	// Turns the rider away; an existing rider loses everything (FR-004, FR-006).
	const refuse = async (id: NoticeId, deletedId: NoticeId) => {
		withdraw();
		if (!existing) return notice(id);
		await deleteRider(ctx.env.DB, token.athleteId);
		await queueReport(ctx, token.athleteId);
		return notice(deletedId, [clearSessionCookie()]);
	};

	const scopes = token.scope ?? params.get("scope") ?? "";
	const granted = new Set(grantedScopes(scopes));
	if (!granted.has("read") || !granted.has("activity:read")) {
		return refuse("denied", "denied-deleted");
	}

	// A new athlete who didn't agree on the way in is never stored (R21).
	const version = currentVersion(ctx.consentVersions).version;
	if (!existing && expected.consentVersion !== version) {
		withdraw();
		return notice("consent-required");
	}

	// A person on the guest list gets in without the club and needs no club
	// request; the list wins over the club (feature 041 FR-003, R8).
	const guest = await isOnGuestList(ctx.env.DB, token.athleteId);
	// A person waits for this page: it may use the reserve (feature 024 R5).
	const membership = guest
		? null
		: await isClubMember(ctx, auth, memberClubIds(ctx.env), "interactive");
	if (membership?.kind === "ok" && !membership.value) {
		return refuse("not-member", "not-member-deleted");
	}
	if (membership && membership.kind !== "ok" && !existing) {
		// Inconclusive: a new rider is turned away, an existing one is kept and
		// the daily check decides later (research R4).
		withdraw();
		return notice("strava-busy");
	}

	// One team at a time (feature 044): a new person who rides for another
	// team chooses first, and a switch has that team let them go before this
	// one stores anything (research R1, R3, R6). Guests aren't riders.
	if (!existing && !guest) {
		const elsewhere = await askOtherTeams(ctx, token.athleteId);
		if (elsewhere === null) {
			withdraw();
			return notice("strava-busy");
		}
		if (elsewhere.rider && !expected.switchTeam) {
			withdraw();
			return redirect("/switch-team", 303, [clearOAuthStateCookie()]);
		}
		if (elsewhere.rider && !(await letGoElsewhere(ctx, token.athleteId))) {
			withdraw();
			return notice("strava-busy");
		}
	}

	const now = ctx.now();
	const grant: RiderGrant = {
		firstName: token.firstName,
		scopes,
		scopeReadAll: granted.has("activity:read_all"),
		now,
		guest,
	};
	const credentials = {
		accessToken: token.accessToken,
		refreshToken: token.refreshToken,
		expiresAt: token.expiresAt,
	};
	let startImport: boolean;
	if (!existing) {
		await insertRider(
			ctx.env.DB,
			{ athleteId: token.athleteId, ...grant },
			{
				version,
				revision: currentRevision(ctx.consentVersions).revision,
				acceptedAt: now,
			},
		);
		await saveCredentials(ctx.env, token.athleteId, credentials);
		// A token kept from an earlier refusal here must not be revoked now
		// that this team holds the grant (feature 044 R5).
		await forgetPendingRevocation(ctx.env.DB, token.athleteId);
		// The gateway's copy follows (feature 046 FR-004).
		await queueReport(ctx, token.athleteId);
		startImport = true;
	} else {
		// Reconnect rules (data-model.md). The new token is stored before the
		// grant's time: work that reads the new time finds the new token, and a
		// refusal of the old one doesn't mark the rider (review L-18).
		await saveCredentials(ctx.env, token.athleteId, credentials);
		await updateRiderOnReconnect(ctx.env.DB, token.athleteId, grant);
		if (expected.consentVersion === version) {
			await recordConsent(
				ctx.env.DB,
				token.athleteId,
				version,
				now,
				currentRevision(ctx.consentVersions).revision,
			);
		}
		if (membership?.kind === "ok") {
			await setMembershipChecked(ctx.env.DB, token.athleteId, now);
		}
		if (existing.scopeReadAll && !grant.scopeReadAll) {
			await evaluateChange(ctx, token.athleteId, { kind: "delete-private" });
		}
		startImport =
			(!existing.scopeReadAll && grant.scopeReadAll) ||
			existing.status === "needs_reconnect";
		if (startImport) {
			await setImportStatus(ctx.env.DB, token.athleteId, "pending");
		}
	}
	if (startImport) {
		await ctx.queue.send({
			kind: "import-page",
			athleteId: token.athleteId,
			page: 1,
			after: seasonFetchAfter(ctx.env),
			startedAt: now,
		});
	}

	// A new rider's epoch is the time `insertRider` stored (issue #314).
	const signedIn = {
		athleteId: token.athleteId,
		epoch: existing ? existing.sessionEpoch : now,
	};
	const session = await createSessionCookie(signedIn, now, ctx.env);
	const next = await arrival(sectionNext(expected.next), ctx, signedIn);
	return redirect(next, 302, [clearOAuthStateCookie(), session]);
}
