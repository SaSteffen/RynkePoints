#!/usr/bin/env bash
# Sets up a team's GitHub side (docs/add-a-team.md step 7 and step 9): the
# environment production-<team> like production, its Cloudflare deploy token and
# account ID. A manual step for the maintainer; run it again to rotate the token.
#
#   scripts/team-github.sh <team>             e.g. europe
#   scripts/team-github.sh <team> --go-live   also switches <TEAM>_DEPLOY on and
#                                             runs CI on main (after the release)
#
# Deployments from main only, on the environment only, never at repository level.
# The deploy token is read from .dev.vars, where an earlier run recorded it as
# `# prod.<team>.CLOUDFLARE_API_TOKEN=<token>`, or asked for (input hidden) and
# recorded there, so it isn't lost: GitHub never shows it again. .dev.vars is
# git-ignored; its backup is made before the first change. Needs `gh`, signed in
# with admin rights on the repository. Admin bypass is sent as off; the check at
# the end says when GitHub kept it on, and then it's unticked in Settings →
# Environments.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO="${TEAM_GITHUB_REPO:-SaSteffen/RynkePoints}"
TEAM="${1:-}"
GO_LIVE=false
[[ "${2:-}" == "--go-live" ]] && GO_LIVE=true
[[ -z "${2:-}" || "$GO_LIVE" == true ]] || {
	echo "Usage: scripts/team-github.sh <team> [--go-live]" >&2
	exit 1
}

die() {
	echo "$*" >&2
	exit 1
}

[[ "$TEAM" =~ ^[a-z][a-z0-9-]*$ ]] || die "Usage: scripts/team-github.sh <team> [--go-live]"
grep -q "\"TEAM_ID\": \"$TEAM\"" wrangler.jsonc ||
	die "wrangler.jsonc has no team $TEAM"
command -v gh >/dev/null || die "gh isn't installed"
gh auth status >/dev/null 2>&1 || die "gh isn't signed in: run gh auth login"
[[ -f .dev.vars ]] || die "No .dev.vars to record the deploy token in"

ENV="production-$TEAM"
RECORD="# prod.$TEAM.CLOUDFLARE_API_TOKEN="

ask() {
	local prompt="$1" value
	read -rsp "$prompt: " value
	echo >&2
	[[ -n "$value" ]] || die "Nothing entered"
	printf '%s' "$value"
}

# The account ID production already uses, unless one is given.
default_account="$(gh variable get CLOUDFLARE_ACCOUNT_ID --env production \
	--repo "$REPO" 2>/dev/null || true)"
read -rp "Cloudflare account ID${default_account:+ [$default_account]}: " account
account="${account:-$default_account}"
[[ "$account" =~ ^[0-9a-f]{32}$ ]] || die "An account ID is 32 hex characters"

recorded="$(grep -F "$RECORD" .dev.vars | head -1 || true)"
if [[ -n "$recorded" ]]; then
	deploy_token="${recorded#"$RECORD"}"
	echo "Using the deploy token recorded in .dev.vars (delete its line there to enter a new one)."
else
	cat <<-EOF
		Create the team's own deploy token in Cloudflare (Manage Account → Account API
		Tokens → Create Token → Custom token), not production's:
		  name         rynkepoints-github-deploy-$TEAM
		  permissions  Account · Workers Scripts · Edit; Account · D1 · Edit;
		               Zone · Workers Routes · Edit on the team's domain (the first
		               deploy creates the custom domain)
		  resources    the RynkePoints account and the team's zone
		  TTL          about a year; note the rotation date
	EOF
	deploy_token="$(ask "Deploy token")"
	cp .dev.vars ".dev.vars.bak-$(date -u +%Y-%m-%dT%H-%M-%SZ)"
	[[ -z "$(tail -c1 .dev.vars)" ]] || echo >>.dev.vars
	printf '%s\n' "$RECORD$deploy_token" >>.dev.vars
	echo "Recorded in .dev.vars."
fi

echo "== $ENV"
gh api --method PUT "repos/$REPO/environments/$ENV" --input - >/dev/null <<-'EOF'
	{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}, "can_admins_bypass": false}
EOF
branches="$(gh api "repos/$REPO/environments/$ENV/deployment-branch-policies" \
	--jq '[.branch_policies[] | "\(.type):\(.name)"] | join(" ")')"
if [[ " $branches " != *" branch:main "* ]]; then
	gh api --method POST "repos/$REPO/environments/$ENV/deployment-branch-policies" \
		-f name=main -f type=branch >/dev/null
fi
printf '%s' "$deploy_token" |
	gh secret set CLOUDFLARE_API_TOKEN --env "$ENV" --repo "$REPO"
gh variable set CLOUDFLARE_ACCOUNT_ID --env "$ENV" --repo "$REPO" --body "$account"

# Check what GitHub now holds.
problems=0
branches="$(gh api "repos/$REPO/environments/$ENV/deployment-branch-policies" \
	--jq '[.branch_policies[] | "\(.type):\(.name)"] | sort | join(" ")')"
bypass="$(gh api "repos/$REPO/environments/$ENV" --jq '.can_admins_bypass')"
secrets="$(gh secret list --env "$ENV" --repo "$REPO" --json name \
	--jq '[.[].name] | sort | join(" ")')"
echo "$ENV: deploys from [$branches], admin bypass $bypass, secrets [$secrets]"
if [[ "$branches" != "branch:main" ]]; then
	echo "  ! only main may deploy here; remove the other rules in Settings → Environments" >&2
	problems=1
fi
if [[ "$bypass" != "false" ]]; then
	echo "  ! untick 'Allow administrators to bypass' in Settings → Environments → $ENV" >&2
	problems=1
fi
if gh secret list --repo "$REPO" --json name --jq '.[].name' | grep -q '^CLOUDFLARE_'; then
	echo "! a CLOUDFLARE_* secret sits at repository level; it belongs on an environment only" >&2
	problems=1
fi

if [[ "$GO_LIVE" == true ]]; then
	((problems == 0)) || die "Not going live while the environment has problems."
	switch="${TEAM^^}"
	switch="${switch//-/_}_DEPLOY"
	echo
	echo "Going live starts $TEAM's deploy job on main: it applies the migrations, deploys"
	echo "the Worker and creates the custom domain. Only do this once the pull request"
	echo "that gives $TEAM its real values is released to main."
	read -rp "Switch $switch on and run CI on main? [y/N] " answer
	[[ "$answer" == [yY] ]] || die "Not switched on."
	gh variable set "$switch" --body on --repo "$REPO"
	gh workflow run ci.yml --ref main --repo "$REPO"
	echo "Started. Watch it with: gh run list --workflow ci.yml --limit 3"
fi
exit "$problems"
