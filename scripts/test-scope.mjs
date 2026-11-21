#!/usr/bin/env node
// Decides whether a pull request needs `test` and `e2e`: not when every path it
// changes (deleted ones too) is documentation, specs, Claude Code skills, briefs or
// GitHub settings that no test reads. Then both jobs are skipped, which their
// required checks accept. A version pull request (only package.json's version and
// src/changelog.ts) runs just the tests those touch, and no e2e. A change to ci.yml or the setup action still runs them,
// and so does any doubt: when git fails, they run.
//
// Run in CI on the pull request's merge commit, checked out with fetch-depth 2, so
// HEAD^1 is the base branch's tip. Writes `tests=all|changelog|none` to $GITHUB_OUTPUT (or
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

/** What a version pull request changes (the `release` skill). */
const VERSION_FILES = new Set(["package.json", "src/changelog.ts"]);

/**
 * Which tests a pull request with these changed paths needs, and the notice
 * saying why: `all`; `changelog`, only the changelog's and Settings' tests and
 * no e2e, when it only raises the version and extends the changelog; or `none`.
 * `onlyVersion` says whether package.json changed in its version alone; it is
 * only called when package.json changed.
 * @param {readonly string[]} changed
 * @param {() => boolean} onlyVersion
 * @returns {{ tests: "all" | "changelog" | "none", notice: string }}
 */
export function testsFor(changed, onlyVersion) {
	if (changed.length === 0) {
		return { tests: "all", notice: "test and e2e run: no changed path found." };
	}
	const code = changed.filter((path) => !NO_TESTS.some((re) => re.test(path)));
	if (code.length === 0) {
		return {
			tests: "none",
			notice: "test and e2e are skipped: only docs, specs or settings changed.",
		};
	}
	const other = code.find((path) => !VERSION_FILES.has(path));
	if (other !== undefined) {
		return { tests: "all", notice: `test and e2e run: ${other} changed.` };
	}
	if (code.includes("package.json") && !onlyVersion()) {
		return {
			tests: "all",
			notice: "test and e2e run: package.json changed beyond its version.",
		};
	}
	return {
		tests: "changelog",
		notice:
			"A version pull request: only the changelog and Settings tests run.",
	};
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

/** package.json at `rev`, without its version. */
function withoutVersion(rev) {
	const { version: _, ...rest } = JSON.parse(
		git("show", `${rev}:package.json`),
	);
	return JSON.stringify(rest);
}

function decide() {
	try {
		const changed = git("diff", "--name-only", "HEAD^1", "HEAD")
			.trim()
			.split("\n")
			.filter(Boolean);
		return testsFor(
			changed,
			() => withoutVersion("HEAD^1") === withoutVersion("HEAD"),
		);
	} catch (error) {
		return {
			tests: "all",
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
