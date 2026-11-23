# Contract: Usage view section "Gateway routing"

On `/admin`, after the ride re-check's section, `<section class="card usage-source" id="routing">`.
Reads `routing_daily` only (FR-024).

- Heading and a short note on what the figures mean (trial figures, drops in every mode).
- No day with a count: "No figures yet."
- Otherwise a table, one row per day of the last 30 with a count, newest first:

| Column | Value |
|---|---|
| Day | the date, then the warning mark when the day is marked |
| Sent by the copy | gateway `copy` |
| Sent to every team | gateway `everyone` |
| Would-be misses | `missed`: This team, Other teams |
| Would-be wasted | `wasted`: This team, Other teams |
| Dropped | `dropped`: This team, Other teams |
| List corrections | `added + removed`: This team, Other teams |
| Possible misses | `possible`: This team, Other teams |
| Found by the re-check | `found`: This team, Other teams |

"Other teams" is the sum over every team but this one, left out when no other team has a count. A
two-row header names the figure above "This team" / "Other teams". No other team is named.

**Warning mark** (FR-025): the re-check table's mark (`usage-mark usage-mark-warning`, the word
"Warning") when any team has `missed` or `possible` above zero, or when `allRoutingEveryone` is more
than 1% of `allRouting`.

**Summary**: below the existing summary, when marked days exist, a `notice notice-error` line
"Gateway routing days with a warning: {n}".

All text in the catalogs, ten languages, German the key source.
