# Quickstart: Lazy-Loading Rides List

**Feature**: [spec.md](spec.md)

1. `pnpm dev`, open `http://localhost:8789/_dev/`, connect as **Paula Paging**
   (45 rides), open Rides on a phone-sized window.
2. The pager and "Fahrten 1–20 von 45" are gone; "45 Fahrten in dieser Saison"
   shows. Scroll down: rides 21–40 and then 41–45 appear; the list ends.
3. Scroll to ride 40, tap "Auf Strava ansehen", go back: ride 40 is where it
   was. Reload: the same. Tap Rides in the navigation bar: the top, newest 20.
4. Open `/me/rides?page=2`: rides 21–40, "Zu den neuesten Fahrten" above them,
   rides 41–45 load below.
5. In the browser's dev tools, go offline and scroll to the end on a fresh
   page: "Ältere Fahrten konnten nicht geladen werden." and "Erneut versuchen";
   go online: the rides load.
6. Turn JavaScript off: Rides shows the pager and the position line as before.
7. `pnpm test` and `pnpm test:e2e`.
