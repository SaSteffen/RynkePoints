# Contract: Page Markup

**Feature**: [../spec.md](../spec.md) | **Research**: R3, R7, R10, R11, R13

The markup and class names the tests check. Text always comes from the catalogs.
Below, `{key}` stands for the text `i18n.t("key")`. This replaces the following
parts of earlier contracts:

- feature 005 `contracts/rider-page.md`, which said where each part sits on `/me`
  and gave the ride table's markup;
- feature 010 `contracts/client.md`, the markup of the notifications section.

The markup of the gauges, breakdown, rules and notices from feature 005 is
unchanged except for the class hooks listed here.

## Layout: every page

```html
<!doctype html>
<html lang="{locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fffdf5">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#12110c">
<script>/* scheme script, client.md */</script>
<link rel="manifest" …> <link rel="icon" …> <link rel="apple-touch-icon" …>
<script src="/app.js" defer></script>
<title>…</title>
<style>/* style.ts */</style>
</head>
<body class="shell|public">
<header class="top-bar">…</header>
<main>…</main>
<footer><img class="pbs pbs-light" src="{brand.poweredByStrava.src}" alt="{brand.poweredByStrava.alt}"><img class="pbs pbs-dark" src="{brand.poweredByStrava.srcDark}" alt="{brand.poweredByStrava.alt}"></footer>
<!-- shell pages only: -->
<nav class="app-nav" aria-label="{nav.label}">…</nav>
</body>
</html>
```

### Public pages (`body.public`)

This covers the landing page, the consent gate, notices, the disconnect page,
`/offline` and the error pages.

`header.top-bar` holds:

- the wordmark `<span class="wordmark">{coin mark}<span class="wordmark-name">Rynke<span>Points</span></span></span>`
  (feature 012; below 600 px the shell shows only the coin), a fixed
  brand name and not a catalog text;
- today's language form `<form method="post" action="/lang">`. Its buttons get the
  class `segmented`, and the current one keeps `aria-current="true"`.

There is no `nav.app-nav`.

### Shell pages (`body.shell`, the four sections)

`header.top-bar` holds:

- the wordmark;
- `<h1 class="section-title">{nav.<id>}</h1>`, shown below 600 px only (the
  greeting replaces it on the Overview);
- the refresh link:
  `<a class="icon-button refresh" href="{current path}" aria-label="{shell.refresh}">{refresh icon}</a>`.

There is no language form.

The nav sits after the footer in source order, so screen readers reach the
content first. Its links are, in this order:

```html
<nav class="app-nav" aria-label="{nav.label}">
<a href="/me" aria-current="page"><span class="nav-icon">{svg aria-hidden}</span><span class="nav-label">{nav.overview}</span></a>
<a href="/me/rides">…{nav.rides}…</a>
<a href="/team">…{nav.team}…</a>
<a href="/me/settings">…{nav.settings}…</a>
</nav>
```

Exactly one link has `aria-current="page"`. On Rides it is the Rides link, also
on `/me/rides?page=N`.

## Overview (`/me`)

`main` children, in order (FR-010):

1. Feature 005's notices (`renderNotice`). When `needs_reconnect`, first an
   `<aside class="notice notice-error">` with `{me.status.needsReconnect}` and
   `<a class="button" href="/connect">{me.reconnect}</a>`.
2. `<section class="hero">`: the coin, `<p class="greeting">{me.greeting}</p>` and the
   totals (feature 012), then the celebration `<aside class="celebrate">` when
   there are new Rynke.
3. `<section class="verdict card">`, feature 005's summary. Where the rider is
   not in yet, each missing amount becomes a `<span class="chip">`.
4. The gauges: each `figure.gauge` in its own `section.card`.
5. The breakdown in `section.card.card-outlined`.
6. The rules and the handout link in `section.card.card-outlined`.
7. The install hint (`aside#install`, hidden, feature 010).

At 600 px and wider, `main` is a two-column grid (`.overview-grid`). The notice,
greeting and verdict span both columns.

The page has no ride list, `#notifications`, consent text, `/me/disconnect` link
or logout form.

## Rides (`/me/rides`)

`main` holds:

- feature 005's notices for "updating" and "importing", and its empty state;
- `<p class="rides-position">` (feature 005);
- the card list:

