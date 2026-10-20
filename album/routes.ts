// The local album Worker's routes (feature 021 research R12,
// contracts/album-worker.md). `worker.ts` is the entry `wrangler dev` runs and
// hands in the fonts; this file holds everything else, so tests run it
// without Wrangler's module rules. It answers only local hosts and
// reads D1 only through the read-only guard.

import {
	type ListedRiderRow,
	listListedRidersStatement,
} from "../src/db/organiser";
import { isCalendarDate } from "../src/rynke/rules";
import { readOnly } from "./guard";
import { albumHtml } from "./render";
import { ALBUM_CSS } from "./style";

export type AlbumEnv = Pick<
	Env,
	"DB" | "SEASON_START_DATE" | "QUALIFICATION_DEADLINE"
>;

/** What `worker.ts` bundles through Wrangler's module rule. */
export interface AlbumFiles {
	/** By file name, e.g. `Nunito-Regular.woff2`. */
	fonts: Readonly<Record<string, ArrayBuffer>>;
}

const LOCAL_HOSTS = ["127.0.0.1", "localhost"];

function notFound(): Response {
	return new Response("Not found", {
		status: 404,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

function badRequest(): Response {
	return new Response("cutoff must be a date YYYY-MM-DD", {
		status: 400,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

const TRANSLITERATION: Record<string, string> = {
	ä: "ae",
	ö: "oe",
	ü: "ue",
	ß: "ss",
	æ: "ae",
	ø: "oe",
	å: "aa",
};

/** A first name as the start of a file name: lower case ASCII, `-` between. */
export function fileStem(firstName: string): string {
	const ascii = firstName
		.toLowerCase()
		.replace(/[äöüßæøå]/g, (c) => TRANSLITERATION[c] ?? c)
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return ascii || "rider";
}

/** The listed riders with their PDFs' file stems (`anna-1`, `ben-1`, `ben-2`). */
export function albumFiles(
	rows: readonly ListedRiderRow[],
): { athleteId: number; file: string }[] {
	const seen = new Map<string, number>();
	return rows.map((row) => {
		const stem = fileStem(row.first_name);
		const n = (seen.get(stem) ?? 0) + 1;
		seen.set(stem, n);
		return { athleteId: row.athlete_id, file: `${stem}-${n}` };
	});
}

async function listedRiders(db: D1Database): Promise<ListedRiderRow[]> {
	return (await listListedRidersStatement(db).all<ListedRiderRow>()).results;
}

export async function handleAlbumRequest(
	request: Request,
	env: AlbumEnv,
	files: AlbumFiles,
	now: () => number = () => Math.floor(Date.now() / 1000),
): Promise<Response> {
	const url = new URL(request.url);
	if (!LOCAL_HOSTS.includes(url.hostname) || request.method !== "GET") {
		return notFound();
	}
	if (url.pathname === "/album.css") {
		return new Response(ALBUM_CSS, {
			headers: { "Content-Type": "text/css; charset=utf-8" },
		});
	}
	const font = url.pathname.match(/^\/fonts\/([\w.-]+\.woff2)$/)?.[1];
	if (font !== undefined) {
		const data = Object.hasOwn(files.fonts, font) ? files.fonts[font] : null;
		return data
			? new Response(data, { headers: { "Content-Type": "font/woff2" } })
			: notFound();
	}
	const album = url.pathname.match(/^\/album\/(\d+)$/);
	if (url.pathname !== "/riders" && !album) return notFound();

	const cutoff = url.searchParams.get("cutoff") ?? "";
	if (!isCalendarDate(cutoff)) return badRequest();
	const db = readOnly(env.DB);
	const riders = await listedRiders(db);
	if (!album) return Response.json(albumFiles(riders));

	const athleteId = Number(album[1]);
	const rider = riders.find((row) => row.athlete_id === athleteId);
	if (!rider) return notFound();
	return new Response(
		await albumHtml(
			db,
			env,
			{ athleteId, firstName: rider.first_name },
			cutoff,
			now(),
		),
		{ headers: { "Content-Type": "text/html; charset=utf-8" } },
	);
}
