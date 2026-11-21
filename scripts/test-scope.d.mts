// Types for scripts/test-scope.mjs, for the tests in test/unit/.

/** Which tests a pull request with these changed paths needs. */
export function testsFor(
	changed: readonly string[],
	onlyVersion: () => boolean,
): {
	tests: "all" | "changelog" | "none";
	/** Why, for the workflow's notice. */
	notice: string;
};
