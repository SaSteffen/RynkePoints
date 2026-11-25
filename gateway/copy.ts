import { DurableObject } from "cloudflare:workers";
import {
	firstRoutingDay,
	type GatewayFigure,
	type RoutingCount,
	routingDay,
	type TeamFigure,
} from "../src/routing/figures";
import { isRouting } from "./routing";

// The routing copy (feature 046 research R1, data-model.md): which teams hold
// which athletes, each team's last full list, and the day counts. One
// SQLite-backed Durable Object, used in the EU jurisdiction (FR-012). It holds
// athlete IDs and team IDs only (FR-010), and nothing here logs either.

export interface RoutingCopyEnv {
	ROUTING_COPY: DurableObjectNamespace<RoutingCopy>;
	/**
	 * "local-only" from the tests and `pnpm dev` alone: workerd has no
	 * jurisdictions, so the local object is a plain one. Never set in
	 * production, which always uses the EU (FR-012).
	 */
	ROUTING_COPY_LOCAL?: string;
}

/** The one instance, in the EU. */
export function copyStub(env: RoutingCopyEnv): DurableObjectStub<RoutingCopy> {
	const namespace =
		env.ROUTING_COPY_LOCAL === "local-only"
			? env.ROUTING_COPY
			: env.ROUTING_COPY.jurisdiction("eu");
	return namespace.get(namespace.idFromName("copy"));
}

export interface Lookup {
	/** The teams the copy lists for the athlete. */
	listed: string[];
	/** The teams whose last full list is recent enough (FR-007). */
	routing: string[];
}

export interface ListResult {
	added: number;
	removed: number;
	/** Added athletes the copy listed under other teams only (FR-022). */
	possible: number;
}

/** One of a team's own counts, as it hands them over. */
export interface OwnCount {
	day: string;
	figure: TeamFigure;
	count: number;
}

const SCHEMA = [
	`CREATE TABLE IF NOT EXISTS copy (
		athlete_id TEXT NOT NULL,
		team TEXT NOT NULL,
		PRIMARY KEY (athlete_id, team)
	) WITHOUT ROWID`,
	`CREATE TABLE IF NOT EXISTS lists (
		team TEXT PRIMARY KEY,
		listed_at INTEGER NOT NULL
	) WITHOUT ROWID`,
	`CREATE TABLE IF NOT EXISTS counts (
		day TEXT NOT NULL,
		team TEXT NOT NULL,
		figure TEXT NOT NULL,
		count INTEGER NOT NULL,
		PRIMARY KEY (day, team, figure)
	) WITHOUT ROWID`,
];

