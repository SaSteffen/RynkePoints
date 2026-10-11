// Draft of the Abzeichen section, mobile (360 px) and desktop (1100 px).
// Usage: node specs/013-badges-achievements/drafts/abzeichen-mock.mjs mobile|desktop out.svg
// (then render the SVG to PNG with any SVG renderer). Pictures are the
// placeholders, badge names are examples; nothing here is app code.
import { writeFileSync } from "node:fs";
import { placeholderSvg } from "../../../scripts/badge-frame.mjs";

const INK = "#1c1b13";
const GREY = "#5f5e57";
const YELLOW = "#fbe122";
const BLUE = "#8cc4f0";
const ribbonColour = { personal: INK, team: BLUE };
const textColour = { personal: YELLOW, team: INK };
const barColour = { personal: YELLOW, team: BLUE };

const mode = process.argv[2];
const desktop = mode === "desktop";

function ribbon(kind) {
	const c = ribbonColour[kind];
	const tail = (dir) => {
		const x0 = 50 + dir * 34;
		const x1 = 50 + dir * 47;
		const xn = 50 + dir * 43;
		return `<path d="M${x0},73 L${x1},73 L${xn},79.5 L${x1},86 L${x0},86 Z" fill="${c}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>`;
	};
	return `${tail(-1)}${tail(1)}<rect x="13" y="70" width="74" height="14" rx="1.5" fill="${c}" stroke="${INK}" stroke-width="1"/>`;
}

function badge(kind, x, y, s, text) {
	const inner = placeholderSvg(kind)
		.replace(/^<svg[^>]*>/, "")
		.replace(/<\/svg>\s*$/, "");
	const r = text
		? `${ribbon(kind)}<text x="50" y="77.3" text-anchor="middle" dominant-baseline="middle" font-family="Inter" font-weight="700" font-size="${text.length > 9 ? 7.6 : 9}" fill="${textColour[kind]}">${text}</text>`
		: "";
	return `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 100 100">${inner}${r}</svg>`;
}

const t = (x, y, s, size, weight = 400, colour = INK, anchor = "start") =>
	`<text x="${x}" y="${y}" font-family="Inter" font-size="${size}" font-weight="${weight}" fill="${colour}" text-anchor="${anchor}">${s}</text>`;

const bar = (x, y, w, frac, kind) =>
	`<rect x="${x}" y="${y}" width="${w}" height="8" rx="4" fill="#e8e6dc"/><rect x="${x}" y="${y}" width="${Math.max(8, w * frac)}" height="8" rx="4" fill="${barColour[kind]}" stroke="${INK}" stroke-width="1"/>`;

/** The card of a category's newest badge. */
function card(x, y, w, kind, category, value, frac, left) {
	const bx = x + (w - 128) / 2;
	let s = `<rect x="${x}" y="${y}" width="${w}" height="210" rx="16" fill="#ffffff" stroke="#e6e3d6"/>`;
	s += t(x + w / 2, y + 24, category, 13, 700, INK, "middle");
	s += badge(kind, bx, y + 34, 128, value);
	s += bar(x + 14, y + 176, w - 28, frac, kind);
	s += t(x + w / 2, y + 202, left, 12, 400, GREY, "middle");
	return s;
}

function tile(x, y, kind, value) {
	return (
		badge(kind, x, y, 96) + t(x + 48, y + 112, value, 12, 400, GREY, "middle")
	);
}

