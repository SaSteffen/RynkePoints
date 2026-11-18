import { deleteRider as deleteRiderRows } from "../db/riders";
import { withdrawStoredGrant } from "../strava/withdraw";
import type { Handler } from "./consumer";
import type { DeleteRiderMessage } from "./messages";

// Removes a rider and everything they own (contracts/queue-messages.md,
// FR-022). The withdrawal keeps the stored refresh token without refreshing
// first, so it also works for `needs_reconnect` riders, and settles it later
// if it can't now (feature 041 R14). Deletion always completes at once.

export const deleteRider: Handler<DeleteRiderMessage> = async (
	message,
	rider,
	ctx,
) => {
	if (message.revoke) {
		// Unless another team holds them; kept and settled later if that isn't
		// known yet (feature 041 R14).
		await withdrawStoredGrant(ctx, rider.athleteId);
	}
	await deleteRiderRows(ctx.env.DB, rider.athleteId);
	return { kind: "ok" };
};
