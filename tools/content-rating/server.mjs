// Rating page for candidate phrases: node tools/content-rating/server.mjs [phrases file] [round]
// Serves http://localhost:8790, reads the phrase lists live from the phrases file and
// keeps the verdicts in rounds/<round>/decisions.json (git-ignored).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PHRASES = "src/content/phrases/hamburg.de.ts";
const PORT = 8790;
const quotesPath = process.argv[2] ?? DEFAULT_PHRASES;
const roundDir = join(here, "rounds", process.argv[3] ?? "current");
mkdirSync(roundDir, { recursive: true });
const decisionsPath = join(roundDir, "decisions.json");
// Optional rounds/<round>/baseline.json: phrases already rated, so the rest show as new.
const baselinePath = join(roundDir, "baseline.json");
const baseline = new Set(
	existsSync(baselinePath)
		? JSON.parse(readFileSync(baselinePath, "utf8"))
		: [],
);
const port = PORT;

function parseQuotes() {
	const quotes = [];
	let list = null;
	let seasonal = false;
	let section = "";
	for (const line of readFileSync(quotesPath, "utf8").split("\n")) {
		// SEASON_QUOTES_PUSH contains QUOTES_PUSH, so the list check covers both.
		if (line.includes("QUOTES_PUSH")) list = "push";
		else if (line.includes("QUOTES_ON_TRACK")) list = "onTrack";
		if (/QUOTES_(PUSH|ON_TRACK)\b.*[=[{]/.test(line))
			seasonal = line.includes("SEASON_");
		const comment = line.match(/^\s*\/\/\s*(.+)$/);
		if (comment && list) section = comment[1];
		const m = line.match(/^\s*"((?:[^"\\]|\\.)*)",?/);
		if (m && list)
			quotes.push({
				list,
				seasonal,
				section,
				text: m[1],
				isNew: !baseline.has(m[1]),
			});
	}
	return quotes;
}

const readDecisions = () =>
	existsSync(decisionsPath)
		? JSON.parse(readFileSync(decisionsPath, "utf8"))
		: {};

createServer((req, res) => {
	const json = (body) => {
		res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify(body));
	};
	if (req.url === "/api/quotes") return json(parseQuotes());
	if (req.url === "/api/decisions" && req.method === "GET")
		return json(readDecisions());
	if (req.url === "/api/decisions" && req.method === "POST") {
		let body = "";
		req.on("data", (chunk) => (body += chunk));
		req.on("end", () => {
			const { text, verdict, note } = JSON.parse(body);
			const decisions = readDecisions();
			// Re-inserting moves the quote to the end, so key order is decision order.
			delete decisions[text];
			if (verdict || note)
				decisions[text] = { verdict: verdict ?? null, note: note ?? "" };
			writeFileSync(decisionsPath, JSON.stringify(decisions, null, 1));
			json({ ok: true });
		});
		return;
	}
	res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
	res.end(readFileSync(join(here, "index.html")));
}).listen(port, "127.0.0.1", () => console.log(`http://localhost:${port}`));
