// The app's changelog, newest version first, shown at `/changelog` and linked
// from Settings. Its first version is the app's version, which `package.json`
// repeats (test/unit/changelog.test.ts). Versions follow semver along the
// Conventional Commits merged since the last release: a breaking change bumps
// the major number, a `feat` the minor, anything else the patch.
//
// Every release gets a new version here before the release pull request is
// opened. The entries are for the administrators for now and in English only,
// whatever the rider's language (constitution, Language). Every team shows the
// same list, so no entry names a team, its place or its riders (feature 026
// FR-023).

export interface Release {
	version: string;
	changes: readonly string[];
}

export const CHANGELOG: readonly Release[] = [
	{
		version: "1.0.0",
		changes: [
			"The app has a version number. Settings shows it and links to this list of changes.",
		],
	},
];

/** The running version: the newest in the changelog. */
export const APP_VERSION = (CHANGELOG[0] as Release).version;
