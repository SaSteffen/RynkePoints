# Contract: Branch Rulesets

The files `.github/rulesets/main.json` and `.github/rulesets/develop.json` are
request bodies for `POST /repos/SaSteffen/RynkePoints/rulesets`. They also work
for `PUT …/rulesets/{id}`. Shape, per the GitHub REST docs checked on 2026-10-06:

```jsonc
{
	"name": "protect-main", // develop: "protect-develop"
	"target": "branch",
	"enforcement": "active",
	"bypass_actors": [],
	"conditions": {
		"ref_name": { "include": ["refs/heads/main"], "exclude": [] } // develop: refs/heads/develop
	},
	"rules": [
		{ "type": "deletion" },
		{ "type": "non_fast_forward" },
		{
			"type": "pull_request",
			"parameters": {
				"allowed_merge_methods": ["merge"], // develop: ["squash", "merge"]
				"required_approving_review_count": 0,
				"dismiss_stale_reviews_on_push": false,
				"require_code_owner_review": false,
				"require_last_push_approval": false,
				"required_review_thread_resolution": false
			}
		},
		{
			"type": "required_status_checks",
			"parameters": {
				"strict_required_status_checks_policy": false, // develop: true (research R7)
				"do_not_enforce_on_create": false,
				"required_status_checks": [
					{ "context": "lint", "integration_id": 15368 },
					{ "context": "typecheck", "integration_id": 15368 },
					{ "context": "test", "integration_id": 15368 },
					{ "context": "commit-messages", "integration_id": 15368 },
					{ "context": "pr-title", "integration_id": 15368 },
					{ "context": "pr-source", "integration_id": 15368 }
				]
			}
		}
	]
}
```

The committed files are plain JSON. Biome formats them, so comments aren't
allowed there.

## Invariants

- `bypass_actors` is empty in both files. Adding an entry contradicts FR-009 and
  needs a spec change first.
- The list of `required_status_checks` contexts equals the context column of
  [required-checks.md](required-checks.md).
- `allowed_merge_methods` must be a subset of the methods enabled in the
  repository settings (squash and merge; rebase is off). Otherwise GitHub blocks
  every merge.

## Verification

`.github/rulesets/README.md` documents a command for each file:

1. Look up the ruleset ID by name.
2. Fetch the live ruleset.
3. Project it onto the keys above.
4. `diff` it against the file with `jq -S`.

The protection is as documented when the diff is empty.
