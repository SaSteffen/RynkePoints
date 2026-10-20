// The season album's stylesheet (feature 021 research R13,
// contracts/album-layout.md), served at /album.css, after the Claude Design
// mock-up "RynkePoints Saisonalbum": white paper, the app's yellow for the
// rider's pages, team blue for the team's, ink #1c1b13, Nunito. One section
// per A4 page; layout.ts places everything in it. A string like the app's own
// (src/http/style.ts), so the Worker needs no module rule for it and tests read
// it directly. No `filter` anywhere: Chromium would print it as an image
// (FR-054).

export const ALBUM_CSS = `@font-face {
	font-family: "Nunito";
	font-weight: 400;
	src: url("/fonts/Nunito-Regular.woff2") format("woff2");
}

@font-face {
	font-family: "Nunito";
	font-weight: 700;
	src: url("/fonts/Nunito-Bold.woff2") format("woff2");
}

@font-face {
	font-family: "Nunito";
	font-weight: 900;
	src: url("/fonts/Nunito-Black.woff2") format("woff2");
}

/* Only the owner's name on the cover, as if written in by hand. */
@font-face {
	font-family: "Schoolbell";
	font-weight: 400;
	src: url("/fonts/Schoolbell-Regular.woff2") format("woff2");
}

@page {
	size: 210mm 297mm;
	margin: 0;
}

* {
	box-sizing: border-box;
}

html,
body {
	margin: 0;
	padding: 0;
	background: #ffffff;
}

body {
	color: #1c1b13;
	font-family: "Nunito", sans-serif;
	font-variant-numeric: tabular-nums;
	-webkit-print-color-adjust: exact;
	print-color-adjust: exact;
}

p,
h1,
h2 {
	margin: 0;
}

.page {
	position: relative;
	width: 210mm;
	height: 297mm;
	overflow: hidden;
	background: #ffffff;
	break-after: page;
}

.page:last-child {
	break-after: auto;
}

.safe {
	position: absolute;
}

/* The page band: group name, count, the page number on the outer side. */
.band {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	display: flex;
	align-items: center;
	gap: 3.7mm;
	padding: 0 5.3mm;
	border-radius: 3.7mm;
	border: 0.53mm solid #1c1b13;
}

.band-personal {
	background: #fbe122;
}

.band-team {
	background: #8cc4f0;
}

.band h1 {
	flex: 1;
	font-size: 16.5pt;
	font-weight: 900;
}

.page-left .band .page-number {
	order: -1;
}

.page-number {
	font-size: 9.75pt;
	font-weight: 900;
}

.chip {
	display: inline-flex;
	align-items: center;
	height: 6.9mm;
	padding: 0 3.2mm;
	border-radius: 3.45mm;
	background: #ffffff;
	border: 0.53mm solid #1c1b13;
	font-size: 9.75pt;
	font-weight: 900;
}

/* Page 1: title and the rider's season. */
.cover {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	gap: 7.4mm;
}

.cover-band {
	flex: none;
	height: 158.75mm;
	border-radius: 7.4mm;
	background: #fbe122;
	border: 0.8mm solid #1c1b13;
	padding: 9.5mm 10.6mm;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.cover-team {
	font-size: 11.25pt;
	font-weight: 900;
	letter-spacing: 0.14em;
	text-transform: uppercase;
}

.cover-band h1 {
	margin-top: 2.6mm;
	font-size: 60pt;
	line-height: 63pt;
	font-weight: 900;
	letter-spacing: -0.01em;
}

.cover-season {
	margin-top: 1.6mm;
	font-size: 21pt;
	line-height: 25.5pt;
	font-weight: 900;
}

/* Both sides of the coin, next to each other. */
.cover-coins {
	display: flex;
	gap: 8mm;
	margin-top: 8mm;
}

.cover-coins img {
	width: 72mm;
	height: 72mm;
	object-fit: contain;
}

.owner {
	flex: none;
	display: flex;
	align-items: center;
	gap: 5.3mm;
	padding: 5.3mm 7.4mm;
	border-radius: 5.3mm;
	border: 0.53mm dashed #1c1b13;
}

.owner-label {
	flex: none;
	width: 39.7mm;
	font-size: 12pt;
	line-height: 15pt;
	font-weight: 700;
	color: #4a4633;
}

.owner-name {
	flex: 1;
	font-family: "Schoolbell", "Nunito", cursive;
	font-size: 40pt;
	line-height: 46pt;
	font-weight: 400;
}

.figures {
	flex: none;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 4.2mm;
}

.figure {
	display: flex;
	flex-direction: column;
	gap: 1.6mm;
	padding: 4.8mm 5.3mm;
	border-radius: 5.3mm;
	background: #fffdf5;
	border: 0.53mm solid #1c1b13;
}

.figure-value {
	display: flex;
	align-items: center;
	gap: 2.6mm;
	font-size: 33pt;
	line-height: 36pt;
	font-weight: 900;
}

.figure .coin {
	width: 7.9mm;
	height: 7.9mm;
	flex: none;
}

.figure-label {
	font-size: 12.75pt;
	font-weight: 900;
}

.cutoff {
	margin-top: auto;
	font-size: 9.75pt;
	line-height: 13.5pt;
	font-weight: 700;
	color: #4a4633;
	text-align: right;
}

/* Page 2: the team's season. */
.team-total {
	position: absolute;
	left: 1mm;
	right: 0;
	display: flex;
	align-items: center;
	gap: 3.7mm;
	font-size: 15pt;
	font-weight: 900;
}

.team-total .coin {
	width: 10.6mm;
	height: 10.6mm;
	flex: none;
}

.team-total-value {
	font-size: 25.5pt;
}

.events {
	position: absolute;
	left: 0;
	right: 0;
}

.events table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
	font-size: 8pt;
	line-height: 10pt;
}

.events th,
.events td {
	padding: 0 1.6mm;
	text-align: left;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.events th {
	font-weight: 900;
}

.events thead tr {
	border-bottom: 0.53mm solid #1c1b13;
}

.events tbody tr {
	border-bottom: 0.26mm solid #d3cdb2;
}

.events .date {
	width: 19.6mm;
}

.events th.kind {
	width: 45mm;
}

.events .riders {
	width: 14.3mm;
	text-align: right;
}

.events .you {
	width: 10.6mm;
	text-align: center;
}

.events tr.tour {
	background: #fff7c2;
}

.events tr.tour .kind {
	font-weight: 900;
}

.tick {
	width: 3.7mm;
	height: 3.7mm;
	vertical-align: middle;
}

.events-footer {
	margin-top: 2.6mm;
	font-size: 8pt;
	line-height: 10pt;
	color: #4a4633;
}

.events-footer .tick {
	width: 3.2mm;
	height: 3.2mm;
	vertical-align: -0.3mm;
}

/* Sticker pages. */
.heading {
	position: absolute;
	left: 0;
	right: 0;
	height: 9mm;
	display: flex;
	align-items: center;
	gap: 2.6mm;
	font-size: 12pt;
	font-weight: 900;
}

.heading-count {
	font-size: 9pt;
	font-weight: 700;
	color: #4a4633;
}

.heading-rule {
	flex: 1;
	height: 0;
	border-top: 0.4mm solid #1c1b13;
}

.slot {
	position: absolute;
}

.placeholder-box {
	position: absolute;
}

.placeholder {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: visible;
}

.placeholder circle {
	fill: none;
	stroke: #7a755c;
	stroke-width: 1.6;
	stroke-dasharray: 4 3;
}

.secret {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 54pt;
	font-weight: 900;
	color: #7a755c;
}

/*
 * A sticker lying flat on the paper: a sharp, tight shadow. No blur radius:
 * Chromium prints a blurred shadow as a grey image; unblurred layers stay
 * vector shapes, and two of them stand in for the soft edge.
 */
.sticker {
	position: absolute;
	border-radius: 50%;
	background: #ffffff;
	box-shadow:
		0 0.08mm 0 rgba(28, 27, 19, 0.3),
		0 0.2mm 0 rgba(28, 27, 19, 0.16),
		0 0 0 0.16mm rgba(28, 27, 19, 0.22);
}

.sticker img,
.ribbon-box {
	position: absolute;
}

.ribbon {
	display: block;
	width: 100%;
	height: 100%;
	overflow: visible;
}

.ribbon text {
	font-family: "Nunito", sans-serif;
	font-weight: 900;
	letter-spacing: 0.04em;
}

.ribbon-defs {
	position: absolute;
}

.caption {
	position: absolute;
	left: 1mm;
	right: 1mm;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.caption p {
	max-width: 100%;
	overflow: hidden;
}

.caption-name {
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 9pt;
	line-height: 11.25pt;
	font-weight: 700;
	color: #4a4633;
}

.slot-earned .caption-name {
	font-weight: 900;
	color: #1c1b13;
}

/* What it was for: up to three lines. */
.caption-for {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 3;
	font-size: 7pt;
	line-height: 8.25pt;
	font-weight: 400;
	color: #1c1b13;
}

.caption-value,
.caption-date {
	white-space: nowrap;
	font-size: 7pt;
	line-height: 8.25pt;
	font-weight: 700;
	color: #4a4633;
}
`;
