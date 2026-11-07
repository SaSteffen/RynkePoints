import { afterEach, beforeEach, vi } from "vitest";

// The gateway's tests (feature 026 release 3). Like test/setup.ts, but there is
// no D1: no test may reach the network (constitution Principle V). Every test
// starts with a deny-all fetch that a test may replace.
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
	vi.restoreAllMocks();
	if (blocked.length > 0) {
		throw new Error(`Unexpected network request(s): ${blocked.join(", ")}`);
	}
});
