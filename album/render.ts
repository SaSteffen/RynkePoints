// The album as one HTML document, one `<section class="page">` per A4 page
// (feature 021 research R13). Placeholder until the summary and sticker pages
// follow (US4, US5).

import { escapeHtml } from "../src/http/html";
import type { AlbumEnv } from "./routes";

export async function albumHtml(
	_db: D1Database,
	_env: AlbumEnv,
	rider: { athleteId: number; firstName: string },
	cutoff: string,
	_now: number,
): Promise<string> {
	return `<!doctype html><html lang="de"><head><meta charset="utf-8"><link rel="stylesheet" href="/album.css"></head><body><section class="page"><h1>${escapeHtml(rider.firstName)}</h1><p>${escapeHtml(cutoff)}</p></section><section class="page"></section></body></html>`;
}
