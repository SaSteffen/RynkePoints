import { describe, expect, it } from "vitest";
import { testsFor } from "../../scripts/test-scope.mjs";

// Whether a pull request needs `test` and `e2e` (scripts/test-scope.mjs): not when
// it only changes paths no test reads.

describe("testsFor", () => {
	it("skips the tests for docs, specs, skills and GitHub settings only", () => {
		const scope = testsFor([
			"README.md",
			"docs/how-it-runs.md",
			"specs/041-admin-every-team/spec.md",
			".specify/memory/constitution.md",
			".claude/skills/release/SKILL.md",
			"content/briefs/common-phrases.md",
			".github/rulesets/main.json",
			".github/workflows/release-pr.yml",
		]);
		expect(scope.tests).toBe(false);
	});

	it.each([
		"src/changelog.ts",
		"package.json",
		"pnpm-lock.yaml",
		"e2e/smoke.e2e.ts",
		"scripts/e2e-scope.mjs",
		"public/app.js",
		"src/content/phrases/hamburg.de.ts",
		".github/workflows/ci.yml",
		".github/actions/setup/action.yml",
	])("runs them when %s changed", (path) => {
		const scope = testsFor(["README.md", path]);
		expect(scope).toEqual({
			tests: true,
			notice: `test and e2e run: ${path} changed.`,
		});
	});

	it("runs them when no changed path was found", () => {
		expect(testsFor([]).tests).toBe(true);
	});
});
