// Applies a change to a rider's activities, rides, runs or swims, and stores
// it with the rider's re-evaluation in one batch (research R11). The
// evaluation itself is `reevaluate.ts`'s.

import { badges as badgesOn } from "../config";
import type { Ctx } from "../ctx";
import {
	activityOwnersStatement,
	deleteActivityStatement,
	deletePrivateActivitiesStatement,
	upsertActivityStatement,
} from "../db/activities";
import {
	deletePrivateRunsStatement,
	deleteRunStatement,
	runOwnersStatement,
	upsertRunStatement,
} from "../db/runs";
import {
	deletePrivateSwimsStatement,
	deleteSwimStatement,
	swimOwnersStatement,
	upsertSwimStatement,
} from "../db/swims";
import type { ActivityRecord, RunRecord, SwimRecord } from "../strava/activity";
import {
	BADGE_NEWS_ON,
	type BadgeNewsSwitch,
	type Reevaluation,
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
	type RynkeRules,
} from "./rules";

/**
 * `runs` are outdoor runs and `swims` swims (feature 013); an activity id is
 * stored as a ride, a run or a swim, so upserting it as one removes it as the
 * others. `delete` and `delete-private` remove runs and swims as well as
 * rides.
 */
export type ActivityChange =
	| { kind: "none" }
	| {
			kind: "upsert";
			records: ActivityRecord[];
			runs?: RunRecord[];
			swims?: SwimRecord[];
	  }
	| { kind: "delete"; activityIds: number[] }
	| { kind: "delete-private" };

/** What an activity change did to the rider. */
export type ActivityResult = Omit<Reevaluation, "writes">;

export async function applyAndEvaluate(
	db: D1Database,
	athleteId: number,
	change: ActivityChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
	news: BadgeNewsSwitch = BADGE_NEWS_ON,
): Promise<ActivityResult> {
	const ids =
		change.kind === "upsert"
			? [
					...change.records,
					...(change.runs ?? []),
					...(change.swims ?? []),
				].map((r) => r.strava_activity_id)
			: [];
	const ownerReads =
		change.kind === "upsert"
			? [
					activityOwnersStatement(db, ids),
					runOwnersStatement(db, ids),
					swimOwnersStatement(db, ids),
				]
			: [];
	return withCurrentRiders(async () => {
		const { riders, extra } = await readRiders(db, [athleteId], ownerReads);
		const owners = new Map<number, number>();
		for (const row of extra.flatMap((rows) => rows.results) as {
			strava_activity_id: number;
			athlete_id: number;
		}[]) {
			owners.set(row.strava_activity_id, row.athlete_id);
		}
		const changes: D1PreparedStatement[] = [];
		const { writes, ...result } = reevaluate(
			db,
			athleteId,
			riders.get(athleteId) as RiderState,
			rules,
			window,
			now,
			news,
			(state) => {
				changes.push(...changeWrites(db, athleteId, state, change, owners));
			},
		);
		await storeEvaluated(db, riders, [...changes, ...writes]);
		return result;
	});
}

/**
 * Applies `change` to the rider's state, and the writes that store it.
 * `owners` maps an upserted activity id to the rider it is stored for.
 */
function changeWrites(
	db: D1Database,
	athleteId: number,
	{ activities, runs, swims }: RiderState,
	change: ActivityChange,
	owners: Map<number, number>,
): D1PreparedStatement[] {
	const writes: D1PreparedStatement[] = [];
	/** Removes the activity as a ride, run or swim, but as `keep`. */
	const remove = (id: number, keep?: "ride" | "run" | "swim") => {
		if (keep !== "ride" && activities.delete(id)) {
			writes.push(deleteActivityStatement(db, athleteId, id));
		}
		if (keep !== "run" && runs.delete(id)) {
			writes.push(deleteRunStatement(db, athleteId, id));
		}
		if (keep !== "swim" && swims.delete(id)) {
			writes.push(deleteSwimStatement(db, athleteId, id));
		}
	};
	/** Removes the private ones; whether there were any. */
	const removePrivate = (rows: Map<number, { is_private: number }>) => {
		let removed = false;
		for (const [id, row] of rows) {
			if (row.is_private === 1) {
				rows.delete(id);
				removed = true;
			}
		}
		return removed;
	};
	switch (change.kind) {
		case "none":
			break;
		case "upsert": {
			// The SQL guards leave another rider's activity alone; so does this.
			const own = (r: { strava_activity_id: number; athlete_id: number }) =>
				r.athlete_id === athleteId &&
				(owners.get(r.strava_activity_id) ?? athleteId) === athleteId;
			for (const record of change.records.filter(own)) {
				activities.set(record.strava_activity_id, record);
				writes.push(upsertActivityStatement(db, record));
				remove(record.strava_activity_id, "ride");
			}
			for (const run of (change.runs ?? []).filter(own)) {
				runs.set(run.strava_activity_id, run);
				writes.push(upsertRunStatement(db, run));
				remove(run.strava_activity_id, "run");
			}
			for (const swim of (change.swims ?? []).filter(own)) {
				swims.set(swim.strava_activity_id, swim);
				writes.push(upsertSwimStatement(db, swim));
				remove(swim.strava_activity_id, "swim");
			}
			break;
		}
		case "delete":
			for (const id of change.activityIds) remove(id);
			break;
		case "delete-private":
			if (removePrivate(activities)) {
				writes.push(deletePrivateActivitiesStatement(db, athleteId));
			}
			if (removePrivate(runs)) {
				writes.push(deletePrivateRunsStatement(db, athleteId));
			}
			if (removePrivate(swims)) {
				writes.push(deletePrivateSwimsStatement(db, athleteId));
			}
			break;
	}
	return writes;
}

/** `applyAndEvaluate` under the current rules, for the work handlers. */
export function evaluateChange(
	ctx: Ctx,
	athleteId: number,
	change: ActivityChange,
): Promise<ActivityResult> {
	return applyAndEvaluate(
		ctx.env.DB,
		athleteId,
		change,
		currentRules(ctx.team.rules),
		countingWindow(ctx.env),
		ctx.now(),
		{ badges: badgesOn(ctx.env) },
	);
}
