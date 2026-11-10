import { escapeHtml } from "../src/http/html";

// The sandbox bar (feature 027 research R12, FR-003, FR-050): on every HTML page
// of a sandbox, a fixed bar saying it isn't the real app, with the commit it
// runs and the pull request or release it came from. Developer-facing English
// in the fake-mode layer, like the /_dev/ pages, so not in the catalogs.

const REPOSITORY = "https://github.com/SaSteffen/RynkePoints";
const HEIGHT = "1.5rem";

// The app's sticky top bar and loading line sit below the bar, not under it.
const STYLE = `<style>
html{scroll-padding-top:${HEIGHT}}
body{padding-top:${HEIGHT}}
header.top-bar,.page-loading{top:${HEIGHT}}
.sandbox-bar{position:fixed;top:0;left:0;right:0;z-index:2147483647;height:${HEIGHT};line-height:${HEIGHT};padding:0 .75rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:600 .8125rem/${HEIGHT} system-ui,sans-serif;background:#5c2d91;color:#fff}
.sandbox-bar a{color:inherit}
</style>`;

/** The bar's markup: the commit links to GitHub only when it is a hash. */
export function sandboxBar(commit: string, source: string): string {
	const short = escapeHtml(commit.slice(0, 7) || "unknown commit");
	const shown = /^[0-9a-f]{7,40}$/.test(commit)
		? `<a href="${REPOSITORY}/commit/${commit}">${short}</a>`
		: short;
	const from = source ? ` · ${escapeHtml(source)}` : "";
	return `<div class="sandbox-bar" role="note">Sandbox · not the real app · ${shown}${from}</div>`;
}

/** Adds the bar to an HTML response; anything else passes unchanged. */
export function withSandboxBar(
	response: Response,
	env: { SANDBOX_COMMIT?: string; SANDBOX_SOURCE?: string },
): Response {
	if (!response.headers.get("Content-Type")?.startsWith("text/html")) {
		return response;
	}
	const bar = sandboxBar(env.SANDBOX_COMMIT ?? "", env.SANDBOX_SOURCE ?? "");
	return new HTMLRewriter()
		.on("head", {
			element(head) {
				head.append(STYLE, { html: true });
			},
		})
		.on("body", {
			element(body) {
				body.prepend(bar, { html: true });
			},
		})
		.transform(response);
}
