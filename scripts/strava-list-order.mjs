#!/usr/bin/env node
// Asks the real Strava once how it lists an athlete's activities when no start
// date is given: how many per request, and in which order. Strava documents
// neither, and the ride edit re-check rests on "200, newest first"
// (specs/036-ride-edit-recheck/research.md R3, quickstart "Before building").
//
//   node scripts/strava-list-order.mjs
//
// A manual maintainer task, for your own account only. It reads
// STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET from the environment (.dev.vars
// through .envrc), opens Strava's sign-in in your browser, takes the answer on
// http://localhost:8793 and makes one list request. With STRAVA_ACCESS_TOKEN
// set it skips the sign-in and uses that token.
//
// It costs one read of the app's budget. It asks for the scopes the app asks
// for, so your existing connection keeps what it has. The token is kept in
// memory only; nothing is stored, nothing is written to Strava, and the
// athlete is not deauthorised. It prints counts and dates, no activity.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

const PORT = 8793;
const REDIRECT = `http://localhost:${PORT}/callback`;
// The same scopes as REQUESTED_SCOPES in src/http/auth.ts.
const SCOPES = "read,activity:read,activity:read_all";
const LIST =
	"https://www.strava.com/api/v3/athlete/activities?page=1&per_page=200";

function fail(message) {
	console.error(message);
	process.exit(1);
}

/** Waits for Strava's redirect to this machine and returns the code. */
function waitForCode(state) {
	return new Promise((resolve, reject) => {
		const server = createServer((request, response) => {
			const url = new URL(request.url ?? "/", REDIRECT);
			if (url.pathname !== "/callback") {
				response.writeHead(404).end();
				return;
			}
			const error = url.searchParams.get("error");
			const code = url.searchParams.get("code");
			const ok = !error && code && url.searchParams.get("state") === state;
			response
				.writeHead(ok ? 200 : 400, {
					"content-type": "text/plain; charset=utf-8",
				})
				.end(
					ok
						? "Done. You can close this tab."
						: "That didn't work. See the terminal.",
				);
			server.close();
			if (ok) resolve(code);
			else
				reject(
					new Error(
						error ? `Strava answered: ${error}` : "state or code missing",
					),
				);
		});
		server.on("error", reject);
		server.listen(PORT, "localhost");
	});
}

async function signIn() {
	const clientId = process.env.STRAVA_CLIENT_ID;
	const clientSecret = process.env.STRAVA_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		fail(
			"STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set (or STRAVA_ACCESS_TOKEN).",
		);
	}
	const state = randomBytes(16).toString("hex");
	const authorize = new URL("https://www.strava.com/oauth/authorize");
	authorize.search = new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT,
		response_type: "code",
		approval_prompt: "auto",
		scope: SCOPES,
		state,
	}).toString();

	const code = waitForCode(state);
	console.log(
		`Open this in your browser if it doesn't open by itself:\n\n${authorize}\n`,
	);
	execFile("xdg-open", [authorize.toString()], () => {});

	const response = await fetch("https://www.strava.com/oauth/token", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			code: await code,
			grant_type: "authorization_code",
		}),
	});
	if (!response.ok) fail(`Token exchange failed: ${response.status}`);
	const body = await response.json();
	if (typeof body.access_token !== "string")
		fail("Token exchange returned no access token.");
	return body.access_token;
}

const token = process.env.STRAVA_ACCESS_TOKEN || (await signIn());

const response = await fetch(LIST, {
	headers: { authorization: `Bearer ${token}` },
});
if (!response.ok)
	fail(`List request failed: ${response.status} ${await response.text()}`);
const list = await response.json();
if (!Array.isArray(list)) fail("The answer is not a list.");

const starts = list.map((activity) => Date.parse(activity.start_date));
const newestFirst = starts.every(
	(start, i) => i === 0 || start <= starts[i - 1],
);
const oldestFirst = starts.every(
	(start, i) => i === 0 || start >= starts[i - 1],
);

console.log(`count:        ${list.length}`);
console.log(`newest first: ${newestFirst}`);
if (!newestFirst) console.log(`oldest first: ${oldestFirst}`);
if (list.length > 0) {
	console.log(`first entry:  ${list[0].start_date}`);
	console.log(`last entry:   ${list[list.length - 1].start_date}`);
}
console.log(
	`read usage:   ${response.headers.get("x-readratelimit-usage") ?? "not reported"}`,
);

const full = list.length === 200;
if (newestFirst && full) {
	console.log("\nAs the plan assumes: 200 per request, newest first.");
} else if (newestFirst) {
	console.log(
		"\nNewest first. Fewer than 200: fine if the account has fewer activities, otherwise revisit the plan.",
	);
} else {
	console.log("\nNot newest first: stop and revisit the plan (research R3).");
	process.exitCode = 1;
}
