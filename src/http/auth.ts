import { clientId, clubId, seasonStart } from "../config";
import type { Ctx } from "../ctx";
import { deletePrivateActivities } from "../db/activities";
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
import { isClubMember } from "../strava/client";
import { STRAVA_ORIGIN } from "../strava/result";
import { exchangeCode, revokeToken } from "../strava/tokens";
import type { NoticeId } from "./notice";
import { redirect } from "./redirect";
import {
	clearOAuthStateCookie,
	clearSessionCookie,
	createOAuthStateCookie,
	createSessionCookie,
	readOAuthState,
} from "./session";

// Connecting through Strava OAuth (contracts/http-routes.md, research R1, R4).
// Every outcome is a redirect, so a reload never re-submits a used code (R18).

const REQUESTED_SCOPES = "read,activity:read,activity:read_all";

function randomState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleConnect(
	request: Request,
	ctx: Ctx,
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
		await createOAuthStateCookie(state, ctx.now(), ctx.env),
	]);
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
	if (!expected || params.get("state") !== expected) return notice("expired");
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
		now,
	};
	const credentials = {
		accessToken: token.accessToken,
		refreshToken: token.refreshToken,
		expiresAt: token.expiresAt,
	};
	let startImport: boolean;
	if (!existing) {
		await insertRider(ctx.env.DB, { athleteId: token.athleteId, ...grant });
		await saveCredentials(ctx.env, token.athleteId, credentials);
		startImport = true;
	} else {
		// Reconnect rules (data-model.md).
		await updateRiderOnReconnect(ctx.env.DB, token.athleteId, grant);
		await saveCredentials(ctx.env, token.athleteId, credentials);
		if (membership.kind === "ok") {
			await setMembershipChecked(ctx.env.DB, token.athleteId, now);
		}
		if (existing.scopeReadAll && !grant.scopeReadAll) {
			await deletePrivateActivities(ctx.env.DB, token.athleteId);
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
