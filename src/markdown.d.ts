// A Markdown file imports as its text: the Text rule in wrangler.jsonc, which
// the tests' Workers runtime follows too. Only CHANGELOG.md is imported.
declare module "*.md" {
	const text: string;
	export default text;
}
