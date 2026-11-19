// Corrections as organisers add or remove them (feature 014 research R8),
// and the re-evaluation of their rider, in one batch. The evaluation itself
// is `reevaluate.ts`'s.

import { badges as badgesOn } from "../config";
import type { Ctx } from "../ctx";
import {
	type CorrectionFields,
	deleteCorrectionStatement,
	insertCorrectionStatement,
	readCorrectionStatement,
} from "../db/corrections";
import { riderStatusesStatement } from "../db/team-events";
import { hasTeamRynke } from "../teams";
import { notifyRiders } from "../work/send-notification";
import { teamBadgeNews } from "../work/team-badge-news";
import {
	BADGE_NEWS_ON,
	type BadgeNewsSwitch,
	type RiderState,
	readRiders,
	reevaluate,
	storeEvaluated,
	withCurrentRiders,
} from "./reevaluate";
import {
	type CountingWindow,
	countingWindow,
	currentRules,
	inCountingWindow,
	isCalendarDate,
	type RynkeRules,
} from "./rules";

/** A correction as an organiser enters it; checked before anything is read. */
export interface CorrectionInput {
	training: number;
	team: number;
	reason: string;
	date: string;
}

/** `by` is the organiser adding it (feature 014 FR-040). */
export type CorrectionChange =
	| {
			kind: "add-correction";
			athleteId: number;
			correction: CorrectionInput;
			by: number;
	  }
	| { kind: "remove-correction"; correctionId: number };

export interface CorrectionResult {
	athleteId: number;
	rose: boolean;
	/** The rider's new personal badges, catalog order (feature 013 R17). */
	badges: string[];
}

/** The refusal codes of feature 014 research R8; nothing was written. */
export class CorrectionRefused extends Error {
	readonly code:
		| "invalid_amount"
		| "invalid_reason"
		| "invalid_date"
		| "outside_season"
		| "correction_missing"
		| "rider_not_connected";

	constructor(code: CorrectionRefused["code"]) {
		super(`correction change refused: ${code}`);
		this.name = "CorrectionRefused";
		this.code = code;
	}
}

/**
 * Adds or removes a correction and re-evaluates its rider in one batch, as
 * `applyTeamEventChange` does (feature 014 research R8). Refusals throw
 * `CorrectionRefused` before anything is written. `athleteId` is the
 * correction's rider.
 */
export async function applyCorrectionChange(
	db: D1Database,
	change: CorrectionChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
	news: BadgeNewsSwitch = BADGE_NEWS_ON,
): Promise<CorrectionResult> {
	return withCurrentRiders(() =>
		storeCorrectionChange(db, change, rules, window, now, news),
	);
}

/** One try of `applyCorrectionChange`. */
async function storeCorrectionChange(
	db: D1Database,
	change: CorrectionChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
	news: BadgeNewsSwitch,
): Promise<CorrectionResult> {
	let athleteId: number;
	let statement: D1PreparedStatement;
	let edit: (state: RiderState) => void;
	const extraReads: D1PreparedStatement[] = [];
	if (change.kind === "add-correction") {
		const correction = validCorrection(change.correction, window);
		athleteId = change.athleteId;
		statement = insertCorrectionStatement(
			db,
			athleteId,
			correction,
			change.by,
			now,
		);
		edit = (state) => {
			state.corrections.push({
				correctionId: 0,
				training: correction.training,
				team: correction.team,
				date: correction.date,
			});
		};
		extraReads.push(riderStatusesStatement(db, [athleteId]));
	} else {
		const { correctionId } = change;
		const stored = await readCorrectionStatement(db, correctionId).first<{
			athlete_id: number;
		}>();
		if (!stored) throw new CorrectionRefused("correction_missing");
		athleteId = stored.athlete_id;
		statement = deleteCorrectionStatement(db, correctionId);
		edit = (state) => {
			state.corrections = state.corrections.filter(
				(c) => c.correctionId !== correctionId,
			);
		};
	}

	const {
		riders,
		extra: [statusRows],
	} = await readRiders(db, [athleteId], extraReads);
	if (
		statusRows &&
		(statusRows.results as { status: string }[])[0]?.status !== "connected"
	) {
		throw new CorrectionRefused("rider_not_connected");
	}
	const result = reevaluate(
		db,
		athleteId,
		riders.get(athleteId) as RiderState,
		rules,
		window,
		now,
		news,
		edit,
	);
	await storeEvaluated(db, riders, [statement, ...result.writes]);
	return { athleteId, rose: result.rose, badges: result.badges };
}

/**
 * `applyCorrectionChange` under the current rules, for the organiser pages:
 * a rise or a new badge notifies the rider, and a new team badge the listed
 * riders, as `teamEventChange` does. A correction is the rider's alone, so no
 * `evaluate-rider` follows: an activity event stored meanwhile makes the
 * change start again from it (review L-18).
 */
export async function correctionChange(
	ctx: Ctx,
	change: CorrectionChange,
): Promise<CorrectionResult> {
	// Without Team Rynke a correction can't give any (feature 039 research R6).
	if (
		change.kind === "add-correction" &&
		change.correction.team !== 0 &&
		!hasTeamRynke(ctx.team)
	) {
		throw new CorrectionRefused("invalid_amount");
	}
	const result = await applyCorrectionChange(
		ctx.env.DB,
		change,
		currentRules(ctx.team.rules),
		countingWindow(ctx.env),
		ctx.now(),
		{ badges: badgesOn(ctx.env) },
	);
	const team = await teamBadgeNews(
		ctx,
		result.badges.length > 0 ? [result.athleteId] : [],
	);
	const own = result.rose || result.badges.length > 0 ? [result.athleteId] : [];
	await notifyRiders(
		ctx,
		[...new Set([...own, ...team])].sort((a, b) => a - b),
	);
	return result;
}

/** The bounds of the `corrections` table (data-model.md, R8). */
const MAX_AMOUNT = 10000;

/**
 * The fields of a correction, or why it is refused. Its date has to lie in the
 * qualification window, the only days that count, as a team event's does
 * (review L-02).
 */
function validCorrection(
	correction: CorrectionInput,
	window: CountingWindow,
): CorrectionFields {
	const { training, team } = correction;
	if (
		![training, team].every(
			(n) => Number.isInteger(n) && Math.abs(n) <= MAX_AMOUNT,
		) ||
		(training === 0 && team === 0)
	) {
		throw new CorrectionRefused("invalid_amount");
	}
	const reason = correction.reason.trim();
	// Characters as SQLite's length() counts them.
	const length = [...reason].length;
	if (length < 1 || length > 200) {
		throw new CorrectionRefused("invalid_reason");
	}
	if (!isCalendarDate(correction.date)) {
		throw new CorrectionRefused("invalid_date");
	}
	if (!inCountingWindow(correction.date, window)) {
		throw new CorrectionRefused("outside_season");
	}
	return { training, team, reason, date: correction.date };
}
