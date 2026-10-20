// What album/wrangler.jsonc's module rules make of these imports.

declare module "*.css" {
	const text: string;
	export default text;
}

declare module "*.woff2" {
	const data: ArrayBuffer;
	export default data;
}
