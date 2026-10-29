# Contract: HTTP Routes

## `GET /me/fetching` (and `HEAD`)

How far the signed-in rider's activities are, for the progress line (FR-018 to
FR-021). Answered before the page dispatcher, like `/me/ready`: one D1 read, no
Strava request, the session is not renewed.

- No valid session: `401`, no body.
- Otherwise `200`, `Content-Type: application/json`, `Cache-Control: no-store`:
  - `{ "text": "120 von 300 Aktivitäten geholt" }` while the line applies,
  - `{ "text": null }` when it doesn't (any more).

The text is in the request's language (`Accept-Language` and the language
cookie, as every page).

## Pages

Overview (`/me`) and Rides (`/me/rides`), when the rider's data is ready, show
under the rule-change notice:

```html
<section class="notice fetching" role="status" data-fetching data-poll-seconds="10">
<p>120 von 300 Aktivitäten geholt</p>
</section>
```

Nothing when the line doesn't apply. The page script asks `/me/fetching` every
`data-poll-seconds` while the page is visible, replaces the paragraph's text,
and refreshes the page content when the answer is `null`.
