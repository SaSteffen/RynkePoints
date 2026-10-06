import { deleteRider as deleteRiderRows } from "../db/riders";
import { revokeStoredToken } from "../strava/tokens";
import type { Handler } from "./consumer";
import type { DeleteRiderMessage } from "./messages";

// Removes a rider and everything they own (contracts/queue-messages.md,
// FR-022). The revoke uses the stored refresh token without refreshing first,
// so it also works for `needs_reconnect` riders. Deletion always completes:
// on the last attempt it goes ahead even if Strava never answered.

export const deleteRider: Handler<DeleteRiderMessage> = async (
	message,
	rider,
	ctx,
	attempt,
) => {
	if (message.revoke) {
		const revoked = await revokeStoredToken(ctx, rider.athleteId);
		if (revoked.kind === "transient" && !attempt.isLastAttempt) {
			return revoked;
		}
	}
	await deleteRiderRows(ctx.env.DB, rider.athleteId);
	return { kind: "ok" };
};
