import { clubId } from "../config";
import { setMembershipChecked } from "../db/riders";
import { isClubMember } from "../strava/client";
import type { Handler } from "./consumer";
import type { CheckMembershipMessage } from "./messages";

// The daily club check (research R4, FR-004a). Only a definite "not a member"
// deletes; anything inconclusive keeps the rider and is retried or deferred.

export const checkMembership: Handler<CheckMembershipMessage> = async (
	_message,
	rider,
	ctx,
) => {
	const result = await isClubMember(
		ctx,
		{ athleteId: rider.athleteId },
		clubId(ctx.env),
	);
	switch (result.kind) {
		case "ok":
			break;
		case "budget":
		case "transient":
		case "refresh-refused":
			return result;
		default:
			return {
				kind: "transient",
				reason: `GET /athlete/clubs: ${result.kind}`,
			};
	}

	if (result.value) {
		await setMembershipChecked(ctx.env.DB, rider.athleteId, ctx.now());
	} else {
		await ctx.queue.send({
			kind: "delete-rider",
			athleteId: rider.athleteId,
			reason: "left-club",
			revoke: true,
		});
	}
	return { kind: "ok" };
};
