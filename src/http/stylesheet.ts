import { createHash } from "node:crypto";
import { STYLE } from "./style";

// The stylesheet as its own file (issue #183), so a page and every in-place
// tab swap no longer carry all of `STYLE`. Its address holds a hash of the
// rules, worked out once per isolate: a deploy that changes them changes the
// address, so the browser may keep each one for good.

const HASH = createHash("sha256").update(STYLE).digest("hex").slice(0, 16);

/** Where `layout()` links the stylesheet. */
export const STYLESHEET_PATH = `/style-${HASH}.css`;

/** Any stylesheet address, this deploy's or another's. */
const STYLESHEET = /^\/style-[0-9a-f]{1,64}\.css$/;

export function isStylesheet(path: string): boolean {
	return STYLESHEET.test(path);
}

/**
 * The current rules at any stylesheet address, read before the session and the
 * same for everyone. Only this deploy's address is immutable. Another one (a
 * page from the previous deploy, or one from the next while a rollout reaches
 * this isolate) gets these rules uncached, so a browser never keeps the wrong
 * rules under that address.
 */
export function handleStylesheet(path: string): Response {
	return new Response(STYLE, {
		headers: {
			"Content-Type": "text/css; charset=utf-8",
			"Cache-Control":
				path === STYLESHEET_PATH
					? "public, max-age=31536000, immutable"
					: "no-cache",
		},
	});
}
