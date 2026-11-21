import { applyD1Migrations, env } from "cloudflare:test";
import { afterEach, beforeEach, vi } from "vitest";

// Runs before every test file. Migrations already applied are skipped, so this
// is cheap after the first file.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Strava IDs leave D1 as text, never as a number, which would round above
// 2^53 (feature 042 research R5). Every query the app runs in any test is
// checked: a result row with a number in an ID column fails it. A test's own
// SQL, which only reads rows back to check them, isn't.
const ID_COLUMN =
	/^(athlete_id|strava_activity_id|overlaps_activity_id|owner_id|recipient_id|administrator_id|changed_by|rider_id|result_id|athleteId|activityId)$/;

function checkRows(rows: unknown): void {
	if (!Array.isArray(rows)) return;
	for (const row of rows) {
		if (typeof row !== "object" || row === null) continue;
		for (const [column, value] of Object.entries(row)) {
			if (ID_COLUMN.test(column) && typeof value === "number") {
				throw new Error(
					`D1 returned ${column} as a number: select CAST(… AS TEXT) AS ${column}`,
				);
			}
		}
	}
}

/** SQL prepared outside `test/`: by the app, the fake Strava or the album. */
const APP_SQL = Symbol.for("rynke.d1-id-guard.app-sql");
const globals = globalThis as Record<symbol, Set<string> | undefined>;
globals[APP_SQL] ??= new Set<string>();
const appSql = globals[APP_SQL];

/** Whether the code that called `prepare` lives outside `test/`. */
function preparedByApp(): boolean {
	const caller = new Error().stack
		?.split("\n")
		.slice(1)
		.find((line) => !line.includes("test/setup.ts"));
	return caller !== undefined && !caller.includes("/test/");
}

const sqlOf = (s: D1PreparedStatement) =>
	(s as unknown as { statement: string }).statement;

function checkStatement(s: D1PreparedStatement, rows: unknown): void {
	if (appSql.has(sqlOf(s))) checkRows(rows);
}

const statement = Object.getPrototypeOf(env.DB.prepare("SELECT 1"));
const GUARDED = Symbol.for("rynke.d1-id-guard");
if (!statement[GUARDED]) {
	statement[GUARDED] = true;
	const database = Object.getPrototypeOf(env.DB);
	const { prepare, batch } = database;
	database.prepare = function (this: D1Database, sql: string) {
		if (preparedByApp()) appSql.add(sql);
		return prepare.call(this, sql);
	};
	const { first, all, run } = statement;
	statement.first = async function (
		this: D1PreparedStatement,
		column?: string,
	) {
		const row = await first.call(this, column);
		checkStatement(this, [column === undefined ? row : { [column]: row }]);
		return row;
	};
	for (const [name, original] of [
		["all", all],
		["run", run],
	] as const) {
		statement[name] = async function (this: D1PreparedStatement) {
			const result = await original.call(this);
			checkStatement(this, result.results);
			return result;
		};
	}
	database.batch = async function (
		this: D1Database,
		statements: D1PreparedStatement[],
	) {
		const results = await batch.call(this, statements);
		results.forEach((result: D1Result, i: number) => {
			const s = statements[i];
			if (s) checkStatement(s, result.results);
		});
		return results;
	};
}

// No test may reach the network (constitution Principle V). Every test starts
// with a deny-all fetch; installFakeStrava() takes over the same spy. Blocked
// calls fail the test even if the code under test swallowed the error.
const blocked: string[] = [];

beforeEach(() => {
	blocked.length = 0;
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		const url = new Request(input, init).url;
		blocked.push(url);
		throw new Error(`Tests must not make network requests: ${url}`);
	});
});

afterEach(() => {
	if (vi.isMockFunction(globalThis.fetch)) {
		vi.mocked(globalThis.fetch).mockRestore();
	}
	if (blocked.length > 0) {
		throw new Error(`Unexpected network request(s): ${blocked.join(", ")}`);
	}
});
