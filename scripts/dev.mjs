#!/usr/bin/env node
// Fake mode for every team (feature 026 contracts/dev-commands.md): each team's
// app on its own host and port, with the in-process fake Strava and its
// synthetic sample riders. Never reads .dev.vars.
//
//   node scripts/dev.mjs          # every registered team behind the gateway
//   node scripts/dev.mjs europe   # one team, without the gateway
//
// Per team: local D1 migrations into `.wrangler/fake-state-<id>`, then
// `wrangler dev dev/worker.ts`. Without a team argument the local Strava
// gateway (gateway/, release 3) runs too, and every team goes through it as in
// production: riders come back from the fake's authorize screen through
// `/auth/return/<id>`, and simulated events reach every team through the
// gateway's queue. The fake Strava stays in each team's Worker: its sample
// riders and their rides belong to that team's local database.
//
// Every line is prefixed `[<id>]` or `[gateway]`. Ctrl+C or SIGTERM stops
// everything; a process that exits stops the others, and the script exits
// with its code.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { loadTeams } from "./team-check.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WRANGLER = join(ROOT, "node_modules", ".bin", "wrangler");

/**
 * The secrets wrangler.jsonc declares. Wrangler lets the shell's environment
 * override `--env-file`, so they are unset: fake mode always runs on
 * dev/fake.env's placeholders.
 */
const SECRETS = [
	"STRAVA_CLIENT_ID",
	"STRAVA_CLIENT_SECRET",
	"STRAVA_WEBHOOK_VERIFY_TOKEN",
	"TOKEN_ENCRYPTION_KEY",
	"SESSION_SIGNING_KEY",
	"ADMIN_TOKEN",
	"PUSH_VAPID_KEY",
];

/** The local gateway (contracts/dev-commands.md › Ports). */
export const GATEWAY = {
	id: "gateway",
	host: "localhost",
	port: 8791,
	inspectorPort: 9232,
	stateDir: ".wrangler/fake-state-gateway",
};
/** Synthetic, like everything in dev/fake.env: it protects nothing. */
const GATEWAY_VERIFY_TOKEN = "fake-gateway-verify-token";
/** The one subscription every team checks, as after the switch in production. */
const GATEWAY_SUBSCRIPTION_ID = "1";

const origin = (target) => `http://${target.host}:${target.port}`;

/** dev/fake.env's webhook token, every team's in fake mode. */
function fakeVerifyToken() {
	const line = readFileSync(join(ROOT, "dev", "fake.env"), "utf8")
		.split("\n")
		.find((l) => l.startsWith("STRAVA_WEBHOOK_VERIFY_TOKEN="));
	if (!line) throw new Error("dev/fake.env has no STRAVA_WEBHOOK_VERIFY_TOKEN");
	return line.slice(line.indexOf("=") + 1).trim();
}

/**
 * What to start for each team (data-model.md DevTarget). The founding team,
 * first in the registry, is wrangler.jsonc's top level; every other team is its
 * `env.<id>` block.
 */
export function devTargets(teams, ids = []) {
	const unknown = ids.filter((id) => !teams.some((team) => team.id === id));
	if (unknown.length > 0) {
		const known = teams.map((team) => team.id).join(", ");
		throw new Error(`Unknown team ${unknown.join(", ")}; teams: ${known}`);
	}
	return teams
		.filter((team) => ids.length === 0 || ids.includes(team.id))
		.map((team) => ({
			id: team.id,
			...team.dev,
			env: team === teams[0] ? null : team.id,
			stateDir: `.wrangler/fake-state-${team.id}`,
		}));
}

const envArgs = (target) => (target.env ? ["--env", target.env] : []);

export function migrateArgs(target) {
	return [
		"d1",
		"migrations",
		"apply",
		"DB",
		"--local",
		"--persist-to",
		target.stateDir,
		...envArgs(target),
	];
}

/** A team's settings behind the local gateway. */
export function behindGatewayArgs() {
	const gateway = origin(GATEWAY);
	return [
		"--var",
		`STRAVA_RETURN_VIA:${gateway}`,
		"--var",
		`RYNKE_FAKE_GATEWAY:${gateway}/strava/webhook/${GATEWAY_VERIFY_TOKEN}`,
		"--var",
		`STRAVA_SUBSCRIPTION_ID:${GATEWAY_SUBSCRIPTION_ID}`,
	];
}

/** `wrangler dev` for the gateway, forwarding to `targets`. */
export function gatewayArgs(targets, teamToken) {
	const teams = targets.map((t) => ({ id: t.id, origin: origin(t) }));
	return [
		"dev",
		"--config",
		"gateway/wrangler.jsonc",
		"--persist-to",
		GATEWAY.stateDir,
		"--port",
		String(GATEWAY.port),
		"--host",
		`${GATEWAY.host}:${GATEWAY.port}`,
		"--inspector-port",
		String(GATEWAY.inspectorPort),
		"--var",
		`TEAMS:${JSON.stringify(teams)}`,
		"--var",
		`STRAVA_WEBHOOK_VERIFY_TOKEN:${GATEWAY_VERIFY_TOKEN}`,
		...targets.flatMap((t) => [
			"--var",
			`TEAM_WEBHOOK_TOKEN_${t.id.toUpperCase().replaceAll("-", "_")}:${teamToken}`,
		]),
		"--show-interactive-dev-session=false",
	];
}

