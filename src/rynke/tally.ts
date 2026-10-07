// The rider's balance from their riding totals and extras (FR-013, FR-013a,
// FR-014a, research R12). Pure and in whole numbers, like `rides.ts`.

import type { RidingSums, RidingTotals } from "./rides";
import { assertValidRules, type RynkeRules } from "./rules";
import {
	type AttendanceEvaluation,
	TEAM_EVENT_KINDS,
	type TeamEventSum,
} from "./team-events";

/**
 * Rynke from outside the rides: Story 3 fills them from team events, with the
 * per-kind breakdown the balance stores; Story 6 adds corrections.
 */
export interface Extras {
	training: number;
	team: number;
	teamEvents: readonly TeamEventSum[];
}

export const NO_EXTRAS: Extras = {
	training: 0,
	team: 0,
	teamEvents: TEAM_EVENT_KINDS.map((kind) => ({
		kind,
		attended: 0,
		team: 0,
		training: 0,
	})),
};

export function extrasFromAttendance(evaluation: AttendanceEvaluation): Extras {
	return {
		training: evaluation.training,
		team: evaluation.team,
		teamEvents: evaluation.byKind,
	};
}

/** The fields of a `rynke_balances` row except `athlete_id` and `computed_at`. */
export interface Balance {
	distanceRynke: number;
	elevationDm: number;
	elevationRynke: number;
	/** 1 … one full step; a total on a step shows the whole next step. */
	elevationToNextStepDm: number;
	trainingRynke: number;
	teamRynke: number;
	trainingMissing: number;
	teamMissing: number;
	trainingWithoutVirtual: number;
	virtualShareMissing: number;
	qualified: boolean;
	rulesVersion: number;
	rulesEffectiveDate: string;
	/** One entry per kind, in `TEAM_EVENT_KINDS` order (research R20). */
	teamEvents: TeamEventSum[];
}

export function tally(
	riding: RidingTotals,
	extras: Extras,
	rules: RynkeRules,
): Balance {
	assertValidRules(rules);
	const stepDm = rules.elevationStepM * 10;
	const trainingRynke = Math.max(0, training(riding) + extras.training);
	const teamRynke = Math.max(0, extras.team);
	// Event and correction Rynke are no virtual rides, so they stay in (R12).
	const trainingWithoutVirtual = Math.max(
		0,
		training(riding.withoutVirtual) + extras.training,
	);
	const required = virtualShareRequired(rules);
	const trainingMissing = Math.max(0, rules.trainingThreshold - trainingRynke);
	const teamMissing = Math.max(0, rules.teamThreshold - teamRynke);
	const virtualShareMissing = Math.max(0, required - trainingWithoutVirtual);
	return {
		distanceRynke: riding.distanceRynke,
		elevationDm: riding.elevationDm,
		elevationRynke: riding.elevationRynke,
		elevationToNextStepDm: stepDm - (riding.elevationDm % stepDm),
		trainingRynke,
		teamRynke,
		trainingMissing,
		teamMissing,
		trainingWithoutVirtual,
		virtualShareMissing,
		qualified:
			trainingMissing === 0 && teamMissing === 0 && virtualShareMissing === 0,
		rulesVersion: rules.version,
		rulesEffectiveDate: rules.effectiveDate,
		teamEvents: extras.teamEvents.map((sum) => ({ ...sum })),
	};
}

/** Training Rynke needed without virtual rides (FR-014a). */
export function virtualShareRequired(rules: RynkeRules): number {
	// 167 by default (research R3); exact, as both operands are small integers.
	const { num, den } = rules.maxVirtualShare;
	return Math.ceil((rules.trainingThreshold * (den - num)) / den);
}

function training(sums: RidingSums): number {
	return sums.distanceRynke + sums.elevationRynke;
}
