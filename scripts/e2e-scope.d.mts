// Types for scripts/e2e-scope.mjs, for the tests in test/unit/.

/** What Firefox and WebKit run on a pull request into develop. */
export interface E2eScope {
	/** The variables for $GITHUB_ENV; `undefined` runs the full suite. */
	vars: { E2E_SCOPE: string; E2E_CHANGED: string } | undefined;
	/** Why, for the workflow's notice. */
	notice: string;
}

/**
 * The scope for the pull request's changed paths; `lockDiff` gives the diff of
 * pnpm-lock.yaml and is only called when that file changed.
 */
export function scopeFor(
	changed: readonly string[],
	lockDiff: () => string,
): E2eScope;
