import { returnVia, verifyToken } from "../config";
import { decryptToken } from "../crypto/encrypt";
import type { Ctx } from "../ctx";
import {
	dropPendingRevocation,
	getPendingRevocation,
	keepStoredToken,
	keepToken,
	listPendingRevocationIds,
} from "../db/pending-revocations";
import { isOneOf } from "../work/messages";
import { idJson } from "./id";
import { revokeToken } from "./tokens";

// Withdrawing a person's grant at Strava (feature 041 FR-009, research R14,
// contracts/withdrawal.md). Every team shares one Strava app, and one revoke
// ends the grant at every team. So a team that lets someone go, or turns them
// away, revokes only once no other team holds them, and keeps the token,
// encrypted, until it knows: no grant is left that no team controls.

export const HOLDS = ["connected", "reconnect", "none"] as const;
export type Hold = (typeof HOLDS)[number];

/** How a withdrawal stands: settled, or kept to be asked again later. */
export type Withdrawal = "done" | "pending";

type WithdrawCtx = Pick<Ctx, "env" | "now" | "team" | "stravaAction">;

const GATEWAY_TIMEOUT_MS = 10_000;

/** Withdraws a token just exchanged at a refused sign-in. */
export async function withdrawGrant(
	ctx: WithdrawCtx,
	athleteId: string,
	refreshToken: string,
): Promise<Withdrawal> {
	await keepToken(ctx.env, athleteId, refreshToken, ctx.now());
	return settleWithdrawal(ctx, athleteId);
}

/**
 * Withdraws a rider's stored token. Call it before deleting the rider's rows,
 * which take the stored token with them. Nothing stored: nothing to withdraw.
 */
export async function withdrawStoredGrant(
	ctx: WithdrawCtx,
	athleteId: string,
): Promise<Withdrawal> {
	if (!(await keepStoredToken(ctx.env.DB, athleteId, ctx.now()))) {
		return "done";
	}
	return settleWithdrawal(ctx, athleteId);
}

/** Settles one kept token: drops it, revokes it, or keeps it for later. */
export async function settleWithdrawal(
	ctx: WithdrawCtx,
	athleteId: string,
): Promise<Withdrawal> {
	const row = await getPendingRevocation(ctx.env.DB, athleteId);
	if (!row) return "done";
	const hold = (await askOtherTeams(ctx, athleteId))?.held ?? null;
	if (hold === null || hold === "reconnect") return "pending";
	if (hold === "none") {
		let token: string;
		try {
			token = await decryptToken(
				row.refreshTokenEnc,
				ctx.env.TOKEN_ENCRYPTION_KEY,
			);
		} catch {
			// Undecryptable (the key changed): it can't be revoked, ever.
			console.warn(`Withdrawal for athlete ${athleteId}: token unreadable`);
			await dropPendingRevocation(ctx.env.DB, row);
			return "done";
		}
		const revoked = await revokeToken(ctx, token);
		if (revoked.kind !== "ok") return "pending";
	}
	// Revoked, or another team holds them with a working connection and
	// withdraws the grant when it lets them go.
	await dropPendingRevocation(ctx.env.DB, row);
	return "done";
}

/** The daily run: every token still kept. */
export async function settleWithdrawals(ctx: WithdrawCtx): Promise<void> {
	for (const athleteId of await listPendingRevocationIds(ctx.env.DB)) {
		await settleWithdrawal(ctx, athleteId);
	}
}

/** Another team's hold on a person, through the gateway (feature 044 R2). */
export interface HeldElsewhere {
	held: Hold;
	/** Held as a rider, not a guest. */
	rider: boolean;
}

/**
 * Whether another team holds the person, and as a rider, asked through the
 * gateway; `null` when it didn't answer. Without a gateway there is no other
 * team. An answer without `rider` (a gateway on the previous release) counts
 * as no rider.
 */
export async function askOtherTeams(
	ctx: WithdrawCtx,
	athleteId: string,
): Promise<HeldElsewhere | null> {
	const body = await askGateway(ctx, "held", athleteId);
	if (body === null) return returnVia(ctx.env) === null ? NOBODY : null;
	const { held, rider } = body as { held?: unknown; rider?: unknown };
	return isOneOf(HOLDS, held) ? { held, rider: rider === true } : null;
}

const NOBODY: HeldElsewhere = { held: "none", rider: false };

/**
 * Has every other team let the person go as a rider, because they chose to
 * switch here (feature 044 R4); false when that isn't confirmed. Without a
 * gateway there is nobody to let them go.
 */
export async function letGoElsewhere(
	ctx: WithdrawCtx,
	athleteId: string,
): Promise<boolean> {
	if (returnVia(ctx.env) === null) return true;
	const body = await askGateway(ctx, "let-go", athleteId);
	return (body as { letGo?: unknown } | null)?.letGo === true;
}

/** The gateway's `200` answer at `/teams/<id>/<what>`, or `null`. */
async function askGateway(
	ctx: WithdrawCtx,
	what: "held" | "let-go",
	athleteId: string,
): Promise<unknown> {
	const gateway = returnVia(ctx.env);
	if (gateway === null) return null;
	try {
		const res = await fetch(new URL(`/teams/${ctx.team.id}/${what}`, gateway), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${verifyToken(ctx.env)}`,
				"Content-Type": "application/json",
			},
			// A number, exactly, as the gateway reads it (feature 042 R3).
			body: JSON.stringify({ athleteId: idJson(athleteId) }),
			signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
			redirect: "manual",
		});
		if (!res.ok) {
			await res.body?.cancel();
			return null;
		}
		return await res.json();
	} catch {
		return null;
	}
}
