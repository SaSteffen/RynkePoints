# Quickstart: Rider Page Cleanup

## 1. Automated checks

`pnpm test`, `pnpm lint` and `pnpm typecheck` must pass. The tests use synthetic
riders only. Each test below is written first and must fail before the code
exists.

| Area | Test | Covers |
|---|---|---|
| View model | `rider-view`: no balance gives `{ state: "waiting" }`; a balance with no rides gives `"ready"` with empty rows; no `importing` anywhere. | FR-001, FR-003, R1 |
| Waiting | `overview`/`me-status`: a rider without a balance sees `p.greeting`, `section.waiting[data-waiting]` with the coin, `waiting.heading` and `waiting.body` with the season start; no summary, gauges or notices. The same rider on `/me/rides` sees `section.waiting` and no `section#rides`. For every `import_status`, no page contains "Import abgeschlossen", "werden noch importiert", "werden gerade berechnet" or "Noch keine Fahrten importiert". | FR-001, FR-001a, FR-002, FR-003, US1 #1–#2, #4 |
| Zero rides | A balance of zero with no rides shows the real Overview (zero Rynke) and `me.recent.none` on Rides. | US1 #5, R3 |
| Poll interval | `config`: `readyPollSeconds` returns 10 for `"10"` and throws for `"0"`, `"61"` and `"x"`. `overview`: the waiting section carries `data-poll-seconds` with the configured value. | FR-004, R5 |
| Ready route | `me-ready`: no session gives 401; no balance gives `{"ready":false}`; a balance gives `{"ready":true}`; `Cache-Control: no-store`; no `Set-Cookie`; a spy on `fetch` sees no outbound call. | FR-004, FR-006, SC-005 |
| Import start | `callback`: a new rider's callback sends `import-page` page 1 with `after` = season start. | FR-005, US1 #6 |
| Order | `overview`: the first child of `.overview-grid` is `section.hero` for waiting, ready, `needs_reconnect` and rules-updating riders; the reconnect and rule notices come after it. | FR-008, FR-009, SC-004 |
| Install | `pwa-pages`: `/` and `/me` have no `aside#install`; `/me/settings` has it without `data-install="dismiss"`; all four sections have one hidden `aside#app-prompt` with both panels, `data-push-key` and a labelled close button; `/` has none. | FR-010–FR-012, FR-016 |
| Style | `style`: `.app-prompt` is `position:fixed`; the reduced-motion block stops `.waiting .coin`. | FR-007, FR-012 |
| Copy | The catalog parity and `no-hardcoded-copy` tests cover the new keys; the removed keys are gone from both catalogs. | FR-017 |

## 2. Local walk-through (`pnpm dev`)

1. Run `pnpm dev`, open `http://localhost:8789` and connect a sample rider who
   isn't connected yet through the fake Strava's permission screen.
2. Right after the redirect, check that the Overview shows the greeting first,
   then the spinning coin and the one-time message. Check Rides shows the same.
3. Keep the tab open. Within a minute of the import's first page, check the page
   switches to the figures by itself. In the browser's network panel, polling
   `/me/ready` stops after that.
4. Turn on "reduce motion" in the OS or dev tools: the coin stands still.
5. In Chromium with a fresh profile, open `/me`. The install prompt floats above
   the navigation without moving the page. Close it, reload, and it doesn't come
   back. Clear site data, install from the prompt, and the notifications offer
   appears. Answer it, reload, and it's gone. Settings still offers installing
   with no hide button.
6. Tab through the prompt with the keyboard; Escape closes it.
7. Set `READY_POLL_SECONDS` to `"5"` in `wrangler.jsonc`, restart `pnpm dev`, and
   on a waiting page check the network panel shows `/me/ready` every 5 s. Set it
   back to `"10"`.

## 3. After release

The maintainer checks once on the live site:

- an iPhone install, where the offer appears on the first start from the home
  screen;
- an Android install.

There are no tasks for this.
