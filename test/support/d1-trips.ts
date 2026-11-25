import type { TestCtx } from "./ctx";

// Counts a page's D1 round trips (issues #184, #185): every call that reaches
// D1 (`first`, `all`, `run`, `raw`, `batch`, `exec`), and the round trips
// among them, where calls that start while another is still in flight share
// one. The binding underneath is the test's own local D1.
//
// With `holdWrites`, every write after a `reset` waits until `release` and
// isn't counted: an answer that waits for one never comes, so the count is
// what a page waits for with its writes after the answer.

export interface TripCounter {
	/** Sequential round trips since the last `reset`. */
	trips: () => number;
	/** D1 calls since the last `reset`, concurrent ones each counted. */
	calls: () => number;
	/** Sends the held writes, and holds the ones after the next `reset` again. */
	release: () => void;
	reset: () => void;
}

const CALLS = new Set(["first", "all", "run", "raw"]);
const WRITE = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i;

/** `ctx` with a counting `DB`, and its counter. */
export function countTrips(
	ctx: TestCtx,
	{ holdWrites = false }: { holdWrites?: boolean } = {},
): {
	ctx: TestCtx;
	counter: TripCounter;
} {
	let inFlight = 0;
	let trips = 0;
	let calls = 0;
	// A batch takes the binding's own statements, not the counting wrappers.
	const real = new WeakMap<object, D1PreparedStatement>();
	const sqlOf = new WeakMap<object, string>();
	// Writes wait only between a `reset` and the `release` after it.
	let holding = false;
	let release = () => {};
	let held = Promise.resolve();

	async function track<T>(
		sql: readonly string[],
		call: () => Promise<T>,
	): Promise<T> {
		if (holding && sql.some((s) => WRITE.test(s))) {
			await held;
			return call();
		}
		calls += 1;
		if (inFlight === 0) trips += 1;
		inFlight += 1;
		return call().finally(() => {
			inFlight -= 1;
		});
	}

	function wrap(
		statement: D1PreparedStatement,
		sql: string,
	): D1PreparedStatement {
		const wrapped = new Proxy(statement, {
			get(target, prop) {
				if (prop === "bind") {
					return (...values: unknown[]) => wrap(target.bind(...values), sql);
				}
				if (typeof prop === "string" && CALLS.has(prop)) {
					return (...args: unknown[]) =>
						track([sql], () =>
							(
								target[prop as "all"] as (...a: unknown[]) => Promise<unknown>
							).apply(target, args),
						);
				}
				const value = Reflect.get(target, prop, target);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		real.set(wrapped, statement);
		sqlOf.set(wrapped, sql);
		return wrapped;
	}

	const base = ctx.env.DB;
	const db = new Proxy(base, {
		get(target, prop) {
			if (prop === "prepare") {
				return (sql: string) => wrap(target.prepare(sql), sql);
			}
			if (prop === "batch") {
				return (statements: D1PreparedStatement[]) =>
					track(
						statements.map((s) => sqlOf.get(s) ?? ""),
						() => target.batch(statements.map((s) => real.get(s) ?? s)),
					);
			}
			if (prop === "exec") {
				return (sql: string) => track([sql], () => target.exec(sql));
			}
			const value = Reflect.get(target, prop, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});

	return {
		ctx: { ...ctx, env: { ...ctx.env, DB: db } },
		counter: {
			trips: () => trips,
			calls: () => calls,
			release: () => {
				holding = false;
				release();
			},
			reset: () => {
				trips = 0;
				calls = 0;
				if (holdWrites) {
					release();
					holding = true;
					held = new Promise((resolve) => {
						release = resolve;
					});
				}
			},
		},
	};
}
