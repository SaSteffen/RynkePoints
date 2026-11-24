// The seeded local database as SQL for D1, for scripts/sandbox-seed.sh.
//
//   node scripts/sandbox-export.mjs <file.sqlite>   prints the SQL
//
// The same statements as `wrangler d1 export --local`, but with exact integers:
// Miniflare's export reads every value as a JavaScript number, which rounds
// athlete and activity IDs past 2^53 (feature 042) into duplicates, or past
// SQLite's largest integer.
import { DatabaseSync } from "node:sqlite";

const [file] = process.argv.slice(2);
if (!file) {
	console.error("usage: node scripts/sandbox-export.mjs <file.sqlite>");
	process.exit(1);
}
const db = new DatabaseSync(file, { readOnly: true });
const id = (name) => `"${name.replaceAll('"', '""')}"`;

function text(s) {
	let out = `'${s.replaceAll("'", "''")}'`;
	if (out.includes("\r"))
		out = `replace(${out.replaceAll("\r", "\\r")},'\\r',char(13))`;
	if (out.includes("\n"))
		out = `replace(${out.replaceAll("\n", "\\n")},'\\n',char(10))`;
	return out;
}

function value(cell) {
	if (cell === null) return "NULL";
	if (typeof cell === "bigint") return String(cell);
	if (typeof cell === "number") {
		if (!Number.isFinite(cell)) return cell > 0 ? "9e999" : "-9e999";
		// A REAL stays a REAL, also when it holds a whole number.
		const s = String(cell);
		return /^-?\d+$/.test(s) ? `${s}.0` : s;
	}
	if (typeof cell === "string") return text(cell);
	if (cell instanceof Uint8Array)
		return `X'${Buffer.from(cell).toString("hex")}'`;
	throw new Error(`Unexpected value ${String(cell)}`);
}

const out = ["PRAGMA defer_foreign_keys=TRUE;"];
const tables = db
	.prepare(
		`SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND sql NOT NULL
			ORDER BY tbl_name = 'sqlite_sequence', rowid`,
	)
	.all();
for (const { name, sql } of tables) {
	if (name === "sqlite_sequence") out.push("DELETE FROM sqlite_sequence;");
	else if (name.startsWith("sqlite_stat")) out.push("ANALYZE sqlite_schema;");
	else if (name.startsWith("_cf_") || name.startsWith("sqlite_")) continue;
	else if (sql.startsWith("CREATE VIRTUAL TABLE"))
		throw new Error(`Virtual table ${name}`);
	else if (/^CREATE TABLE ['"]/.test(sql))
		out.push(`CREATE TABLE IF NOT EXISTS ${sql.substring(13)};`);
	else out.push(`${sql};`);

	const columns = db
		.prepare(`PRAGMA table_info(${id(name)})`)
		.all()
		.map((c) => id(c.name));
	const rows = db.prepare(`SELECT ${columns.join(", ")} FROM ${id(name)}`);
	rows.setReadBigInts(true);
	rows.setReturnArrays(true);
	for (const row of rows.iterate()) {
		out.push(
			`INSERT INTO ${id(name)} (${columns.join(",")}) VALUES(${row.map(value).join(",")});`,
		);
	}
}
for (const { sql } of db
	.prepare(
		`SELECT sql FROM sqlite_schema WHERE sql NOT NULL
			AND type IN ('index', 'trigger', 'view') ORDER BY type COLLATE NOCASE`,
	)
	.all()) {
	out.push(`${sql};`);
}
db.close();
console.log(out.join("\n"));
