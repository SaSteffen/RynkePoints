// Types for scripts/test-scope.mjs, for the tests in test/unit/.

/** Whether a pull request with these changed paths needs `test` and `e2e`. */
export function testsFor(changed: readonly string[]): {
	tests: boolean;
	/** Why, for the workflow's notice. */
	notice: string;
};