function toggle(x, y, w, label, open) {
	const cx = x + w - 20;
	const chevron = open
		? `M${cx - 6},${y + 25} l6,-6 l6,6`
		: `M${cx - 6},${y + 19} l6,6 l6,-6`;
	return `<rect x="${x}" y="${y}" width="${w}" height="44" rx="12" fill="#ffffff" stroke="#e6e3d6"/>${t(x + 14, y + 28, label, 14, 700)}<path d="${chevron}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const W = desktop ? 1100 : 360;
const M = desktop ? 70 : 16;
const CW = W - 2 * M;
const COLS = desktop ? 4 : 2;
const GAP = desktop ? 24 : 16;
const cardW = (CW - (COLS - 1) * GAP) / COLS;
const GCOLS = desktop ? 8 : 3;
const gStep = (CW - 96) / (GCOLS - 1);

let s = "";
let y = 0;

// App bar: mobile shows the section title; desktop shows the top navigation.
if (desktop) {
	s += `<rect width="${W}" height="64" fill="${INK}"/>${t(M, 40, "RynkePoints", 20, 700, YELLOW)}`;
	["Du", "Fahrten", "Team", "Einstellungen"].forEach((n, i) => {
		const x = 560 + i * 120;
		s += t(x, 40, n, 15, i === 0 ? 700 : 400, i === 0 ? YELLOW : "#d9d6c8");
		if (i === 0)
			s += `<rect x="${x}" y="52" width="22" height="3" rx="1.5" fill="${YELLOW}"/>`;
	});
	y = 116;
} else {
	s += `<rect width="${W}" height="56" fill="${INK}"/>${t(M, 35, "Du", 18, 700, YELLOW)}`;
	y = 92;
}

s += t(M, y, "Abzeichen", desktop ? 28 : 22, 700);
y += 22;
if (desktop) {
	s += t(
		M,
		y + 4,
		"Wie weit es noch bis zum nächsten Abzeichen ist – welches es wird, bleibt geheim.",
		14,
		400,
		GREY,
	);
	y += 44;
} else {
	s += t(
		M,
		y,
		"Wie weit es noch bis zum nächsten Abzeichen ist –",
		12,
		400,
		GREY,
	);
	y += 16;
	s += t(M, y, "welches es wird, bleibt geheim.", 12, 400, GREY);
	y += 34;
}

function cards(list) {
	list.forEach((c, i) => {
		const col = i % COLS;
		if (i && col === 0) y += 222;
		s += card(M + col * (cardW + GAP), y, cardW, ...c);
	});
	y += 228;
}

let hover = null;

s += t(M, y, "Meine neuesten Abzeichen", 15, 700);
y += 12;
cards([
	["personal", "Längster Lauf", "Halbmarathon", 0.5, "Noch 21,1 km"],
	["personal", "Trainings-Rynke", "150 Rynke", 0.5, "Noch 50 Rynke"],
	["personal", "Distanz", "1.000 km", 0.33, "Noch 1.500 km"],
	["personal", "Teamtermine", "5 Termine", 0.2, "Noch 5 Termine"],
]);

s += toggle(M, y, CW, "Alle meine Abzeichen (14)", true);
y += 60;
for (const [cat, items] of [
	["Distanz", ["1.000 km", "500 km", "100 km"]],
	[
		"Trainings-Rynke",
		["150 Rynke", "100 Rynke", "50 Rynke", "25 Rynke", "1 Rynke"],
	],
]) {
	s += t(M, y, cat, 13, 700, GREY);
	y += 10;
	items.forEach((v, i) => {
		if (i && i % GCOLS === 0) y += 128;
		const x = M + (i % GCOLS) * gStep;
		s += tile(x, y, "personal", v);
		if (desktop && cat === "Distanz" && i === 1) hover = { x, y };
	});
	y += 140;
}
s += t(M, y, "… Längster Lauf, Teamtermine", 12, 400, GREY);
y += 34;

s += t(M, y, "Team-Abzeichen", 15, 700);
y += 12;
cards([
	["team", "Gemeinsam", "5.000 Rynke", 0.6, "Noch 2.500 Rynke"],
	["team", "Große Ausfahrt", "15 Fahrer", 0.4, "Noch 5 Fahrer"],
]);
s += toggle(M, y, CW, "Alle Team-Abzeichen (5)", false);
y += 76;

s += t(M, y, "Noch kein Abzeichen", 15, 700);
y += 10;
const rows = [
	["Höhenmeter", 0.62, "Noch 380 m", "personal"],
	["Laufen gesamt", 0.3, "Noch 7 km", "personal"],
	["Techniktraining", 0, "Noch 1 Training", "personal"],
	["Laufen gemeinsam", 0.45, "Noch 55 km", "team"],
];
const RCOLS = desktop ? 2 : 1;
const rw = (CW - (RCOLS - 1) * 40) / RCOLS;
rows.forEach(([label, frac, left, kind], i) => {
	const col = i % RCOLS;
	if (col === 0) y += 22;
	const x = M + col * (rw + 40);
	s += t(x, y, label, 13, 700);
	s += t(x + rw, y, left, 12, 400, GREY, "end");
	s += bar(x, y + 8, rw, frac, kind);
	if (col === RCOLS - 1 || i === rows.length - 1) y += 22;
});

// Desktop: the large view of the hovered gallery badge.
if (hover) {
	const px = hover.x + 116;
	const py = hover.y - 170;
	s += `<rect x="${hover.x - 4}" y="${hover.y - 4}" width="104" height="104" rx="52" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="4 4"/>`;
	s += `<rect x="${px + 4}" y="${py + 6}" width="320" height="440" rx="20" fill="#000" opacity="0.12"/>`;
	s += `<rect x="${px}" y="${py}" width="320" height="440" rx="20" fill="#ffffff" stroke="#e6e3d6"/>`;
	s += badge("personal", px + 20, py + 16, 280, "500 km");
	s += t(px + 160, py + 330, "Wochenend-Krieger", 20, 700, INK, "middle");
	s += t(
		px + 160,
		py + 360,
		"500 km mit dem Rad gefahren",
		15,
		400,
		GREY,
		"middle",
	);
	s += t(
		px + 160,
		py + 386,
		"erreicht am 19. April 2026",
		15,
		400,
		GREY,
		"middle",
	);
	s += t(
		px + 160,
		py + 418,
		"(beim Zeigen mit der Maus)",
		12,
		400,
		GREY,
		"middle",
	);
}

const H = y + 30;
s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fbfaf5"/>${s}</svg>`;
writeFileSync(process.argv[3], s);
