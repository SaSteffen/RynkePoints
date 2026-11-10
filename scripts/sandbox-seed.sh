#!/usr/bin/env bash
# The sandbox's database, rebuilt on every deployment (feature 027 research R6).
#
#   sandbox-seed.sh seed <team> <base-dir>   seeds the sample riders with the
#       base's code on a local database and exports it to base.sql
#   sandbox-seed.sh try-migrations <team>    imports base.sql into another local
#       database and applies this checkout's migrations to it
#   sandbox-seed.sh count <file>             the rows writing <file> costs:
#       its INSERTs doubled, for the usage check (research R7)
#   sandbox-seed.sh rebuild <team>           drops every table and view of the
#       sandbox's database and imports base.sql (CI only)
#
# Only `rebuild` touches Cloudflare. SANDBOX_D1_LOCAL=<dir> points it at a local
# stand-in instead, for trying it on a machine. Files go to
# .wrangler/sandbox/<team>/ in this checkout, or $SANDBOX_WORK.
set -euo pipefail

CHANGE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Fake mode always runs on dev/fake.env's placeholders (scripts/dev.mjs).
SECRETS=(STRAVA_CLIENT_ID STRAVA_CLIENT_SECRET STRAVA_WEBHOOK_VERIFY_TOKEN
	TOKEN_ENCRYPTION_KEY SESSION_SIGNING_KEY ADMIN_TOKEN PUSH_VAPID_KEY)

die() {
	echo "$*" >&2
	exit 1
}

usage() {
	die "usage: sandbox-seed.sh seed <team> <base-dir> | try-migrations <team> | count <file> | rebuild <team>"
}

work_dir() {
	local dir="${SANDBOX_WORK:-$CHANGE/.wrangler/sandbox/$1}"
	mkdir -p "$dir"
	(cd "$dir" && pwd)
}

# Wrangler from <dir>'s own install, never asking.
wrangler_in() {
	local dir="$1"
	shift
	(cd "$dir" && CI=1 "$dir/node_modules/.bin/wrangler" "$@")
}

# Whether <dir>'s wrangler.jsonc has the block env.<team>.
knows_team() {
	node --input-type=module -e '
		import { readFileSync } from "node:fs";
		import { parseJsonc } from "'"$CHANGE"'/scripts/team-check.mjs";
		const [file, team] = process.argv.slice(1);
		let wrangler;
		try {
			wrangler = parseJsonc(readFileSync(file, "utf8"));
		} catch {
			process.exit(1);
		}
		process.exit(wrangler.env?.[team] ? 0 : 1);
	' "$1/wrangler.jsonc" "$2"
}

free_port() {
	node -e '
		const s = require("node:net").createServer();
		s.listen(0, "127.0.0.1", () => {
			console.log(s.address().port);
			s.close();
		});
	'
}

# One number from a local database: the first column of the first row.
local_number() {
	local dir="$1" team="$2" state="$3" sql="$4"
	wrangler_in "$dir" d1 execute DB --local --env "$team" --persist-to "$state" \
		--json --command "$sql" 2>/dev/null |
		node -e '
			let s = "";
			process.stdin.on("data", (d) => (s += d)).on("end", () => {
				const row = JSON.parse(s)[0].results[0];
				console.log(Object.values(row)[0]);
			});
		'
}

seed() {
	local team="$1" base="$2"
	[[ -d "$base" ]] || die "No base checkout at $base"
	base="$(cd "$base" && pwd)"
	local src="$base"
	if ! knows_team "$base" "$team"; then
		# A new team: nothing is pending, so its own code seeds (research R6).
		echo "The base doesn't know $team yet; seeding with this checkout."
		src="$CHANGE"
	fi
	knows_team "$src" "$team" || die "Unknown team $team"

	local work state port inspector log pid
	work="$(work_dir "$team")"
	# `d1 export` has no --persist-to: it reads .wrangler/state next to the
	# configuration it's given, so the database lives there.
	local root="$work/base"
	state="$root/.wrangler/state"
	log="$work/server.log"
	rm -rf "$root" "$work/base.sql"
	mkdir -p "$root"
	cp "$src/wrangler.jsonc" "$root/wrangler.jsonc"
	wrangler_in "$src" d1 migrations apply DB --local --env "$team" \
		--persist-to "$state" >/dev/null
	port="$(free_port)"
	inspector="$(free_port)"

	# As `pnpm test:e2e:server` starts it, alone on a free port.
	(cd "$src" && exec setsid env "${SECRETS[@]/#/-u}" \
		"$src/node_modules/.bin/wrangler" dev dev/worker.ts --env "$team" \
		--env-file dev/fake.env --var RYNKE_FAKE_STRAVA:local-only \
		--var STRAVA_RETURN_VIA: --persist-to "$state" --port "$port" \
		--ip 127.0.0.1 --inspector-port "$inspector" \
		--show-interactive-dev-session=false) >"$log" 2>&1 &
	pid=$!
	# shellcheck disable=SC2064 # the PID is known now
	trap "kill -- -$pid 2>/dev/null || true" EXIT

	# The first request seeds and answers once seeding is done.
	local tries=0
	until curl -sf -o /dev/null --max-time 300 "http://localhost:$port/"; do
		tries=$((tries + 1))
		if ((tries > 120)) || ! kill -0 "$pid" 2>/dev/null; then
			cat "$log" >&2
			die "The base's fake-mode server didn't answer"
		fi
		sleep 1
	done
	# Rides arrive through the queue after seeding. Some sample riders stay
	# pending on purpose, so wait until the riders and their rides stop
	# changing.
	local snapshot last="" settled=0
	tries=0
	while ((settled < 3)); do
		tries=$((tries + 1))
		((tries > 150)) && die "The sample riders' imports didn't settle"
		sleep 2
		snapshot="$(local_number "$src" "$team" "$state" \
			"SELECT (SELECT group_concat(athlete_id || status || import_status)
				FROM riders) || '|' || (SELECT COUNT(*) FROM activities)")"
		if [[ -n "$snapshot" && "$snapshot" == "$last" ]]; then
			settled=$((settled + 1))
		else
			settled=0
		fi
		last="$snapshot"
	done
	kill -- "-$pid" 2>/dev/null || true
	wait "$pid" 2>/dev/null || true
	trap - EXIT

	wrangler_in "$src" d1 export DB --local --env "$team" \
		--config "$root/wrangler.jsonc" --output "$work/base.sql" >/dev/null
	[[ -s "$work/base.sql" ]] || die "The export wrote nothing"
	# The sandbox mustn't follow anything back to the machine that seeded it.
	if grep -q "localhost:$port\|127\.0\.0\.1:$port" "$work/base.sql"; then
		die "base.sql names the local server (localhost:$port)"
	fi
	echo "$work/base.sql: $(count "$work/base.sql") rows to write"
}

