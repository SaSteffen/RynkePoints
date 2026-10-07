// Applies a change to a rider's activities and stores the result of a full
// evaluation in the same D1 batch, so a reader never sees an activity, its ride
// result and the balance disagree (research R11, FR-014b). Only rows that
// changed are written (research R13).

import type { Ctx } from "../ctx";
import {
	activityOwnersStatement,
	deleteActivityStatement,
	deletePrivateActivitiesStatement,
	listRiderActivitiesStatement,
	upsertActivityStatement,
} from "../db/activities";
import {
	deleteRideResultsStatement,
	readBalanceStatement,
	readRideResultsStatement,
	type StoredBalance,
	type StoredRideResult,
	storedRynke,
	upsertBalanceStatement,
	upsertRideResultsStatement,
} from "../db/rynke";
import type { ActivityRecord } from "../strava/activity";
import { evaluateRides, rideFromRow } from "./rides";
import {
	type CountingWindow,
	CURRENT_RULES,
	countingWindow,
	type RynkeRules,
} from "./rules";
import { type Balance, NO_EXTRAS, tally } from "./tally";

export type ActivityChange =
	| { kind: "none" }
	| { kind: "upsert"; records: ActivityRecord[] }
	| { kind: "delete"; activityIds: number[] }
	| { kind: "delete-private" };

export async function applyAndEvaluate(
	db: D1Database,
	athleteId: number,
	change: ActivityChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): Promise<void> {
	const reads = [
		listRiderActivitiesStatement(db, athleteId),
		readRideResultsStatement(db, athleteId),
		readBalanceStatement(db, athleteId),
	];
	if (change.kind === "upsert") {
		reads.push(
			activityOwnersStatement(
				db,
				change.records.map((r) => r.strava_activity_id),
			),
		);
	}
	const [activityRows, resultRows, balanceRow, ownerRows] =
		await db.batch(reads);
	if (!activityRows || !resultRows || !balanceRow) {
		throw new Error("D1 batch returned too few results");
	}
	const stored = storedRynke(resultRows, balanceRow);

	const activities = new Map<number, ActivityRecord>();
	for (const row of activityRows.results as ActivityRecord[]) {
		activities.set(row.strava_activity_id, row);
	}
	const writes: D1PreparedStatement[] = [];
	switch (change.kind) {
		case "none":
			break;
		case "upsert": {
			const owners = new Map<number, number>();
			for (const row of (ownerRows?.results ?? []) as {
				strava_activity_id: number;
				athlete_id: number;
			}[]) {
				owners.set(row.strava_activity_id, row.athlete_id);
			}
			for (const record of change.records) {
				// The SQL guard leaves another rider's activity alone; so does this.
				const owner = owners.get(record.strava_activity_id) ?? athleteId;
				if (owner !== athleteId || record.athlete_id !== athleteId) continue;
				activities.set(record.strava_activity_id, record);
				writes.push(upsertActivityStatement(db, record));
			}
			break;
		}
		case "delete":
			for (const id of change.activityIds) {
				if (activities.delete(id)) {
					writes.push(deleteActivityStatement(db, athleteId, id));
				}
			}
			break;
		case "delete-private": {
			let removed = false;
			for (const [id, row] of activities) {
				if (row.is_private === 1) {
					activities.delete(id);
					removed = true;
				}
			}
			if (removed) writes.push(deletePrivateActivitiesStatement(db, athleteId));
			break;
		}
	}

	const evaluation = evaluateRides(
		[...activities.values()].map(rideFromRow),
		rules,
		window,
	);
	const balance = tally(evaluation.riding, NO_EXTRAS, rules);

	const before = new Map(stored.results.map((r) => [r.activityId, r]));
	const changed: StoredRideResult[] = [];
	for (const result of evaluation.results) {
		const next = { ...result, rulesVersion: rules.version };
		const previous = before.get(result.activityId);
		before.delete(result.activityId);
		if (!previous || !sameFields(previous, next)) changed.push(next);
	}
	// Results of removed activities go by cascade as well; deleting them here
	// keeps the batch right on its own.
	const gone = [...before.keys()];
	if (gone.length > 0) {
		writes.push(deleteRideResultsStatement(db, athleteId, gone));
	}
	if (changed.length > 0) {
		writes.push(upsertRideResultsStatement(db, athleteId, changed));
	}
	if (!stored.balance || !sameBalance(stored.balance, balance)) {
		writes.push(upsertBalanceStatement(db, athleteId, balance, now));
	}
	if (writes.length > 0) await db.batch(writes);
}

/** `applyAndEvaluate` under the current rules, for the work handlers. */
export function evaluateChange(
	ctx: Ctx,
	athleteId: number,
	change: ActivityChange,
): Promise<void> {
	return applyAndEvaluate(
		ctx.env.DB,
		athleteId,
		change,
		CURRENT_RULES,
		countingWindow(ctx.env, CURRENT_RULES),
		ctx.now(),
	);
}

function sameBalance(stored: StoredBalance, next: Balance): boolean {
	const { computedAt: _computedAt, ...fields } = stored;
	return sameFields(fields, next);
}

/** Field by field; the code lists compare as JSON. */
function sameFields<T extends object>(a: T, b: T): boolean {
	const keys = Object.keys(b) as (keyof T)[];
	return (
		Object.keys(a).length === keys.length &&
		keys.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]))
	);
}
