// Types for scripts/team-check.mjs, for vitest.config.ts.

/** JSONC to a value: comments and trailing commas out, strings untouched. */
export function parseJsonc(text: string): unknown;

/** Every problem with `teams` against the parsed wrangler.jsonc, one line each. */
export function teamProblems(
	teams: readonly unknown[],
	wrangler: unknown,
	options: {
		locales: readonly string[];
		publicFile: (file: string) => boolean;
	},
): string[];

/** `--deployable <id>`: the team's placeholders, one line each. */
export function placeholderProblems(
	teams: readonly unknown[],
	id: string,
): string[];

/** The team registry, `TEAMS` of src/teams/index.ts, imported from Node. */
export function loadTeams(): Promise<readonly unknown[]>;
