import { describe, expect, it } from "vitest";
import { scopeFor } from "../../scripts/e2e-scope.mjs";

// What Firefox and WebKit run on a pull request into develop (scripts/e2e-scope.mjs):
// the @cross-browser tests plus every changed e2e file, or the full suite when a
// change touches every test.

const noLock = () => {
	throw new Error("the lock file's diff is only read when it changed");
};

describe("scopeFor", () => {
	it("runs only @cross-browser tests when no e2e file changed", () => {
		const scope = scopeFor(["src/http/router.ts", "README.md"], noLock);
		expect(scope.vars).toEqual({ E2E_SCOPE: "pr", E2E_CHANGED: "" });
		expect(scope.notice).toBe(
			"Firefox and WebKit run the @cross-browser tests.",
		);
	});

	it("adds every changed e2e test file, without the e2e/ prefix", () => {
		const scope = scopeFor(
			["e2e/smoke.e2e.ts", "src/x.ts", "e2e/badges.e2e.ts"],
			noLock,
		);
		expect(scope.vars).toEqual({
			E2E_SCOPE: "pr",
			E2E_CHANGED: "smoke.e2e.ts,badges.e2e.ts",
		});
		expect(scope.notice).toContain("and all of smoke.e2e.ts, badges.e2e.ts");
	});

	it("lists a test file in a subfolder by its path under e2e/", () => {
		// Playwright's title path holds the file relative to testDir.
		const scope = scopeFor(["e2e/orga/graphs.e2e.ts"], noLock);
		expect(scope.vars?.E2E_CHANGED).toBe("orga/graphs.e2e.ts");
	});

	it("ignores a test-like path outside e2e/", () => {
		const scope = scopeFor(["test/e2e/a.e2e.ts"], noLock);
		expect(scope.vars?.E2E_CHANGED).toBe("");
	});

	it.each([
		"playwright.config.ts",
		"e2e/sign-in.ts",
		"e2e/test.ts",
		"e2e/fixtures/data.json",
		"scripts/e2e-scope.mjs",
	])("runs the full suite when %s changed", (path) => {
		const scope = scopeFor(["src/x.ts", path], noLock);
		expect(scope.vars).toBeUndefined();
		expect(scope.notice).toBe(`e2e runs in full: ${path} changed.`);
	});

	it("runs the full suite when the lock file changes Playwright", () => {
		const scope = scopeFor(
			["pnpm-lock.yaml"],
			() => "-  '@playwright/test@1.55.0':\n+  '@playwright/test@1.56.0':\n",
		);
		expect(scope.vars).toBeUndefined();
		expect(scope.notice).toBe("e2e runs in full: Playwright changed.");
	});

	it("keeps the narrow scope when the lock file changes something else", () => {
		const scope = scopeFor(
			["pnpm-lock.yaml"],
			() => " '@playwright/test@1.55.0':\n-  vitest@3.2.0:\n+  vitest@3.2.1:\n",
		);
		expect(scope.vars).toEqual({ E2E_SCOPE: "pr", E2E_CHANGED: "" });
	});
});
