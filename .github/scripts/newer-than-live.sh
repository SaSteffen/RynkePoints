#!/usr/bin/env bash
# Whether a commit should go to a GitHub environment, judged by the commit live
# there (the newest deployment whose newest status is success). Used by ci.yml's
# deploy-gate for production, and by the Sandbox workflow (feature 027 research
# R10 step 2), so an older commit never replaces a newer one.
#
#   .github/scripts/newer-than-live.sh <environment> [sha]
#
# sha defaults to $GITHUB_SHA. Needs GH_TOKEN, GITHUB_REPOSITORY and a checkout
# with the history of both commits (fetch-depth: 0).
#
# Exit 0: deploy (first deployment, the live commit again, or a newer one).
# Exit 3: a newer commit is already live; skip.
# Anything else: an error (e.g. an unknown commit).
set -euo pipefail

environment=${1:?usage: newer-than-live.sh <environment> [sha]}
sha=${2:-${GITHUB_SHA:?GITHUB_SHA or a sha argument is needed}}
live_sha=""

# Newest first. The first one whose newest status is success is live; older
# successes are inactive, failed ones failure.
deployments=$(gh api "repos/$GITHUB_REPOSITORY/deployments?environment=$environment&per_page=100" --jq '.[] | "\(.id) \(.sha)"')
while read -r id deployed; do
  [ -n "$id" ] || continue
  state=$(gh api "repos/$GITHUB_REPOSITORY/deployments/$id/statuses?per_page=1" --jq '.[0].state // ""')
  if [ "$state" = success ]; then
    live_sha=$deployed
    break
  fi
done <<< "$deployments"

if [ -z "$live_sha" ]; then
  echo "First deployment to $environment."
  exit 0
elif [ "$live_sha" = "$sha" ]; then
  echo "Re-deploying the live commit $live_sha to $environment."
  exit 0
elif git merge-base --is-ancestor "$sha" "$live_sha"; then
  echo "::notice::A newer commit ($live_sha) is already deployed to $environment; skipping $sha."
  exit 3
else
  # 1 means newer; anything else (e.g. 128, unknown commit) is an error.
  rc=$?
  if [ "$rc" -ne 1 ]; then
    exit "$rc"
  fi
  echo "Deploying $sha to $environment; live is $live_sha."
  exit 0
fi
