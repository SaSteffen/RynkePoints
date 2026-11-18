#!/usr/bin/env node
// Settles research R1 of the guest feature (specs/041-admin-every-team,
// quickstart §1): can two teams hold their own Strava token for the same
// person without breaking each other? A manual step for the maintainer, with
// their own Strava account and the app in .dev.vars. Never run by tests.
//
//   node scripts/strava-token-check.mjs start            authorize twice, check at once
//   node scripts/strava-token-check.mjs finish           about 5½ hours later
//   node scripts/strava-token-check.mjs finish --revoke  also: does a revoke reach the other?
//
// `start` opens a one-off listener on localhost for Strava's redirect, so you
// only approve twice in the browser. The tokens stay in a state file in your
// home directory (mode 600), never in the repository and never on screen;
// `finish` deletes it. About ten requests from the app's Strava budget.
//
// Outcomes: A, independent (a guest's rides can be read); B, a refresh at one
// breaks the other (the guest site must not read); C, the second sign-in
// already breaks the first (back to the spec).
//
// With --revoke the second token is revoked at the end. If revoking reaches
// the first token too and the app is the production one, your own connection
// to your team ends: reconnect on your team's site afterwards.
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

process.chdir(new URL("..", import.meta.url).pathname);

const STRAVA = "https://www.strava.com";
const STATE = join(
	homedir(),
	".cache",
	"rynkepoints",
	"strava-token-check.json",
);
const SCOPE = "read,activity:read";

function die(message) {
	console.error(message);
	process.exit(1);
}

/** STRAVA_CLIENT_ID / _SECRET from the environment, else from .dev.vars. */
function credentials() {
	const vars = {};
	if (existsSync(".dev.vars")) {
		for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
			const m = line.match(/^\s*(STRAVA_CLIENT_(?:ID|SECRET))\s*=\s*(.*?)\s*$/);
			if (m) vars[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
		}
	}
	const id = process.env.STRAVA_CLIENT_ID ?? vars.STRAVA_CLIENT_ID;
	const secret = process.env.STRAVA_CLIENT_SECRET ?? vars.STRAVA_CLIENT_SECRET;
	if (!id || !secret) {
		die(
			"No STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .dev.vars or the environment.",
		);
	}
	return { id, secret };
}

async function tokenRequest(app, params) {
	const res = await fetch(`${STRAVA}/oauth/token`, {
		method: "POST",
		body: new URLSearchParams({
			client_id: app.id,
			client_secret: app.secret,
			...params,
		}),
	});
	const body = await res.json().catch(() => ({}));
	return res.ok && body.refresh_token
		? {
				ok: true,
				access: body.access_token,
				refresh: body.refresh_token,
				expiresAt: body.expires_at,
				athlete: body.athlete?.id,
			}
		: { ok: false, status: res.status, message: body.message ?? "" };
}

const refresh = (app, token) =>
	tokenRequest(app, { grant_type: "refresh_token", refresh_token: token });

/** HTTP status of GET /athlete with an access token. */
async function athleteStatus(access) {
	const res = await fetch(`${STRAVA}/api/v3/athlete`, {
		headers: { Authorization: `Bearer ${access}` },
	});
	await res.arrayBuffer();
	return res.status;
}

