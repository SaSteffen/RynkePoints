// What album/wrangler.jsonc's module rule makes of these imports.

declare module "*.woff2" {
	const data: ArrayBuffer;
	export default data;
}
