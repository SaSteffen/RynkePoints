import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("worker", () => {
	it("answers /health", async () => {
		const response = await exports.default.fetch("https://example.com/health");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
	});

	it("returns 404 for unknown paths", async () => {
		const response = await exports.default.fetch("https://example.com/nope");
		expect(response.status).toBe(404);
	});
});
