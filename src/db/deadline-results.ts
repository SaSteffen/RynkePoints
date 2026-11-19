import { listedRiderFilter } from "./organiser";

// Each listed rider's result when the qualification deadline had passed
// (review L-12, feature 016 data-model.md): whether they qualified and both
// totals, kept for the organisers so a later change shows as a difference.

/** A rider's result at the deadline `deadline` (`YYYY-MM-DD`). */
export interface DeadlineResult {
	deadline: string;
	qualified: boolean;
	training: number;
	team: number;
}

/**
 * The statements of the daily run: delete the results of any other deadline
 * (last season's), and, once `deadline` has passed (`passed`), record every
 * listed rider's stored balance, a rider without one as 0 and not qualified.
 * Only while no rider has a result for this deadline yet, so the results stay
 * the day's and not those of a later reading, and a rider who connects after
 * it has none.
 */
export function recordDeadlineResultsStatements(
	db: D1Database,
	deadline: string,
	passed: boolean,
): D1PreparedStatement[] {
	return [
		db
			.prepare("DELETE FROM deadline_results WHERE deadline <> ?")
			.bind(deadline),
		...(passed
			? [
					db
						.prepare(
							`INSERT INTO deadline_results
								(athlete_id, deadline, qualified, training_rynke, team_rynke)
							SELECT r.athlete_id, ?1, COALESCE(b.qualified, 0),
								COALESCE(b.training_rynke, 0), COALESCE(b.team_rynke, 0)
							FROM riders r
							LEFT JOIN rynke_balances b ON b.athlete_id = r.athlete_id
							WHERE ${listedRiderFilter("r")}
								AND NOT EXISTS (
									SELECT 1 FROM deadline_results WHERE deadline = ?1)`,
						)
						.bind(deadline),
				]
			: []),
	];
}
