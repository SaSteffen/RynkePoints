import { deleteRider as deleteRiderRows, getCredentials } from "../db/riders";
import { queueReport } from "../routing/report";
import { getAccessToken } from "../strava/tokens";
import { withdrawStoredGrant } from "../strava/withdraw";
import type { Handler } from "./consumer";
import type { DeleteRiderMessage } from "./messages";

// Removes a rider and everything they own (contracts/queue-messages.md,
// FR-022). The withdrawal keeps the stored refresh token without refreshing
// first, so it also works for `needs_reconnect` riders, and settles it later
// if it can't now (feature 041 R14). A deauthorization asks Strava first; any
// other deletion completes at once.

export const deleteRider: Handler<DeleteRiderMessage> = async (
	message,
	rider,
	ctx,
) => {
	if (message.reason === "deauthorized") {
		// Strava signs no event, so one refresh asks Strava: a grant it still
		// renews was never withdrawn, and the event wasn't Strava's (review
		// L-05). Like a revocation, it doesn't wait behind a backlog.
		const before = await getCredentials(ctx.env, rider.athleteId);
		const grant = await getAccessToken(ctx, rider.athleteId, {
			force: true,
			priority: "interactive",
		});
		if (grant.kind === "ok") {
			console.warn(
				`Deauthorization for athlete ${rider.athleteId} ignored: Strava still renews the grant`,
			);
			return { kind: "ok" };
		}
		if (grant.kind !== "refresh-refused") {
			// Retried; the last attempt deletes anyway (Principle I).
			return { kind: "transient", reason: `grant check: ${grant.kind}` };
		}
		// Strava also refuses a refresh token another refresh has just renewed
		// (a drain item, a recheck): then the grant is alive after all.
		const after = await getCredentials(ctx.env, rider.athleteId);
		if (after && after.refreshToken !== before?.refreshToken) {
			console.warn(
				`Deauthorization for athlete ${rider.athleteId} ignored: the grant was renewed meanwhile`,
			);
			return { kind: "ok" };
		}
	}
	if (message.revoke) {
		// Unless another team holds them; kept and settled later if that isn't
		// known yet (feature 041 R14).
		await withdrawStoredGrant(ctx, rider.athleteId);
	}
	await deleteRiderRows(ctx.env.DB, rider.athleteId);
	await queueReport(ctx, rider.athleteId);
	return { kind: "ok" };
};
