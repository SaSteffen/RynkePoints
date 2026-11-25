import { describe, expect, it } from "vitest";
import * as gateway from "../../gateway/index";

// workerd takes every named export of a Worker's main module for an
// entrypoint (a Durable Object class or a handler) and refuses to start on
// anything else, so `pnpm dev` failed on an exported number.

describe("the gateway's main module", () => {
	it("exports only entrypoints", () => {
		for (const [name, value] of Object.entries(gateway)) {
			if (name === "default") continue;
			expect(typeof value, name).toBe("function");
		}
	});
});