```html
<ol class="ride-list">
<li class="ride-card ride-counting|ride-not-counting|ride-pending">
  <div class="ride-head">
    <span class="ride-date">{date}</span>
    <span class="chip ride-status">{rynke.ride.counts|doesNotCount|beingEvaluated}</span>
  </div>
  <dl class="ride-figures">
    <div><dt>{me.recent.col.distance}</dt><dd>{km}</dd></div>
    <div><dt>{rynke.training}</dt><dd>{rynke or –}</dd></div>
    <div><dt>{rynke.rides.col.elevationTotal}</dt><dd>{metres or –}</dd></div>
  </dl>
  <p class="ride-strava"><span class="ride-name">{name}</span> <a class="strava-activity" href="https://www.strava.com/activities/{id}">{brand.viewOnStrava}</a></p>
  <p class="ride-meta">{sport} · {gain}[ · {rynke.ride.virtual}]</p>
  <details class="ride-why" [open]>
    <summary>{rynke.ride.why}</summary>
    {feature 005's reasons, unknown figures, fix hint}
  </details>
</li>
</ol>
```

- `open` is present only on `ride-not-counting` (clarification Q5).
- `details` is left out when the ride has nothing to explain, as today.
- `nav.pager` links point at `/me/rides?page=N`.
- Each pager link and `summary` has the class `tap` (44 px).
- `ol.ride-list` replaces `table.rides`.

## Team (`/team`)

`main` holds:

```html
<section class="placeholder">
{the coin's Hamburg–Paris side, aria-hidden (feature 012)}
<h2>{team.placeholder.heading}</h2>
<p>{team.placeholder.body}</p>
</section>
```

Nothing else, and no rider's data (FR-013).

## Settings (`/me/settings`)

`main` holds `section.settings-group` elements in this order, each with an `h2`
(FR-014):

| id | `h2` | Contents |
|---|---|---|
| `settings-language` | `{settings.language}` | `/lang` form, `next=/me/settings`, `button.segmented` per language, current with `aria-current="true"` |
| `settings-appearance` | `{settings.appearance}` | `<fieldset class="segmented-group">` with three `<label><input type="radio" name="scheme" value="system|light|dark">{settings.scheme.*}</label>` and `<p>{settings.appearance.hint}</p>` |
| `notifications` | `{notifications.heading}` | feature 010's section with the switch ([client.md](client.md)), still starting `hidden` |
| `settings-app` | `{settings.app}` | `aside#install` (hidden); the group is `hidden` and `app.js` shows it with the hint |
| `settings-strava` | `{settings.strava}` | status line, scope lines, `<a class="button-outlined" href="/connect">{me.changePermissions}</a>`, and when `needs_reconnect` `<a class="button" href="/connect">{me.reconnect}</a>` |
| `settings-consent` | `{me.consent.heading}` | feature 004's accepted line, the read and visibility texts |
| `settings-account` | `{settings.account}` | `<form method="post" action="/logout">` with the hidden `push_endpoint` and `button.button-outlined`; `<a class="danger" href="/me/disconnect">{me.disconnect.button}</a>` |

## Consent gate (changed)

The same markup as feature 004, in the public layout. Both forms gain
`<input type="hidden" name="next" value="{path asked for}">`.

The Connect with Strava button, here and on the landing page, holds both of
Strava's buttons and the scheme CSS shows one (R13):

```html
<button><img class="cws cws-light" src="{brand.connectWithStrava.src}" alt="{brand.connectWithStrava.alt}"><img class="cws cws-dark" src="{brand.connectWithStrava.srcDark}" alt="{brand.connectWithStrava.alt}"></button>
```

## Control size (FR-022)

These classes must have `min-height: var(--rp-tap)` (and `min-width` where they
can be narrow) in `style.ts`:

- `app-nav a`, `icon-button`, `button`, `button-outlined`, `segmented`, `tap`
- `.ride-why > summary`, `[role=switch]`, `.danger`
- the labels in `segmented-group`

`test/unit/style.test.ts` checks this list.

## New catalog keys (de and en)

Both catalogs get these keys:

| Key | en |
|---|---|
| `nav.label` | Sections |
| `nav.overview` | Overview |
| `nav.rides` | Rides |
| `nav.team` | Team |
| `nav.settings` | Settings |
| `shell.refresh` | Refresh |
| `team.placeholder.heading` | Team view coming soon |
| `team.placeholder.body` | Here you'll soon see how the whole team is doing. |
| `settings.language` | Language |
| `settings.appearance` | Appearance |
| `settings.scheme.system` | System |
| `settings.scheme.light` | Light |
| `settings.scheme.dark` | Dark |
| `settings.appearance.hint` | Applies to this device only. |
| `settings.app` | App |
| `settings.strava` | Strava connection |
| `settings.account` | Account |
| `rynke.ride.why` | Why? |
| `notifications.switch` | Notifications on this device |
| `brand.poweredByStrava.srcDark` | /strava/en/powered-by-strava-white.svg |
| `brand.connectWithStrava.srcDark` | /strava/en/connect-with-strava-white.svg |

The German texts are written at implementation time and reviewed in the PR.
`notifications.turnOn`/`turnOff` become unused and are removed from both
catalogs, as are `me.recent.col.date` and `rynke.rides.col.status`, which only
the table header used.
