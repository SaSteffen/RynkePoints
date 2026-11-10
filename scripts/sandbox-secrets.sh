#!/usr/bin/env bash
# Sets the Worker secrets of the sandboxes (feature 027 quickstart step 3,
# research R5). A manual step for the maintainer: it writes to Cloudflare.
#
#   scripts/sandbox-secrets.sh [team ...]   default: hamburg europe
#
# The Strava, encryption and notification secrets are fake mode's synthetic
# values from dev/fake.env: a sandbox runs against the fake Strava and nothing
# there protects real data. SESSION_SIGNING_KEY and ADMIN_TOKEN are fresh random
# values, since the sandboxes are on the internet (behind Access); the admin
# token is shown once at the end. Running it again sets new ones.
#
# Needs wrangler signed in (pnpm exec wrangler login) to the account that holds
# the sandboxes. The secrets go to Wrangler on stdin, never to a file. If the
# Worker doesn't exist yet, Wrangler creates it empty; should it refuse
# instead, run this again after the sandbox's first deployment.
set -euo pipefail

cd "$(dirname "$0")/.."
TEAMS=("$@")
((${#TEAMS[@]})) || TEAMS=(hamburg europe)

die() {
	echo "$*" >&2
	exit 1
}

for team in "${TEAMS[@]}"; do
	[[ "$team" =~ ^[a-z][a-z0-9-]*$ ]] || die "Not a team id: $team"
	grep -q "\"sandbox-$team\": {" wrangler.jsonc ||
		die "wrangler.jsonc has no block sandbox-$team"
done
pnpm exec wrangler whoami >/dev/null 2>&1 ||
	die "Wrangler isn't signed in: run pnpm exec wrangler login"

# The secrets as JSON: five from dev/fake.env, two fresh.
secrets_json() {
	# shellcheck disable=SC2016 # JavaScript, not shell
	node --input-type=module -e '
		import { readFileSync } from "node:fs";
		import { randomBytes } from "node:crypto";
		const fromFake = ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET",
			"STRAVA_WEBHOOK_VERIFY_TOKEN", "TOKEN_ENCRYPTION_KEY", "PUSH_VAPID_KEY"];
		const env = {};
		for (const line of readFileSync("dev/fake.env", "utf8").split("\n")) {
			const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
			if (m) env[m[1]] = m[2].replace(/^([\x27"])(.*)\1$/, "$2");
		}
		const out = {};
		for (const k of fromFake) {
			if (!env[k]) throw new Error(`dev/fake.env has no ${k}`);
			out[k] = env[k];
		}
		out.SESSION_SIGNING_KEY = randomBytes(32).toString("base64");
		out.ADMIN_TOKEN = process.argv[1];
		process.stdout.write(JSON.stringify(out));
	' "$1"
}

admin_tokens=()
for team in "${TEAMS[@]}"; do
	env="sandbox-$team"
	read -rp "Set the secrets of $env (rynke-points-$env)? [y/N] " answer </dev/tty
	[[ "$answer" == [yY] ]] || {
		echo "  skipped"
		continue
	}
	admin="$(openssl rand -hex 32)"
	secrets_json "$admin" | pnpm exec wrangler secret bulk --env "$env"
	admin_tokens+=("$env: $admin")
done

if ((${#admin_tokens[@]})); then
	echo
	echo "Admin tokens (shown once; keep them in your password manager):"
	printf '  %s\n' "${admin_tokens[@]}"
fi
