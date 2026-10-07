import { clientId, clubId, seasonStart } from "../config";
import { CONSENT_VERSION } from "../consent";
import type { Ctx } from "../ctx";
import { recordConsent } from "../db/consents";
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
import { evaluateChange } from "../rynke/apply";
import { isClubMember } from "../strava/client";
import { STRAVA_ORIGIN } from "../strava/result";
import { exchangeCode, revokeToken } from "../strava/tokens";
import { forbidden } from "./errors";
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

// `activity:write` is requested but optional, and never used in this feature
// (FR-003): the description feature will only write for riders who granted it.
const REQUESTED_SCOPES = "read,activity:read,activity:read_all,activity:write";

function randomState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorizeRedirect(
	request: Request,
	ctx: Ctx,
	consentVersion: number,
): Promise<Response> {
	const state = randomState();
	const authorize = new URL(`${STRAVA_ORIGIN}/oauth/authorize`);
	authorize.search = new URLSearchParams({
		client_id: clientId(ctx.env),
		redirect_uri: `${new URL(request.url).origin}/auth/callback`,
		response_type: "code",
		approval_prompt: "force",
		scope: REQUESTED_SCOPES,
		state,
	}).toString();
	return redirect(authorize.href, 302, [
		await createOAuthStateCookie(state, consentVersion, ctx.now(), ctx.env),
	]);
}

/** `POST /connect`: the consent form on the landing page. */
export async function handleConnectForm(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	if (!isSameOrigin(request)) return forbidden(i18n, "/");
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		form = new FormData();
	}
	if (form.get("consent") !== String(CONSENT_VERSION)) {
		return redirect("/notice/consent-required", 303);
	}
	return authorizeRedirect(request, ctx, CONSENT_VERSION);
}

/** `GET /connect`: reconnecting or changing permissions, signed in only. */
export async function handleReconnect(
	request: Request,
	ctx: Ctx,
): Promise<Response> {
	const athleteId = await readSession(request, ctx.env, ctx.now());
	if (athleteId === null || !(await getRider(ctx.env.DB, athleteId))) {
		return redirect("/", 302);
	}
	return authorizeRedirect(request, ctx, 0);
}

function notice(id: NoticeId, cookies: string[] = []): Response {
	return redirect(`/notice/${id}`, 303, [clearOAuthStateCookie(), ...cookies]);
}

export async function handleCallback(
	request: Request,
	ctx: Ctx,
): Promise<Response> {
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
	if (exchange.kind !== "ok") return notice("failed");
	const token = exchange.value;
	const auth = { accessToken: token.accessToken };
	const existing = await getRider(ctx.env.DB, token.athleteId);

	// Turns the rider away; an existing rider loses everything (FR-004, FR-006).
	const refuse = async (id: NoticeId, deletedId: NoticeId) => {
		await revokeToken(ctx, token.accessToken);
		if (!existing) return notice(id);
		await deleteRider(ctx.env.DB, token.athleteId);
		return notice(deletedId, [clearSessionCookie()]);
	};

	const scopes = token.scope ?? params.get("scope") ?? "";
	const granted = new Set(scopes.split(/[\s,]+/));
	if (!granted.has("read") || !granted.has("activity:read")) {
		return refuse("denied", "denied-deleted");
	}

	// A new athlete who didn't agree on the way in is never stored (R21).
	if (!existing && expected.consentVersion !== CONSENT_VERSION) {
		await revokeToken(ctx, token.accessToken);
		return notice("consent-required");
	}

	const membership = await isClubMember(ctx, auth, clubId(ctx.env));
	if (membership.kind === "ok" && !membership.value) {
		return refuse("not-member", "not-member-deleted");
	}
	if (membership.kind !== "ok" && !existing) {
		// Inconclusive: a new rider is turned away, an existing one is kept and
		// the daily check decides later (research R4).
		await revokeToken(ctx, token.accessToken);
		return notice("strava-busy");
	}

	const now = ctx.now();
	const grant: RiderGrant = {
		firstName: token.firstName,
		scopes,
		scopeReadAll: granted.has("activity:read_all"),
		scopeWrite: granted.has("activity:write"),
		now,
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
			{ version: CONSENT_VERSION, acceptedAt: now },
		);
		await saveCredentials(ctx.env, token.athleteId, credentials);
		startImport = true;
	} else {
		// Reconnect rules (data-model.md). A change of write access alone starts
		// no import and deletes nothing.
		await updateRiderOnReconnect(ctx.env.DB, token.athleteId, grant);
		if (expected.consentVersion === CONSENT_VERSION) {
			await recordConsent(ctx.env.DB, token.athleteId, CONSENT_VERSION, now);
		}
		await saveCredentials(ctx.env, token.athleteId, credentials);
		if (membership.kind === "ok") {
			await setMembershipChecked(ctx.env.DB, token.athleteId, now);
		}
		if (existing.scopeReadAll && !grant.scopeReadAll) {
			await evaluateChange(ctx, token.athleteId, { kind: "delete-private" });
			// Re-derives from the final state if a consumer message for the rider
			// wrote from an older snapshot meanwhile (feature 003 research R11).
			await ctx.queue.send({
				kind: "evaluate-rider",
				athleteId: token.athleteId,
			});
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
			after: seasonStart(ctx.env),
		});
	}

	return redirect("/me", 302, [
		clearOAuthStateCookie(),
		await createSessionCookie(token.athleteId, now, ctx.env),
	]);
}
