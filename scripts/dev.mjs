#!/usr/bin/env node
// Fake mode for every team (feature 026 contracts/dev-commands.md): each team's
// app on its own host and port, with the in-process fake Strava and its
// synthetic sample riders. Never reads .dev.vars.
//
//   node scripts/dev.mjs          # every registered team, in parallel
//   node scripts/dev.mjs europe   # one team
//
// Per team: local D1 migrations into `.wrangler/fake-state-<id>`, then
// `wrangler dev dev/worker.ts`. Every line is prefixed `[<id>]`. Ctrl+C or
// SIGTERM stops every team; a team that exits stops the others, and the script
// exits with its code.
import { spawn } from "node:child_process";
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

export function devArgs(target) {
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

async function startTeam(target) {
	// CI=1: applies without asking for confirmation.
	const migrated = await run(target, migrateArgs(target), {
		env: { CI: "1" },
	});
	if (stopping) return;
	if (migrated !== 0) return stopAll(migrated);
	let announced = false;
	const code = await run(target, devArgs(target), {
		onLine(line) {
			if (!announced && line.includes("Ready on")) {
				announced = true;
				process.stdout.write(
					`${target.id} → http://${target.host}:${target.port}\n`,
				);
			}
		},
	});
	// A team that stops on its own stops the others.
	if (!stopping) stopAll(code);
}

async function main() {
	let targets;
	try {
		targets = devTargets(await loadTeams(), process.argv.slice(2));
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
	const taken = await takenPorts(targets);
	if (taken.length > 0) {
		for (const { id, what, port } of taken) {
			console.error(`[${id}] ${what} ${port} is taken; nothing started`);
		}
		process.exit(1);
	}
	process.on("SIGINT", () => stopAll(0, "SIGINT"));
	process.on("SIGTERM", () => stopAll(0, "SIGTERM"));
	process.on("SIGHUP", () => stopAll(0, "SIGTERM"));
	await Promise.all(targets.map(startTeam));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