try_migrations() {
	local team="$1" work state out
	work="$(work_dir "$team")"
	[[ -s "$work/base.sql" ]] || die "No $work/base.sql; run seed first"
	state="$work/try-state"
	rm -rf "$state"
	wrangler_in "$CHANGE" d1 execute DB --local --env "$team" --persist-to "$state" \
		--file "$work/base.sql" >/dev/null ||
		die "base.sql didn't import into an empty database"
	if ! out="$(wrangler_in "$CHANGE" d1 migrations apply DB --local --env "$team" \
		--persist-to "$state" 2>&1)"; then
		echo "$out" >&2
		local failed
		failed="$(grep -oE '[0-9]{4}_[A-Za-z0-9_-]+\.sql' <<<"$out" | tail -1 || true)"
		die "Migration ${failed:-unknown} fails on the base's data; the sandbox is untouched."
	fi
	echo "The change's migrations apply to $team's base data."
}

# INSERTs doubled: each row's write plus at least one index write (research R7).
count() {
	local file="$1" inserts
	[[ -f "$file" ]] || die "No file $file"
	inserts="$(grep -c '^INSERT' "$file" || true)"
	echo $((inserts * 2))
}

rebuild() {
	local team="$1" work target names
	work="$(work_dir "$team")"
	[[ -s "$work/base.sql" ]] || die "No $work/base.sql; run seed first"
	if [[ -n "${SANDBOX_D1_LOCAL:-}" ]]; then
		target=(--local --persist-to "$SANDBOX_D1_LOCAL")
	else
		target=(--remote)
	fi
	local d1=(d1 execute DB --env "sandbox-$team" "${target[@]}" --yes)

	names="$(wrangler_in "$CHANGE" "${d1[@]}" --json --command \
		"SELECT type, name, sql FROM sqlite_master WHERE type IN ('table', 'view')
			AND substr(name, 1, 7) <> 'sqlite_' AND substr(name, 1, 4) <> '_cf_'")" ||
		die "Couldn't list sandbox-$team's tables"
	node -e '
		let s = "";
		process.stdin.on("data", (d) => (s += d)).on("end", () => {
			const rows = JSON.parse(s)[0].results;
			const q = (n) => `"${n.replaceAll("\"", "\"\"")}"`;
			const lines = ["PRAGMA defer_foreign_keys = on;"];
			for (const r of rows.filter((r) => r.type === "view"))
				lines.push(`DROP VIEW IF EXISTS ${q(r.name)};`);
			// Children first: dropping a table deletes its rows, and a child
			// row with a foreign key still looks up its parent table.
			let tables = rows.filter((r) => r.type === "table");
			const parents = (r) =>
				[...(r.sql ?? "").matchAll(/REFERENCES\s+"?(\w+)"?/gi)]
					.map((m) => m[1])
					.filter((name) => name !== r.name);
			while (tables.length > 0) {
				const referenced = new Set(tables.flatMap(parents));
				const leaves = tables.filter((r) => !referenced.has(r.name));
				if (leaves.length === 0) throw new Error("Foreign keys go in a circle");
				for (const r of leaves) lines.push(`DROP TABLE IF EXISTS ${q(r.name)};`);
				tables = tables.filter((r) => referenced.has(r.name));
			}
			console.log(lines.join("\n"));
		});
	' <<<"$names" >"$work/drop.sql"

	wrangler_in "$CHANGE" "${d1[@]}" --file "$work/drop.sql" >/dev/null ||
		die "Dropping sandbox-$team's tables failed; the sandbox may be half-emptied."
	wrangler_in "$CHANGE" "${d1[@]}" --file "$work/base.sql" >/dev/null ||
		die "Importing base.sql into sandbox-$team failed; the sandbox is empty or half-built until the next deployment."
	echo "sandbox-$team holds the base's data."
}

case "${1:-}" in
seed) [[ $# == 3 ]] || usage && seed "$2" "$3" ;;
try-migrations) [[ $# == 2 ]] || usage && try_migrations "$2" ;;
count) [[ $# == 2 ]] || usage && count "$2" ;;
rebuild) [[ $# == 2 ]] || usage && rebuild "$2" ;;
*) usage ;;
esac
