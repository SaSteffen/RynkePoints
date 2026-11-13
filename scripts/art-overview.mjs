#!/usr/bin/env node
import { execFileSync } from "node:child_process";
// Writes art/overview.html: every team's badges and quote monkeys with the
// app's own stylesheet and markup, light or dark at a click, so a rebuilt
// picture can be checked as riders see it. Serve the repo and open it:
//
//   node scripts/art-overview.mjs && pnpm monkeys:seasonal
//   http://localhost:8000/art/overview.html
//
// Pictures load from /public/, as the repo root is served. The file is
// git-ignored; it is a local check, not part of the app.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const entry = `
import { STYLE } from "./src/http/style";
import { BADGE_SHAPE_DEFS, badgeRibbon } from "./src/badges/outline";
import { BADGES } from "./src/badges/catalog";
import { badgeNames, milestone, tiltOf } from "./src/http/sections/badges";
import { RIBBON_TEXT, ribbonTextSize } from "./src/badges/ribbon";
import { HINT_MONKEYS, QUOTE_MONKEYS, SEASONAL_MONKEYS } from "./src/http/quote-monkeys";
import { artUrl } from "./src/http/art";
import { createI18n } from "./src/i18n/i18n";
import { CATALOGS } from "./src/i18n/catalogs";
import { TEAMS } from "./src/teams";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function badge(i18n, names, b) {
	const src = "/public" + names.picture(b);
	const value = milestone(i18n, b);
	const size = ribbonTextSize(value);
	const style = size < RIBBON_TEXT.size ? \` style="--rp-ribbon-size:\${size}"\` : "";
	return \`<li class="badge-card"><h4>\${esc(names(b.id))}</h4><button class="badge" style="--tilt:\${tiltOf(b.id)}deg;--badge-src:url(\${src})"><span class="badge-art"><img src="\${src}" alt="" width="200" height="200">\${badgeRibbon(b.group)}</span><span class="badge-ribbon-text"\${style}>\${esc(value)}</span></button><p class="badge-about">\${esc(b.id)}</p></li>\`;
}

function monkey(id) {
	return \`<figure class="art-monkey"><img class="quote-monkey-art" src="/public\${artUrl(\`/quotes/\${id}.svg\`)}" alt="" width="120" height="120"><figcaption>\${esc(id)}</figcaption></figure>\`;
}

function column(scheme) {
	return TEAMS.map((team) => {
		const i18n = createI18n(team.id === "hamburg" ? "de" : "en", CATALOGS);
		const names = badgeNames({ team }, i18n);
		const groups = ["personal", "team"].map(
			(g) => \`<section class="badge-group badge-group-\${g}"><h3>\${esc(team.id)} · \${g}</h3><ul class="badge-cards">\${BADGES.filter((b) => b.group === g).map((b) => badge(i18n, names, b)).join("")}</ul></section>\`,
		);
		return \`<h2>\${esc(team.id)}</h2><h3>Quote monkeys</h3><div class="art-monkeys">\${[...QUOTE_MONKEYS, ...SEASONAL_MONKEYS, ...HINT_MONKEYS].map(monkey).join("")}</div>\${groups.join("")}\`;
	}).join("");
}

const page = (scheme) => \`<div class="art-col" data-col="\${scheme}"><div class="badges">\${column(scheme)}</div></div>\`;

console.log(\`<!doctype html><html lang="en" data-scheme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Art overview</title><style>\${STYLE}
body{margin:0;padding:16px;background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface);font-family:var(--md-ref-typeface)}
.art-bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;padding:8px 0;background:var(--md-sys-color-surface)}
.art-monkeys{display:flex;flex-wrap:wrap;gap:12px}
.art-monkey{margin:0;text-align:center;font:var(--md-type-caption)}
</style></head><body>
<div class="art-bar"><button type="button" data-set="light">Light</button><button type="button" data-set="dark">Dark</button></div>
\${BADGE_SHAPE_DEFS}\${page()}
<script>for (const b of document.querySelectorAll("[data-set]")) b.onclick = () => (document.documentElement.dataset.scheme = b.dataset.set);</script>
</body></html>\`);
`;

// esbuild comes with the dev tools (wrangler, vitest), not as a dependency.
const bundle = execFileSync(
	join(root, "node_modules/.bin/esbuild"),
	[
		"--bundle",
		"--platform=node",
		"--format=esm",
		"--loader=ts",
		"--log-level=error",
	],
	{ input: entry, cwd: root, maxBuffer: 64 * 1024 * 1024 },
);
const module = `data:text/javascript;base64,${bundle.toString("base64")}`;
let html = "";
const log = console.log;
console.log = (s) => {
	html += s;
};
await import(module);
console.log = log;
writeFileSync(join(root, "art/overview.html"), html);
console.log("art/overview.html: http://localhost:8000/art/overview.html");
