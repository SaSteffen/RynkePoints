// The quote monkeys' art inputs: checks art/quotes/monkeys.json, the five
// pictures of Rynke saying the Team page's quote in a speech bubble. Their
// prompts are put together like the badges' (badge-prompts.mjs `buildPrompt`,
// from art/quotes/prompt.txt). No `node:` imports, so the tests load it in the
// Workers runtime; badge-art.mjs (--set quotes) and quote-build.mjs read the
// files and call it.

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PLACEHOLDER = /{{(\w+)}}/g;

/** Problems with the monkey list, one line each; empty when it is valid. */
export function validateMonkeys(data) {
	const problems = [];
	const snippets = data?.snippets ?? {};
	const monkeys = data?.monkeys;
	if (!Array.isArray(monkeys)) return ["monkeys.json: no monkeys list"];
	if (monkeys.length === 0) problems.push("monkeys.json: the list is empty");

	const seen = new Set();
	for (const [i, m] of monkeys.entries()) {
		const id = typeof m?.id === "string" ? m.id : "";
		const where = id || `monkey #${i + 1}`;
		if (!ID.test(id))
			problems.push(`${where}: id must be lower-case words joined by dashes`);
		else if (seen.has(id)) problems.push(`${id}: duplicate id`);
		seen.add(id);

		if (typeof m?.name !== "string" || !m.name.trim())
			problems.push(`${where}: no name`);

		const scene = typeof m?.scene === "string" ? m.scene : "";
		if (!scene.trim()) problems.push(`${where}: empty scene`);
		for (const [, name] of scene.matchAll(PLACEHOLDER)) {
			if (name === "scene") problems.push(`${where}: scene contains {{scene}}`);
			else if (!Object.hasOwn(snippets, name))
				problems.push(`${where}: unknown snippet {{${name}}}`);
		}
	}
	return problems;
}