export class RoutingCopy extends DurableObject<unknown> {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: unknown) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		for (const statement of SCHEMA) this.sql.exec(statement);
	}

	lookup(athleteId: string, now: number): Lookup {
		const listed = this.sql
			.exec<{ team: string }>(
				"SELECT team FROM copy WHERE athlete_id = ? ORDER BY team",
				athleteId,
			)
			.toArray()
			.map((row) => row.team);
		const routing = this.sql
			.exec<{ team: string; listed_at: number }>(
				"SELECT team, listed_at FROM lists ORDER BY team",
			)
			.toArray()
			.filter((row) => isRouting(row.listed_at, now))
			.map((row) => row.team);
		return { listed, routing };
	}

	/** Adds to the gateway's own figures of `day`. */
	count(day: string, figures: Partial<Record<GatewayFigure, number>>): void {
		for (const [figure, n] of Object.entries(figures)) {
			if (n) this.add(day, "", figure, n);
		}
	}

	/** A team now holds the athlete, or no longer does (FR-004). */
	report(team: string, athleteId: string, held: boolean): void {
		if (held) {
			this.sql.exec(
				"INSERT OR IGNORE INTO copy (athlete_id, team) VALUES (?, ?)",
				athleteId,
				team,
			);
		} else {
			this.sql.exec(
				"DELETE FROM copy WHERE athlete_id = ? AND team = ?",
				athleteId,
				team,
			);
		}
	}

	/**
	 * Replaces the team's part of the copy with its full list (FR-006) and
	 * counts the corrections (FR-022). The team's first list, before any list
	 * date or after `forget`, fills its part and counts none: nothing was there
	 * to correct. Also drops what departed teams left (FR-009) and counts past
	 * 30 days (FR-026).
	 */
	replaceList(
		team: string,
		athleteIds: readonly string[],
		now: number,
		teams: readonly string[],
	): ListResult {
		return this.ctx.storage.transactionSync(() => {
			const first =
				this.sql.exec("SELECT 1 FROM lists WHERE team = ?", team).toArray()
					.length === 0;
			const current = new Set(
				this.sql
					.exec<{ athlete_id: string }>(
						"SELECT athlete_id FROM copy WHERE team = ?",
						team,
					)
					.toArray()
					.map((row) => row.athlete_id),
			);
			const elsewhere = new Set(
				this.sql
					.exec<{ athlete_id: string }>(
						"SELECT DISTINCT athlete_id FROM copy WHERE team <> ?",
						team,
					)
					.toArray()
					.map((row) => row.athlete_id),
			);
			const next = new Set(athleteIds);
			let added = 0;
			let possible = 0;
			for (const id of next) {
				if (current.has(id)) continue;
				added++;
				if (elsewhere.has(id)) possible++;
			}
			let removed = 0;
			for (const id of current) if (!next.has(id)) removed++;

			this.sql.exec("DELETE FROM copy WHERE team = ?", team);
			for (const id of next) {
				this.sql.exec(
					"INSERT INTO copy (athlete_id, team) VALUES (?, ?)",
					id,
					team,
				);
			}
			this.sql.exec(
				`INSERT INTO lists (team, listed_at) VALUES (?, ?)
				ON CONFLICT (team) DO UPDATE SET listed_at = excluded.listed_at`,
				team,
				now,
			);
			const day = routingDay(now);
			const counted: ListResult = first
				? { added: 0, removed: 0, possible: 0 }
				: { added, removed, possible };
			this.add(day, team, "added", counted.added);
			this.add(day, team, "removed", counted.removed);
			this.add(day, team, "possible", counted.possible);
			this.prune(teams, day);
			return counted;
		});
	}

	/** Empties the copy and every list date (routing `off`, research R2). */
	forget(): void {
		this.sql.exec("DELETE FROM copy");
		this.sql.exec("DELETE FROM lists");
	}

	/**
	 * Takes a team's own counts, replacing what it handed over before for those
	 * days, and returns every count of the last 30 days (research R9).
	 */
	exchange(
		team: string,
		own: readonly OwnCount[],
		today: string,
		teams: readonly string[],
	): RoutingCount[] {
		return this.ctx.storage.transactionSync(() => {
			for (const { day, figure, count } of own) {
				this.sql.exec(
					`INSERT INTO counts (day, team, figure, count) VALUES (?, ?, ?, ?)
					ON CONFLICT (day, team, figure) DO UPDATE SET count = excluded.count`,
					day,
					team,
					figure,
					count,
				);
			}
			this.prune(teams, today);
			return this.sql
				.exec<{ day: string; team: string; figure: string; count: number }>(
					"SELECT day, team, figure, count FROM counts ORDER BY day, team, figure",
				)
				.toArray()
				.map((row) => ({ ...row }) as RoutingCount);
		});
	}

	private add(day: string, team: string, figure: string, n: number): void {
		if (n <= 0) return;
		this.sql.exec(
			`INSERT INTO counts (day, team, figure, count) VALUES (?, ?, ?, ?)
			ON CONFLICT (day, team, figure) DO UPDATE SET count = count + excluded.count`,
			day,
			team,
			figure,
			n,
		);
	}

	/** Departed teams' entries, list dates and counts; counts past 30 days. */
	private prune(teams: readonly string[], today: string): void {
		const kept = JSON.stringify(teams);
		this.sql.exec(
			"DELETE FROM copy WHERE team NOT IN (SELECT value FROM json_each(?))",
			kept,
		);
		this.sql.exec(
			"DELETE FROM lists WHERE team NOT IN (SELECT value FROM json_each(?))",
			kept,
		);
		this.sql.exec(
			"DELETE FROM counts WHERE team <> '' AND team NOT IN (SELECT value FROM json_each(?))",
			kept,
		);
		this.sql.exec("DELETE FROM counts WHERE day < ?", firstRoutingDay(today));
	}
}
