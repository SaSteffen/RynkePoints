# Contract: Approval and merge methods

## `.github/rulesets/approval.json` (stage 1)

```json
{
	"name": "protect-approval",
	"target": "branch",
	"enforcement": "active",
	"bypass_actors": [
		{ "actor_id": null, "actor_type": "OrganizationAdmin", "bypass_mode": "exempt" }
	],
	"conditions": {
		"ref_name": { "include": ["refs/heads/develop", "refs/heads/main"], "exclude": [] }
	},
	"rules": [
		{
			"type": "pull_request",
			"parameters": {
				"allowed_merge_methods": ["merge"],
				"required_approving_review_count": 1,
				"dismiss_stale_reviews_on_push": true,
				"require_code_owner_review": true,
				"require_last_push_approval": false,
				"required_review_thread_resolution": false
			}
		}
	]
}
```

Trial T1 checks that the API accepts this shape, including `actor_id`.

`.github/CODEOWNERS`, reaching both `develop` and `main` before the ruleset is applied:

```text
* @<founding maintainer's handle>
```

Applying it before `main` has that file would leave `main` without a code owner to require.

## Other rulesets

| File | Change |
|---|---|
| `develop.json` | `allowed_merge_methods: ["merge"]` |
| `main.json` | None |

Both keep `bypass_actors: []`, and their `required_approving_review_count` stays 0: approval lives only in `protect-approval`. The rulesets' README invariants change to say exactly that, and `verify_ruleset approval` joins the commands.

## Behaviour

| Pull request | Merged by | Result |
|---|---|---|
| Founding maintainer's own | Founding maintainer, including auto-merge | Merges once checks pass |
| Anyone else's, or automation's, with no approval | Second maintainer | Blocked |
| Approved by someone other than the founding maintainer | Second maintainer | Blocked |
| Approved by the founding maintainer | Anyone with Write | Merges once checks pass |
| Approved, then a new push | Second maintainer | Blocked until approved again |

## Moving to stage 2

In this order, once the founding maintainer decides:

1. A pull request changes `approval.json`: `require_code_owner_review: false`, `require_last_push_approval: true`, `bypass_actors: []`. It also deletes `.github/CODEOWNERS` and updates `docs/maintainers.md`.
2. Merge it, and release it to `main`.
3. Make the second maintainer an organization owner.
4. Apply the ruleset and run `verify_ruleset approval`.

## Repository settings

| Setting | Value |
|---|---|
| `allow_squash_merge` | `false` |
| `allow_merge_commit` | `true` |
| `allow_rebase_merge` | `false` |
| `merge_commit_title`, `merge_commit_message` | `MERGE_MESSAGE`, `PR_TITLE` (today's values) |

**Order**: Merge the change first, then apply `develop.json`, then turn squash off in the settings. The invariant is that a ruleset's methods stay a subset of what's enabled.

## Organization settings

| Setting | Value |
|---|---|
| Base permission | No permission |
| Members can create repositories | Off |
| Require two-factor authentication | On |
| Actions workflow permissions | Read, no pull request approval |
| Second maintainer's repository role | Write |
