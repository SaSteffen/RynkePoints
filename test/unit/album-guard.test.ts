import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ReadOnlyError, readOnly } from "../../album/guard";

// The album Worker reads production through this wrapper only (feature 021
// FR-021, contracts/album-worker.md "Read-only guard").

describe("readOnly", () => {
	const db = readOnly(env.DB);

	it.each([
		"SELECT 1",
		"  select count(*) FROM riders",
		"-- a comment\nSELECT 1",
		"/* a block\ncomment */ SELECT 1;",
		"WITH t AS (SELECT 1 AS n) SELECT n FROM t",
		"SELECT 'x; DELETE FROM riders' AS text",
		"SELECT replace(first_name, 'a', 'b') FROM riders",
		"SELECT scopes_updated_at FROM riders",
	])("lets %j through", async (sql) => {
		await expect(db.prepare(sql).all()).resolves.toBeDefined();
	});

	it.each([
		["INSERT INTO team_event_kinds (kind) VALUES ('x')", "INSERT"],
		["UPDATE riders SET first_name = 'x'", "UPDATE"],
		["DELETE FROM riders", "DELETE"],
		["REPLACE INTO team_event_kinds (kind) VALUES ('x')", "REPLACE"],
		["CREATE TABLE t (n)", "CREATE"],
		["DROP TABLE riders", "DROP"],
		["ALTER TABLE riders ADD COLUMN x", "ALTER"],
		["PRAGMA foreign_keys = OFF", "PRAGMA"],
		["-- harmless\nDELETE FROM riders", "DELETE"],
		[
			"WITH gone AS (SELECT athlete_id FROM riders) DELETE FROM riders WHERE athlete_id IN gone",
			"DELETE",
		],
		["SELECT 1; DELETE FROM riders", "DELETE"],
		[
			"WITH t AS (SELECT 1) INSERT INTO team_event_kinds (kind) SELECT 'x'",
			"INSERT",
		],
	])("refuses %j", (sql, word) => {
		expect(() => db.prepare(sql)).toThrow(ReadOnlyError);
		expect(() => db.prepare(sql)).toThrow(word);
	});

	it("refuses exec and dump", async () => {
		await expect(db.exec("SELECT 1")).rejects.toThrow(ReadOnlyError);
		await expect(db.dump()).rejects.toThrow(ReadOnlyError);
	});

	it("refuses sessions, which could carry writes past it", () => {
		expect(() => db.withSession()).toThrow(ReadOnlyError);
	});

	it("runs a batch of guarded statements, bound or not", async () => {
		const [one, two] = await db.batch([
			db.prepare("SELECT ? AS n").bind(1),
			db.prepare("SELECT 2 AS n"),
		]);
		expect(one?.results).toEqual([{ n: 1 }]);
		expect(two?.results).toEqual([{ n: 2 }]);
	});

	it("refuses a batch holding a statement prepared past it", async () => {
		await expect(
			db.batch([db.prepare("SELECT 1"), env.DB.prepare("SELECT 2")]),
		).rejects.toThrow(ReadOnlyError);
	});

	it("answers first, raw and run like D1", async () => {
		const statement = db.prepare("SELECT ? AS n").bind(7);
		expect(await statement.first("n")).toBe(7);
		expect(await statement.raw()).toEqual([[7]]);
		expect((await statement.run()).results).toEqual([{ n: 7 }]);
	});
});
