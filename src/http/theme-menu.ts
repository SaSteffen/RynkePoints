import type { I18n } from "../i18n/i18n";
import { html, type SafeHtml } from "./html";
import { CHECK, CLOSE, PALETTE } from "./icons";
import { THEME_GROUPS, THEMES } from "./themes";

// The header's palette button and its menu (feature 022 contracts/theme-menu.md,
// research R6): Automatisch and the twelve themes as one radio group. The
// server doesn't know the device's choice; `public/app.js` checks it and
// applies a new one. Each theme's radio carries its base scheme and surface
// colour, so the page script sets them as the head script does.

const check = html`<span class="theme-check">${CHECK}</span>`;

/**
 * The palette button, before the refresh link; its badge shows only in the
 * fun themes (contracts/fun-decorations.md).
 */
export function themeButton(i18n: I18n): SafeHtml {
	return html`<button type="button" class="icon-button theme-button" aria-haspopup="dialog" aria-expanded="false" aria-controls="theme-menu" aria-label="${i18n.t("theme.button")}">${PALETTE}<span class="theme-badge" aria-hidden="true"></span></button>`;
}

/** The menu panel, hidden until the palette button opens it. */
export function themeMenu(i18n: I18n): SafeHtml {
	const groups = THEME_GROUPS.map((group) => {
		const tiles = THEMES.filter((t) => t.group === group).map(
			(t) =>
				html`<label class="theme-tile" data-theme-preview="${t.id}"><input type="radio" name="theme" value="${t.id}" data-scheme="${t.scheme}" data-color="${t.preview.bg}"><span class="theme-preview" aria-hidden="true"><span></span><span></span><span><span></span><span></span></span></span><span class="theme-name">${i18n.t(`theme.name.${t.id}`)}${check}</span>${t.fun ? html`<span class="theme-sparkle" aria-hidden="true">${i18n.t("theme.sparkle")}</span>` : null}</label>`,
		);
		return html`<h3 class="theme-group">${i18n.t(`theme.group.${group}`)}</h3>
<div class="theme-grid">${tiles}</div>
`;
	});
	return html`<div id="theme-menu" class="theme-menu" role="dialog" aria-labelledby="theme-menu-title" hidden>
<div class="theme-menu-head"><h2 id="theme-menu-title">${i18n.t("theme.menu.title")}</h2><button type="button" class="icon-button" data-action="close" aria-label="${i18n.t("theme.menu.close")}">${CLOSE}</button></div>
<fieldset class="theme-choices"><legend class="visually-hidden">${i18n.t("theme.menu.title")}</legend>
<label class="theme-auto"><input type="radio" name="theme" value="auto"><span class="theme-auto-swatch" aria-hidden="true"></span><span class="theme-auto-text"><span class="theme-auto-name">${i18n.t("theme.auto")}</span><span class="theme-auto-hint">${i18n.t("theme.auto.hint")}</span></span>${check}</label>
${groups}</fieldset>
<p class="theme-note">${i18n.t("theme.menu.note")}</p>
</div>
`;
}
