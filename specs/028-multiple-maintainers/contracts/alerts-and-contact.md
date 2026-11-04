# Contract: Usage alert emails and the contact address

Both are written test first (Principle V), with the mail binding faked in tests. Neither sends anything when its secret isn't set.

## Usage alerts to maintainers

| Property | Value |
|---|---|
| Binding | `send_email` named `MAINTAINER_MAIL`, with no address list in `wrangler.jsonc`, because the repository is public |
| Secret | Optional `MAINTAINER_ALERT_EMAILS`: comma-separated, each a verified destination address |
| From | `alerts@` on the team's domain |
| When | In `checkAlerts`, for levels newly reached, alongside today's push |
| Content | English. The allowance, level, used and limit, and a link to the admin view. No rider data |

**Rules**:

- The app's per-admin alert switch doesn't affect these. Administrators keep their push (025).
- A send failure is logged and never stops recording or the push. Like the push, it isn't retried.
- Duplicates are prevented by the existing `usage_alerts` row: one email per allowance, level and period.
- Spec 026 decides how several teams avoid repeating an alert for a shared allowance.

**Tests**: One email per newly reached level; none on a repeat; none when the secret is unset; a failed send still records and still pushes; no rider field in the content.

## Contact address

| Property | Value |
|---|---|
| Routing rule | `CONTACT_EMAIL`'s address → this Worker |
| Handler | `email` export in `src/index.ts` |
| Secret | Optional `CONTACT_FORWARD_EMAILS`: comma-separated, verified |

**Rules**:

- Forwards each message to all addresses. Mail isn't stored or logged beyond delivery errors, with no content or sender in logs.
- If every forward fails, it rejects the message so that the sender gets a bounce. If some fail, it logs that without personal data.
- Only addresses of people the data controller has approved go in the secret (FR-017, FR-020).
- The rule changes only after a deployment with the handler is live, and the secret is set, so no message is lost. Rolling back means pointing the rule at the old address.

**Tests**: Forwards to each address; rejects when all fail; delivers when one fails; logs hold no address or content.

**Dev guard**: Fake mode and tests never reach real mail: the binding is absent locally unless a test provides one.
