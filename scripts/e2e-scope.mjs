#!/usr/bin/env node
// Decides what Firefox and WebKit run for a pull request into develop. Chromium and
// Europe always run in full; Firefox and WebKit run the tests tagged @cross-browser
// plus every e2e file the pull request adds or changes, so a new test runs in each
// browser it's meant for. Anything that touches all tests (the Playwright config, a
// shared e2e helper, this script, a Playwright update) keeps the full suite, and so
// does any doubt: when git fails, nothing is written and the config runs in full.
//
// Run in CI on the pull request's merge commit, checked out with fetch-depth 2, so
// HEAD^1 is the base branch's tip. Appends E2E_SCOPE and E2E_CHANGED to $GITHUB_ENV
// (or prints them, outside Actions). Run nightly and on pull requests into main,
// the suite is always full.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const git = (...args) =>
	execFileSync("git", args, { encoding: "utf8" })
		.trim()
		.split("\n")
		.filter(Boolean);

/** Paths whose change affects every e2e test. */
const ALL_TESTS = [
	/^playwright\.config\.ts$/,
	/^e2e\/(?!.*\.e2e\.ts$)/, // helpers such as e2e/sign-in.ts and e2e/test.ts
	/^scripts\/e2e-scope\.mjs$/,
];

function decide() {
	let changed;
	try {
		// Added, copied, modified, renamed: not deleted.
		changed = git(
			"diff",
			"--name-only",
			"--diff-filter=ACMR",
			"HEAD^1",
			"HEAD",
		);
	} catch (error) {
		console.log(
			`::notice::e2e runs in full: no diff to the base (${error.message.split("\n")[0]}).`,
		);
		return undefined;
	}

	const everything = changed.find((path) =>
		ALL_TESTS.some((re) => re.test(path)),
	);
	if (everything) {
		console.log(`::notice::e2e runs in full: ${everything} changed.`);
		return undefined;
	}
	if (changed.includes("pnpm-lock.yaml")) {
		const lock = execFileSync(
			"git",
			["diff", "HEAD^1", "HEAD", "--", "pnpm-lock.yaml"],
			{
				encoding: "utf8",
			},
		);
		if (/^[+-].*@playwright\/test@/m.test(lock)) {
			console.log("::notice::e2e runs in full: Playwright changed.");
			return undefined;
		}
	}

	const specs = changed
		.filter((path) => /^e2e\/[^/]+\.e2e\.ts$/.test(path))
		.map((path) => path.slice("e2e/".length));
	console.log(
		`::notice::Firefox and WebKit run the @cross-browser tests${
			specs.length ? ` and all of ${specs.join(", ")}` : ""
		}.`,
	);
	return { E2E_SCOPE: "pr", E2E_CHANGED: specs.join(",") };
}

const vars = decide();
if (vars) {
	const lines = Object.entries(vars)
		.map(([key, value]) => `${key}=${value}\n`)
		.join("");
	if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, lines);
	else process.stdout.write(lines);
}
