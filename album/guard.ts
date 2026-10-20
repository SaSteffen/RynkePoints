// The album Worker's read-only D1 (feature 021 FR-021, research R12,
// contracts/album-worker.md "Read-only guard"). `env.DB` points at production,
// so it is wrapped before any reader sees it: only single SELECT or WITH …
// SELECT statements pass, and nothing else of D1 that could write.

export class ReadOnlyError extends Error {
	constructor(word: string) {
		super(`The album only reads: ${word} is not allowed`);
		this.name = "ReadOnlyError";
	}
}

/** Words that start a statement that writes or changes the connection. */
const WRITING = new Set([
	"INSERT",
	"UPDATE",
	"DELETE",
	"REPLACE",
	"CREATE",
	"DROP",
	"ALTER",
	"PRAGMA",
	"ATTACH",
	"DETACH",
	"VACUUM",
	"REINDEX",
	"ANALYZE",
	"BEGIN",
	"COMMIT",
	"ROLLBACK",
	"SAVEPOINT",
	"RELEASE",
]);

/**
 * The SQL's words outside string literals, quoted names and comments, upper
 * case, each with whether a `(` follows it (`replace(…)` is a function).
 * A `;` is returned as a word of its own.
 */
function words(sql: string): { word: string; call: boolean }[] {
	const out: { word: string; call: boolean }[] = [];
	let i = 0;
	while (i < sql.length) {
		const c = sql[i] as string;
		const next = sql[i + 1];
		if (c === "-" && next === "-") {
			const end = sql.indexOf("\n", i);
			i = end === -1 ? sql.length : end + 1;
		} else if (c === "/" && next === "*") {
			const end = sql.indexOf("*/", i + 2);
			i = end === -1 ? sql.length : end + 2;
		} else if (c === "'" || c === '"' || c === "`" || c === "[") {
			const close = c === "[" ? "]" : c;
			let j = i + 1;
			for (;;) {
				const end = sql.indexOf(close, j);
				if (end === -1) {
					j = sql.length;
					break;
				}
				// A doubled quote is one quote inside the literal.
				if (close !== "]" && sql[end + 1] === close) {
					j = end + 2;
					continue;
				}
				j = end + 1;
				break;
			}
			i = j;
		} else if (c === ";") {
			out.push({ word: ";", call: false });
			i++;
		} else if (/[A-Za-z_]/.test(c)) {
			let j = i + 1;
			while (j < sql.length && /[A-Za-z0-9_$]/.test(sql[j] as string)) j++;
			const rest = sql.slice(j).trimStart();
			out.push({ word: sql.slice(i, j).toUpperCase(), call: rest[0] === "(" });
			i = j;
		} else {
			i++;
		}
	}
	return out;
}

/** Throws `ReadOnlyError` unless `sql` is one SELECT or WITH … SELECT. */
export function assertReadOnly(sql: string): void {
	const found = words(sql);
	const first = found[0]?.word ?? "";
	if (first !== "SELECT" && first !== "WITH") {
		throw new ReadOnlyError(first || "an empty statement");
	}
	const end = found.findIndex((w) => w.word === ";");
	if (end !== -1 && end < found.length - 1) {
		throw new ReadOnlyError(found[end + 1]?.word ?? ";");
	}
	const writing = found.find((w) => WRITING.has(w.word) && !w.call);
	if (writing) throw new ReadOnlyError(writing.word);
}

/** Every statement this guard handed out, to the statement D1 runs. */
const guarded = new WeakMap<D1PreparedStatement, D1PreparedStatement>();

function guardStatement(statement: D1PreparedStatement): D1PreparedStatement {
	const proxy: D1PreparedStatement = new Proxy(statement, {
		get(target, property) {
			if (property === "bind") {
				return (...values: unknown[]) => guardStatement(target.bind(...values));
			}
			const value = Reflect.get(target, property, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	guarded.set(proxy, statement);
	return proxy;
}

/** `db`, but only reading (contracts/album-worker.md). */
export function readOnly(db: D1Database): D1Database {
	return {
		prepare(sql: string) {
			assertReadOnly(sql);
			return guardStatement(db.prepare(sql));
		},
		async batch<T = unknown>(statements: D1PreparedStatement[]) {
			const inner = statements.map((statement) => {
				const found = guarded.get(statement);
				if (!found) throw new ReadOnlyError("a statement prepared past it");
				return found;
			});
			return db.batch<T>(inner);
		},
		exec(): Promise<D1ExecResult> {
			return Promise.reject(new ReadOnlyError("exec"));
		},
		dump(): Promise<ArrayBuffer> {
			return Promise.reject(new ReadOnlyError("dump"));
		},
		withSession(): D1DatabaseSession {
			throw new ReadOnlyError("withSession");
		},
	};
}
