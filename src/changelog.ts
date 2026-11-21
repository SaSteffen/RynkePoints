import changelog from "../CHANGELOG.md";

// The app's changelog, CHANGELOG.md at the top of the repo, bundled as text
// (the Text rule in wrangler.jsonc) and shown at `/changelog`, linked from
// Settings. Its first version is the app's version, which `package.json`
// repeats (test/integration/changelog.test.ts). Versions follow semver along
// the Conventional Commits merged since the last release: a breaking change
// bumps the major number, a `feat` the minor, anything else the patch.
//
// The entries are for the administrators for now and in English only,
// whatever the rider's language (constitution, Language). Every team shows the
// same list, so no entry names a team, its place or its riders (feature 026
// FR-023).

export interface Release {
	version: string;
	changes: readonly string[];
}

/**
 * The releases in a changelog: a `## X.Y.Z` heading each, then one `- ` line
 * per change, which lines indented by two spaces carry on. What comes before
 * the first heading introduces the file and isn't shown. Any other line
 * throws, so nothing written there goes missing from the page unnoticed.
 */
export function parseChangelog(text: string): Release[] {
	const releases: { version: string; changes: string[] }[] = [];
	text.split("\n").forEach((line, i) => {
		const heading = line.match(/^## (\S+)\s*$/);
		const release = releases.at(-1);
		if (heading) {
			releases.push({ version: heading[1] as string, changes: [] });
		} else if (release === undefined || line.trim() === "") {
			// The introduction, or a blank line.
		} else if (line.startsWith("- ")) {
			release.changes.push(line.slice(2).trim());
		} else if (line.startsWith("  ") && release.changes.length > 0) {
			const last = release.changes.length - 1;
			release.changes[last] = `${release.changes[last]} ${line.trim()}`;
		} else {
			throw new Error(
				`CHANGELOG.md line ${i + 1} is neither a heading nor a change: ${line}`,
			);
		}
	});
	return releases;
}

export const CHANGELOG: readonly Release[] = parseChangelog(changelog);

/** The running version: the newest in the changelog. */
export const APP_VERSION = CHANGELOG[0]?.version ?? "";