export function devArgs(target, { behindGateway = false } = {}) {
	return [
		"dev",
		"dev/worker.ts",
		...envArgs(target),
		"--env-file",
		"dev/fake.env",
		"--var",
		"RYNKE_FAKE_STRAVA:local-only",
		"--persist-to",
		target.stateDir,
		"--port",
		String(target.port),
		"--host",
		`${target.host}:${target.port}`,
		"--inspector-port",
		String(target.inspectorPort),
		"--live-reload",
		"--test-scheduled",
		// Its keys need the terminal, which the prefixed output doesn't give it.
		"--show-interactive-dev-session=false",
		...(behindGateway ? behindGatewayArgs() : []),
	];
}

/** Whether nothing listens on `port`, on any address. */
function portFree(port) {
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(false));
		server.listen(port, () => server.close(() => resolve(true)));
	});
}

async function takenPorts(targets) {
	const taken = [];
	for (const target of targets) {
		for (const [what, port] of [
			["port", target.port],
			["inspector port", target.inspectorPort],
		]) {
			if (!(await portFree(port))) taken.push({ id: target.id, what, port });
		}
	}
	return taken;
}

const childEnv = (() => {
	const env = { ...process.env, WRANGLER_SEND_METRICS: "false" };
	for (const name of SECRETS) delete env[name];
	// Wrangler's colours, although its output reaches the terminal through a pipe.
	if (process.stdout.isTTY) env.FORCE_COLOR = "1";
	return env;
})();

/** Running children; each leads its own process group (workerd included). */
const children = new Set();
let stopping = false;
let exitCode = 0;

function signalAll(signal) {
	for (const child of children) {
		try {
			process.kill(-child.pid, signal);
		} catch {
			// Already gone.
		}
	}
}

function stopAll(code, signal = "SIGTERM") {
	if (!stopping) {
		stopping = true;
		exitCode = code;
	}
	signalAll(signal);
	if (children.size === 0) process.exit(exitCode);
}

function prefixed(stream, out, prefix, onLine) {
	createInterface({ input: stream, crlfDelay: Infinity }).on("line", (line) => {
		out.write(`${prefix} ${line}\n`);
		onLine?.(line);
	});
}

/** Starts wrangler with `args` for `target`; resolves with its exit code. */
function run(target, args, { env = {}, onLine } = {}) {
	return new Promise((resolve) => {
		const child = spawn(WRANGLER, args, {
			cwd: ROOT,
			env: { ...childEnv, ...env },
			detached: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		children.add(child);
		const prefix = `[${target.id}]`;
		prefixed(child.stdout, process.stdout, prefix, onLine);
		prefixed(child.stderr, process.stderr, prefix, onLine);
		child.on("error", (error) => {
			process.stderr.write(`${prefix} ${error.message}\n`);
		});
		child.on("close", (code) => {
			children.delete(child);
			resolve(code ?? 1);
			if (stopping && children.size === 0) process.exit(exitCode);
		});
	});
}

/** Runs `args` until it exits, announcing `target`'s address once ready. */
async function serve(target, args) {
	let announced = false;
	const code = await run(target, args, {
		onLine(line) {
			if (!announced && line.includes("Ready on")) {
				announced = true;
				process.stdout.write(`${target.id} → ${origin(target)}\n`);
			}
		},
	});
	// A process that stops on its own stops the others.
	if (!stopping) stopAll(code);
}

async function startTeam(target, behindGateway) {
	// CI=1: applies without asking for confirmation.
	const migrated = await run(target, migrateArgs(target), {
		env: { CI: "1" },
	});
	if (stopping) return;
	if (migrated !== 0) return stopAll(migrated);
	await serve(target, devArgs(target, { behindGateway }));
}

async function main() {
	const ids = process.argv.slice(2);
	const behindGateway = ids.length === 0;
	let targets;
	let teamToken;
	try {
		targets = devTargets(await loadTeams(), ids);
		if (behindGateway) teamToken = fakeVerifyToken();
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
	const taken = await takenPorts(
		behindGateway ? [...targets, GATEWAY] : targets,
	);
	if (taken.length > 0) {
		for (const { id, what, port } of taken) {
			console.error(`[${id}] ${what} ${port} is taken; nothing started`);
		}
		process.exit(1);
	}
	process.on("SIGINT", () => stopAll(0, "SIGINT"));
	process.on("SIGTERM", () => stopAll(0, "SIGTERM"));
	process.on("SIGHUP", () => stopAll(0, "SIGTERM"));
	await Promise.all([
		...targets.map((target) => startTeam(target, behindGateway)),
		...(behindGateway ? [serve(GATEWAY, gatewayArgs(targets, teamToken))] : []),
	]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
