export default {
	extends: ["@commitlint/config-conventional"],
	// Dependabot's own commits are squashed away: only its pull request title
	// reaches develop, and pr-title still checks that.
	ignores: [(message) => message.includes("Signed-off-by: dependabot[bot]")],
};
