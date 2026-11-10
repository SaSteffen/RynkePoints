#!/usr/bin/env bash
# Sets up the GitHub environments sandbox-<team> (feature 027 quickstart step 5,
# research R11): deployments from develop only, and the Sandbox workflow's two
# Cloudflare tokens and account ID. A manual step for the maintainer; run it
# again to rotate the tokens.
#
#   scripts/sandbox-environments.sh [team ...]   default: hamburg europe
#
# Asks for the deploy token and the analytics token (input hidden) and stores
# them on each environment only, never at repository level. Needs `gh`, signed
# in with admin rights on the repository. Admin bypass has no API setting:
# untick it in Settings → Environments; the check at the end says when it's
# still on.
set -euo pipefail

REPO="${SANDBOX_REPO:-SaSteffen/RynkePoints}"
TEAMS=("$@")
((${#TEAMS[@]})) || TEAMS=(hamburg europe)

die() {
	echo "$*" >&2
	exit 1
}

command -v gh >/dev/null || die "gh isn't installed"
gh auth status >/dev/null 2>&1 || die "gh isn't signed in: run gh auth login"
for team in "${TEAMS[@]}"; do
	[[ "$team" =~ ^[a-z][a-z0-9-]*$ ]] || die "Not a team id: $team"
done

ask_secret() {
	local prompt="$1" value
	read -rsp "$prompt: " value </dev/tty
	echo >&2
	[[ -n "$value" ]] || die "Nothing entered"
	printf '%s' "$value"
}

# The account ID production already uses, unless one is given.
default_account="$(gh variable get CLOUDFLARE_ACCOUNT_ID --env production \
	--repo "$REPO" 2>/dev/null || true)"
read -rp "Cloudflare account ID${default_account:+ [$default_account]}: " account </dev/tty
account="${account:-$default_account}"
[[ "$account" =~ ^[0-9a-f]{32}$ ]] || die "An account ID is 32 hex characters"

deploy_token="$(ask_secret "Deploy token (rynkepoints-sandbox-deploy)")"
analytics_token="$(ask_secret "Analytics token (rynkepoints-sandbox-analytics)")"
[[ "$deploy_token" != "$analytics_token" ]] ||
	die "The two tokens are the same; the analytics token is a separate, read-only one"

for team in "${TEAMS[@]}"; do
	env="sandbox-$team"
	echo "== $env"
	gh api --method PUT "repos/$REPO/environments/$env" --input - >/dev/null <<-'EOF'
		{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
	EOF

	branches="$(gh api "repos/$REPO/environments/$env/deployment-branch-policies" \
		--jq '[.branch_policies[] | "\(.type):\(.name)"] | join(" ")')"
	if [[ " $branches " != *" branch:develop "* ]]; then
		gh api --method POST "repos/$REPO/environments/$env/deployment-branch-policies" \
			-f name=develop -f type=branch >/dev/null
	fi

	printf '%s' "$deploy_token" |
		gh secret set CLOUDFLARE_SANDBOX_API_TOKEN --env "$env" --repo "$REPO"
	printf '%s' "$analytics_token" |
		gh secret set CLOUDFLARE_ANALYTICS_TOKEN --env "$env" --repo "$REPO"
	gh variable set CLOUDFLARE_ACCOUNT_ID --env "$env" --repo "$REPO" --body "$account"
done

# Check what GitHub now holds.
problems=0
for team in "${TEAMS[@]}"; do
	env="sandbox-$team"
	branches="$(gh api "repos/$REPO/environments/$env/deployment-branch-policies" \
		--jq '[.branch_policies[] | "\(.type):\(.name)"] | sort | join(" ")')"
	bypass="$(gh api "repos/$REPO/environments/$env" --jq '.can_admins_bypass')"
	secrets="$(gh secret list --env "$env" --repo "$REPO" --json name \
		--jq '[.[].name] | sort | join(" ")')"
	echo "$env: deploys from [$branches], admin bypass $bypass, secrets [$secrets]"
	if [[ "$branches" != "branch:develop" ]]; then
		echo "  ! only develop may deploy here; remove the other rules in Settings → Environments" >&2
		problems=1
	fi
	if [[ "$bypass" != "false" ]]; then
		echo "  ! untick 'Allow administrators to bypass' in Settings → Environments → $env" >&2
		problems=1
	fi
done
if gh secret list --repo "$REPO" --json name --jq '.[].name' | grep -q '^CLOUDFLARE_'; then
	echo "! a CLOUDFLARE_* secret sits at repository level; it belongs on an environment only" >&2
	problems=1
fi
exit "$problems"
