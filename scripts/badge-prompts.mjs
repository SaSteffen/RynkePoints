// The badge art inputs (feature 013, specs/013-badges-achievements/data-model.md):
// checks art/badges/badges.json and puts a badge's Gemini prompt together from
// art/badges/prompt.txt. No `node:` imports, so the tests load it in the
// Workers runtime; badge-art.mjs and badge-build.mjs read the files and call it.

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GROUPS = new Set(["personal", "team"]);
const PLACEHOLDER = /{{(\w+)}}/g;

/** Problems with the badge list, one line each; empty when it is valid. */
export function validateBadges(data) {
	const problems = [];
	const snippets = data?.snippets ?? {};
	const badges = data?.badges;
	if (!Array.isArray(badges)) return ["badges.json: no badges list"];

	const seen = new Set();
	const lastThreshold = new Map();
	const groupOf = new Map();
	for (const [i, b] of badges.entries()) {
		const id = typeof b?.id === "string" ? b.id : "";
		const where = id || `badge #${i + 1}`;
		if (!ID.test(id))
			problems.push(`${where}: id must be lower-case words joined by dashes`);
		else if (id.endsWith("-ribbon"))
			problems.push(
				`${id}: ids can't end in -ribbon (the ribbon files' suffix)`,
			);
		else if (seen.has(id)) problems.push(`${id}: duplicate id`);
		seen.add(id);

		if (!GROUPS.has(b?.group))
			problems.push(`${where}: group must be "personal" or "team"`);

		const category = typeof b?.category === "string" ? b.category : "";
		if (!category) problems.push(`${where}: no category`);

		const t = b?.threshold;
		if (typeof t !== "number" || !(t > 0))
			problems.push(`${where}: threshold must be a number above 0`);
		else if (category) {
			const last = lastThreshold.get(category);
			if (last !== undefined && !(t > last))
				problems.push(
					`${where}: thresholds in ${category} must increase (${t} after ${last})`,
				);
			lastThreshold.set(category, t);
		}

		if (category && GROUPS.has(b?.group)) {
			const group = groupOf.get(category);
			if (group && group !== b.group)
				problems.push(
					`${where}: category ${category} is in more than one group`,
				);
			groupOf.set(category, b.group);
		}

		const scene = typeof b?.scene === "string" ? b.scene : "";
		if (!scene.trim()) problems.push(`${where}: empty scene`);
		for (const [, name] of scene.matchAll(PLACEHOLDER)) {
			if (name === "scene") problems.push(`${where}: scene contains {{scene}}`);
			else if (!Object.hasOwn(snippets, name))
				problems.push(`${where}: unknown snippet {{${name}}}`);
		}
	}
	return problems;
}

/** The badge's prompt: the template with its scene and snippets filled in. */
export function buildPrompt(template, snippets, badge) {
	if (!template.includes("{{scene}}"))
		throw new Error("prompt template has no {{scene}}");
	const scene = badge.scene.replace(PLACEHOLDER, (_, name) => {
		if (!Object.hasOwn(snippets, name))
			throw new Error(`${badge.id}: unknown snippet {{${name}}}`);
		return snippets[name];
	});
	return template.replace("{{scene}}", () => scene);
}
