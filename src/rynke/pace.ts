// The even pace and the rider status (feature 016 FR-030, FR-021, FR-032,
// research R4): one rule for the viewer's quote list and the organiser groups,
// so a rider in "Need a push" always gets a push quote. Pure; dates are
// `YYYY-MM-DD` strings in Europe/Berlin.

import type { CountingWindow, RynkeRules } from "./rules";
import { type Balance, virtualShareRequired } from "./tally";
import { dayNumber } from "./weeks";

export type RiderStatus = "push" | "on_track" | "in";

/** ⌊amount × days since the season start ÷ days of the season⌋, within 0…amount. */
export function evenPace(
	amount: number,
	seasonStart: string,
	deadline: string,
	day: string,
): number {
	const total = dayNumber(deadline) - dayNumber(seasonStart);
	if (total <= 0) return amount;
	const elapsed = dayNumber(day) - dayNumber(seasonStart);
	return Math.min(amount, Math.max(0, Math.floor((amount * elapsed) / total)));
}

/**
 * `in` when the stored balance qualifies; `push` when any of Training, Team and
 * outdoor Training is below its even pace, or without a running deadline;
 * otherwise `on_track`. No balance counts as `push`.
 */
export function riderStatus(
	balance: Balance | null,
	rules: RynkeRules,
	window: CountingWindow,
	today: string,
): RiderStatus {
	if (balance?.qualified) return "in";
	const { seasonStart, deadline } = window;
	if (balance === null || deadline === null || today > deadline) return "push";
	const behind = (value: number, amount: number) =>
		value < evenPace(amount, seasonStart, deadline, today);
	return behind(balance.trainingRynke, rules.trainingThreshold) ||
		behind(balance.teamRynke, rules.teamThreshold) ||
		behind(balance.trainingWithoutVirtual, virtualShareRequired(rules))
		? "push"
		: "on_track";
}
