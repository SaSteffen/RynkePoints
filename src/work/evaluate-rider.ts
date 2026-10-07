import { evaluateChange } from "../rynke/apply";
import type { Handler } from "./consumer";
import type { EvaluateRiderMessage } from "./messages";

// A full Rynke evaluation of the rider's stored activities
// (feature 003 contracts/queue-messages.md). No Strava request, so no budget
// check; a second run writes nothing.

export const evaluateRider: Handler<EvaluateRiderMessage> = async (
	_message,
	rider,
	ctx,
) => {
	await evaluateChange(ctx, rider.athleteId, { kind: "none" });
	return { kind: "ok" };
};
