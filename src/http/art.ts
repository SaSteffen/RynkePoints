import { ART_VERSIONS } from "./art-versions";

// The address of a badge, coin, illustration or quote monkey in public/ with its hash
// (scripts/art-versions.mjs), so the browser keeps it until the picture
// changes (public/_headers).

/** `path` with `?v=<hash>`, or as it is for a file the list doesn't know. */
export function artUrl(path: string): string {
	const version = ART_VERSIONS[path];
	return version ? `${path}?v=${version}` : path;
}
