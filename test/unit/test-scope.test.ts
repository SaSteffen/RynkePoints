import { describe, expect, it } from "vitest";
import { testsFor } from "../../scripts/test-scope.mjs";

// Which tests a pull request needs (scripts/test-scope.mjs): none when it only
// changes paths no test reads, the changelog's when it only raises the version.

const versionOnly = () => true;
const unread = () => {
	throw new Error("package.json is only compared when it changed");
};

describe("testsFor", () => {
	it("skips the tests for docs, specs, skills and GitHub settings only", () => {
		const scope = testsFor(
			[
				"README.md",
				"docs/how-it-runs.md",
				"specs/041-admin-every-team/spec.md",
				".specify/memory/constitution.md",
				".claude/skills/release/SKILL.md",
				"content/briefs/common-phrases.md",
				".github/rulesets/main.json",
				".github/workflows/release-pr.yml",
			],
			unread,
		);
		expect(scope.tests).toBe("none");
	});

	it.each([
		"src/http/router.ts",
		"pnpm-lock.yaml",
		"e2e/smoke.e2e.ts",
		"scripts/e2e-scope.mjs",
		"public/app.js",
		"src/content/phrases/hamburg.de.ts",
		".github/workflows/ci.yml",
		".github/actions/setup/action.yml",
	])("runs all of them when %s changed", (path) => {
		const scope = testsFor(
			["README.md", "src/changelog.ts", path],
			versionOnly,
		);
		expect(scope).toEqual({
			tests: "all",
			notice: `test and e2e run: ${path} changed.`,
		});
	});

	it("runs only the changelog's for a version pull request", () => {
		expect(
			testsFor(["package.json", "src/changelog.ts"], versionOnly).tests,
		).toBe("changelog");
		expect(testsFor(["src/changelog.ts", "README.md"], unread).tests).toBe(
			"changelog",
		);
	});

	it("runs all of them when package.json changed beyond its version", () => {
		const scope = testsFor(["package.json", "src/changelog.ts"], () => false);
		expect(scope.tests).toBe("all");
	});

	it("runs all of them when no changed path was found", () => {
		expect(testsFor([], unread).tests).toBe("all");
	});
});
