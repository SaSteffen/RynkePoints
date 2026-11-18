#!/usr/bin/env node
// Settles research R1 of the guest feature (specs/041-admin-every-team,
// quickstart §1): can two teams hold their own Strava token for the same
// person without breaking each other? A manual step for the maintainer, with
// their own Strava account and the app in .dev.vars. Never run by tests.
//
//   node scripts/strava-token-check.mjs start            authorize twice, check at once
//   node scripts/strava-token-check.mjs status           in between: still alive?
//   node scripts/strava-token-check.mjs finish           about 5½ hours later
//   node scripts/strava-token-check.mjs finish --revoke  then the revoke question too
//   node scripts/strava-token-check.mjs revoke           the revoke question alone, any time
//                                                        no check is running (minutes)
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
// The revoke question decides whether a team may withdraw access when it
// refuses a sign-in: a fresh authorization (the refused one) is revoked and
// the other is checked, in outcome A and B alike. If revoking reaches the
// other too and the app is the production one, your own connection to your
// team ends as well: reconnect on your team's site afterwards.
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
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

/** One authorization in the browser and its code exchange. */
async function exchange(app, label) {
	const token = await tokenRequest(app, {
		grant_type: "authorization_code",
		code: await authorize(app, label),
	});
	if (!token.ok) {
		die(`The code exchange failed: ${token.status} ${token.message}`);
	}
	return token;
}

function noCheckRunning() {
	if (existsSync(STATE)) {
		die(
			`A check is already running (${STATE}). Run \`finish\`, or delete the file to start over.`,
		);
	}
}

/**
 * Does revoking one authorization's token end another's? A fresh
 * authorization stands for a sign-in a team refuses, `home` for the person's
 * connection to their own team.
 */
async function revokeCheck(app, home) {
	const first =
		home ??
		(await exchange(
			app,
			"1/2 First authorization (stands for your home team)",
		));
	const second = await exchange(
		app,
		`${home ? "Fresh" : "2/2 Second"} authorization (stands for a sign-in another team refuses)`,
	);
	const res = await fetch(`${STRAVA}/oauth/revoke`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${Buffer.from(`${app.id}:${app.secret}`).toString("base64")}`,
		},
		body: new URLSearchParams({ token: second.refresh }),
	});
	await res.arrayBuffer();
	const revokedAccess = await athleteStatus(second.access);
	const firstAccess = await athleteStatus(first.access);
	const firstRefresh = await refresh(app, first.refresh);
	const facts = [
		`revoking the refused authorization's token → ${res.status}; its own access token after it → ${revokedAccess}`,
		`the other authorization after it: access token → ${firstAccess}, refresh → ${firstRefresh.ok ? "ok" : `${firstRefresh.status} ${firstRefresh.message}`}`,
	];
	if (revokedAccess === 200) {
		facts.push(
			"the revoke didn't take effect, so nothing is learned: run `revoke` again",
		);
	} else if (firstAccess === 200 && firstRefresh.ok) {
		facts.push(
			"REVOKE: reaches only its own authorization, a refused sign-in can be revoked safely",
		);
	} else {
		facts.push(
			"REVOKE: reaches the other authorization too, a refused sign-in must not be revoked; reconnect on your team's site",
		);
	}
	return facts;
}

async function revokeOnly() {
	noCheckRunning();
	const app = credentials();
	report("of the revoke question", await revokeCheck(app));
}

async function start() {
	noCheckRunning();
	const app = credentials();
	const first = await exchange(
		app,
		"1/2 First authorization (stands for your home team)",
	);
	const second = await exchange(
		app,
		"2/2 Second authorization (stands for the guest team)",
	);
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

	rmSync(STATE);
	if (withRevoke) {
		// The home token stands for the home connection if it still works;
		// otherwise two fresh authorizations do.
		facts.push(
			...(await revokeCheck(app, firstStill === 200 ? first : undefined)),
		);
	}
	report(outcome, facts);
}

/**
 * Are the check's tokens still alive, without waiting for `finish`? Before
 * their last hour a refresh renews nothing, so this only tells whether
 * something else (your team renewing its own token in between) broke them.
 */
async function status() {
	const state = load();
	const app = credentials();
	console.log(`Check started ${statSync(STATE).mtime.toLocaleString()}.`);
	for (const key of ["first", "second"]) {
		const token = await refresh(app, state[key].refresh);
		if (token.ok && token.refresh !== state[key].refresh) {
			state[key] = { refresh: token.refresh, expiresAt: token.expiresAt };
			save(state);
		}
		console.log(
			`  ${key} token → ${token.ok ? "alive" : `refused: ${token.status} ${token.message}`}`,
		);
	}
}

const [command, flag] = process.argv.slice(2);
if (command === "start") await start();
else if (command === "status" && !flag) await status();
else if (command === "finish" && (!flag || flag === "--revoke"))
	await finish(flag === "--revoke");
else if (command === "revoke" && !flag) await revokeOnly();
else
	die(
		"Usage: node scripts/strava-token-check.mjs start | status | finish [--revoke] | revoke",
	);
