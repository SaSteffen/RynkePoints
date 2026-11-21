import { CHANGELOG } from "../changelog";
import type { Ctx } from "../ctx";
import type { I18n } from "../i18n/i18n";
import { html, htmlResponse, layout, pageLook } from "./html";

// What changed with each version, linked from Settings. Public like the
// privacy notice: no session, no rider data. The entries are English in every
// language, so they say so with `lang`.

export function handleChangelog(ctx: Ctx, i18n: I18n): Response {
	const title = i18n.t("changelog.title");
	const releases = CHANGELOG.map(
		({ version, changes }) => html`<section id="v${version}">
<h2>${i18n.t("changelog.version", { version })}</h2>
<ul class="changelog-changes" lang="en">${changes.map((c) => html`<li>${c}</li>`)}</ul>
</section>`,
	);
	return htmlResponse(
		i18n,
		layout(i18n, {
			look: pageLook(ctx),
			title,
			path: "/changelog",
			body: html`<article class="changelog">
<h1>${title}</h1>
<p>${i18n.t("changelog.intro")}</p>
${releases}
</article>`,
		}),
	);
}
