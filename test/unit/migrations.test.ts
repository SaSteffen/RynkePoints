import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Each number names one migration, so the order never hangs on the rest of a
// name. The pair already shipped stays: Wrangler records applied migrations by
// name, so renaming one would run it again (review C-07).
const SHIPPED_PAIR = ["0009_organiser_flag.sql", "0009_rynke_rises.sql"];

describe("migrations", () => {
	it("number each migration once, but for the pair already shipped", () => {
		const names = env.TEST_MIGRATIONS.map((m) => m.name);
		const byNumber = Map.groupBy(names, (name) => name.slice(0, 4));
		const repeated = [...byNumber.values()]
			.filter((group) => group.length > 1)
			.map((group) => group.sort());
		expect(repeated).toEqual([SHIPPED_PAIR]);
	});

	it("start each name with a four-digit number", () => {
		for (const { name } of env.TEST_MIGRATIONS) {
			expect(name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
		}
	});
});
