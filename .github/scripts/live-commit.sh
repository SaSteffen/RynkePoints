#!/usr/bin/env bash
# The commit live in a GitHub environment: the newest deployment whose newest
# status is success (older successes are inactive, failed ones failure). Prints
# it, or nothing when none is. Used by newer-than-live.sh and by the Sandbox
# and Sandbox reseed workflows.
#
#   .github/scripts/live-commit.sh <environment>
#
# Needs GH_TOKEN and GITHUB_REPOSITORY.
set -euo pipefail

environment=${1:?usage: live-commit.sh <environment>}

deployments=$(gh api "repos/$GITHUB_REPOSITORY/deployments?environment=$environment&per_page=100" --jq '.[] | "\(.id) \(.sha)"')
while read -r id deployed; do
  [ -n "$id" ] || continue
  state=$(gh api "repos/$GITHUB_REPOSITORY/deployments/$id/statuses?per_page=1" --jq '.[0].state // ""')
  if [ "$state" = success ]; then
    echo "$deployed"
    exit 0
  fi
done <<< "$deployments"
