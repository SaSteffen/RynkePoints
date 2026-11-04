import type { TestCtx } from "./ctx";

// Adds up the rows D1 reports reading and writing per use (feature 030 research
// R12), for `first`, `all`, `run`, `raw` and `batch`. `first` and `raw` don't
// report them, so they go through `all` and count that. Local SQLite's counts
// may differ a little from production; the Admin page shows real use.

export interface RowCounter {
	read: () => number;
	written: () => number;
	/** The SQL of every statement since the last `reset`. */
	statements: () => string[];
	reset: () => void;
}

/** `ctx` with a counting `DB`, and its counter. */
export function countRows(ctx: TestCtx): {
	ctx: TestCtx;
	counter: RowCounter;
} {
	let read = 0;
	let written = 0;
	let sqls: string[] = [];
	// A batch takes the binding's own statements, not the counting wrappers.
	const real = new WeakMap<object, D1PreparedStatement>();
	const sqlOf = new WeakMap<object, string>();

	function record(sql: string, meta: D1Meta | undefined): void {
		read += meta?.rows_read ?? 0;
		written += meta?.rows_written ?? 0;
		sqls.push(sql);
	}

	function wrap(statement: D1PreparedStatement, sql: string) {
		const wrapped: D1PreparedStatement = new Proxy(statement, {
			get(target, prop) {
				if (prop === "bind") {
					return (...values: unknown[]) => wrap(target.bind(...values), sql);
				}
				if (prop === "all" || prop === "run") {
					return async () => {
						const result = await target[prop]();
						record(sql, result.meta);
						return result;
					};
				}
				if (prop === "first") {
					return async (column?: string) => {
						const { results, meta } =
							await target.all<Record<string, unknown>>();
						record(sql, meta);
						const row = results[0];
						if (!row) return null;
						return column ? row[column] : row;
					};
				}
				if (prop === "raw") {
					return async (options?: { columnNames?: boolean }) => {
						const { meta } = await target.all();
						record(sql, meta);
						return options?.columnNames
							? target.raw({ columnNames: true })
							: target.raw();
					};
				}
				const value = Reflect.get(target, prop, target);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		real.set(wrapped, statement);
		sqlOf.set(wrapped, sql);
		return wrapped;
	}

	const db = new Proxy(ctx.env.DB, {
		get(target, prop) {
			if (prop === "prepare") {
				return (sql: string) => wrap(target.prepare(sql), sql);
			}
			if (prop === "batch") {
				return async (statements: D1PreparedStatement[]) => {
					const results = await target.batch(
						statements.map((s) => real.get(s) ?? s),
					);
					results.forEach((result, i) => {
						const statement = statements[i];
						record(
							(statement && sqlOf.get(statement)) ?? "",
							result?.meta as D1Meta | undefined,
						);
					});
					return results;
				};
			}
			const value = Reflect.get(target, prop, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});

	return {
		ctx: { ...ctx, env: { ...ctx.env, DB: db } },
		counter: {
			read: () => read,
			written: () => written,
			statements: () => sqls,
			reset: () => {
				read = 0;
				written = 0;
				sqls = [];
			},
		},
	};
}
