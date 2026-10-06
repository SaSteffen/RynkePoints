import { applyD1Migrations, env } from "cloudflare:test";
import { afterEach, beforeEach, vi } from "vitest";

// Runs before every test file. Migrations already applied are skipped, so this
// is cheap after the first file.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

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
