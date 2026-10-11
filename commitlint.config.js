export default {
	extends: ["@commitlint/config-conventional"],
	// Any case after the type is fine, e.g. Dependabot's "Bump".
	rules: { "subject-case": [0] },
};
