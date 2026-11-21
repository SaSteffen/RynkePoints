#!/usr/bin/env node
// Decides whether a pull request needs `test` and `e2e`: not when every path it
// changes (deleted ones too) is documentation, specs, Claude Code skills, briefs or
// GitHub settings that no test reads. Then both jobs are skipped, which their
// required checks accept. A change to ci.yml or the setup action still runs them,
// and so does any doubt: when git fails, they run.
//
// Run in CI on the pull request's merge commit, checked out with fetch-depth 2, so
// HEAD^1 is the base branch's tip. Writes `tests=true|false` to $GITHUB_OUTPUT (or
// prints it, outside Actions). Pushes and dispatches always run the tests.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Paths no test or e2e test reads. */
const NO_TESTS = [
	/^docs\//,
	/^specs\//,
	/^\.specify\//,
	/^\.claude\//,
	/^content\//,
	/^[^/]+\.md$/, // README.md, CLAUDE.md, REQUIREMENTS.md
	/^LICENSE$/,
	/^\.github\/(?!workflows\/ci\.yml$|actions\/)/,
];

/**
 * Whether a pull request with these changed paths needs the tests, and the
 * notice saying why.
 * @param {readonly string[]} changed
 * @returns {{ tests: boolean, notice: string }}
 */
export function testsFor(changed) {
	const code = changed.find((path) => !NO_TESTS.some((re) => re.test(path)));
	if (code !== undefined) {
		return { tests: true, notice: `test and e2e run: ${code} changed.` };
	}
	if (changed.length === 0) {
		return { tests: true, notice: "test and e2e run: no changed path found." };
	}
	return {
		tests: false,
		notice: "test and e2e are skipped: only docs, specs or settings changed.",
	};
}

function decide() {
	try {
		const changed = execFileSync(
			"git",
			["diff", "--name-only", "HEAD^1", "HEAD"],
			{ encoding: "utf8" },
		)
			.trim()
			.split("\n")
			.filter(Boolean);
		return testsFor(changed);
	} catch (error) {
		return {
			tests: true,
			notice: `test and e2e run: no diff to the base (${error.message.split("\n")[0]}).`,
		};
	}
}

function main() {
	const { tests, notice } = decide();
	console.log(`::notice::${notice}`);
	const line = `tests=${tests}\n`;
	if (process.env.GITHUB_OUTPUT)
		appendFileSync(process.env.GITHUB_OUTPUT, line);
	else process.stdout.write(line);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