/** Waits for one Strava redirect on localhost and returns its code. */
async function authorize(app, label) {
	let finish;
	const code = new Promise((resolve, reject) => {
		finish = { resolve, reject };
	});
	const server = createServer((req, res) => {
		const url = new URL(req.url ?? "/", "http://localhost");
		if (url.pathname !== "/callback") {
			res.writeHead(404).end();
			return;
		}
		res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
		if (url.searchParams.get("code")) {
			res.end("Got it. Back to the terminal.");
			finish.resolve(url.searchParams.get("code"));
		} else {
			res.end("Strava sent no code. Back to the terminal.");
			finish.reject(new Error(url.searchParams.get("error") ?? "no code"));
		}
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address();
	const link = new URL(`${STRAVA}/oauth/authorize`);
	link.search = new URLSearchParams({
		client_id: app.id,
		redirect_uri: `http://localhost:${port}/callback`,
		response_type: "code",
		scope: SCOPE,
		approval_prompt: "force",
	}).toString();
	console.log(`\n${label}: open this link and approve:\n\n  ${link}\n`);
	try {
		return await code;
	} finally {
		server.close();
	}
}

function save(state) {
	mkdirSync(dirname(STATE), { recursive: true, mode: 0o700 });
	writeFileSync(STATE, `${JSON.stringify(state, null, "\t")}\n`, {
		mode: 0o600,
	});
}

function load() {
	if (!existsSync(STATE)) die("No check started: run `start` first.");
	return JSON.parse(readFileSync(STATE, "utf8"));
}

const when = (epoch) => new Date(epoch * 1000).toLocaleString();

function report(outcome, lines) {
	console.log(`\nOutcome ${outcome}`);
	for (const line of lines) console.log(`  - ${line}`);
	console.log(
		"\nTell Claude (or write it into research R1) the outcome and the lines above.",
	);
}

async function start() {
	if (existsSync(STATE)) {
		die(
			`A check is already running (${STATE}). Run \`finish\`, or delete the file to start over.`,
		);
	}
	const app = credentials();
	const first = await tokenRequest(app, {
		grant_type: "authorization_code",
		code: await authorize(
			app,
			"1/2 First authorization (stands for your home team)",
		),
	});
	if (!first.ok)
		die(`The first code exchange failed: ${first.status} ${first.message}`);
	const second = await tokenRequest(app, {
		grant_type: "authorization_code",
		code: await authorize(
			app,
			"2/2 Second authorization (stands for the guest team)",
		),
	});
	if (!second.ok)
		die(`The second code exchange failed: ${second.status} ${second.message}`);
	if (first.athlete !== second.athlete) {
		die(
			"The two approvals came from different Strava accounts: use the same one twice.",
		);
	}

	const facts = [
		`second exchange gave ${second.refresh === first.refresh ? "the same" : "a different"} refresh token`,
	];
	const firstAthlete = await athleteStatus(first.access);
	const firstRefresh = await refresh(app, first.refresh);
	facts.push(
		`right after it: first access token → ${firstAthlete}, first refresh → ${firstRefresh.ok ? "ok" : `${firstRefresh.status} ${firstRefresh.message}`}`,
	);
	if (firstAthlete !== 200 || !firstRefresh.ok) {
		report("C: the second sign-in already breaks the first", facts);
		return;
	}
	const firstChain = firstRefresh.refresh;
	save({
		first: { refresh: firstChain, expiresAt: firstRefresh.expiresAt },
		second: { refresh: second.refresh, expiresAt: second.expiresAt },
		facts,
	});
	const ready = Math.max(firstRefresh.expiresAt, second.expiresAt) - 3500;
	console.log(`\nBoth tokens work after the second sign-in (not outcome C).`);
	console.log(
		`Strava renews tokens only in their last hour. Run this after ${when(ready)}:`,
	);
	console.log(
		`\n  node scripts/strava-token-check.mjs finish            (add --revoke for the revoke question)\n`,
	);
}

async function finish(withRevoke) {
	const state = load();
	const app = credentials();
	const ready = Math.max(state.first.expiresAt, state.second.expiresAt) - 3500;
	if (Date.now() / 1000 < ready) {
		die(`Too early: Strava wouldn't renew yet. Run it after ${when(ready)}.`);
	}
	const facts = [...state.facts];

	// The home team refreshes first, as it would.
	const first = await refresh(app, state.first.refresh);
	if (!first.ok) {
		facts.push(`first refresh later → ${first.status} ${first.message}`);
		report("C: the first token broke after the second sign-in", facts);
		rmSync(STATE);
		return;
	}
	const renewed = first.refresh !== state.first.refresh;
	facts.push(
		`first refresh → ok, ${renewed ? "a new" : "the same"} refresh token`,
	);
	if (!renewed && first.expiresAt === state.first.expiresAt) {
		die(
			"Strava didn't renew the first token yet, so nothing is tested. Try again in a few minutes.",
		);
	}

	// Then the guest team refreshes its own.
	const second = await refresh(app, state.second.refresh);
	facts.push(
		`second refresh after it → ${second.ok ? "ok" : `${second.status} ${second.message}`}`,
	);
	const firstStill = await athleteStatus(first.access);
	facts.push(`first access token after the second refresh → ${firstStill}`);
	const outcome =
		second.ok && firstStill === 200
			? "A: independent, a guest site can read a guest's rides"
			: "B: a refresh at one breaks the other, a guest site must not read";

	if (withRevoke && second.ok) {
		const res = await fetch(`${STRAVA}/oauth/revoke`, {
			method: "POST",
			headers: {
				Authorization: `Basic ${Buffer.from(`${app.id}:${app.secret}`).toString("base64")}`,
			},
			body: new URLSearchParams({ token: second.refresh }),
		});
		await res.arrayBuffer();
		const afterAccess = await athleteStatus(first.access);
		const afterRefresh = await refresh(app, first.refresh);
		facts.push(
			`revoking the second → ${res.status}; then the first access token → ${afterAccess}, first refresh → ${afterRefresh.ok ? "ok" : `${afterRefresh.status} ${afterRefresh.message}`}`,
		);
		facts.push(
			afterAccess === 200 && afterRefresh.ok
				? "a revoke reaches only its own token"
				: "a revoke reaches the other token too: reconnect on your team's site",
		);
	} else if (withRevoke) {
		facts.push("revoke skipped: the second token no longer works");
	}
	rmSync(STATE);
	report(outcome, facts);
}

const [command, flag] = process.argv.slice(2);
if (command === "start") await start();
else if (command === "finish" && (!flag || flag === "--revoke"))
	await finish(flag === "--revoke");
else
	die("Usage: node scripts/strava-token-check.mjs start | finish [--revoke]");
