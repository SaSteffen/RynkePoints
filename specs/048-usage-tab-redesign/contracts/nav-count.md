# Contract: The mark count in the navigation

## Where

- The Admin tab of the app navigation (`shellParts` in `src/http/shell.ts`), for
  administrators, on every page.
- "Nutzung" in the Admin tab switch (`adminSwitch` in
  `src/http/admin/access.ts`), on both Admin pages.

## What

The total of `markCount` (data-model.md) over the usage state's items: items at
Kritisch, Warnung and Hinweis; hints never count. 0 shows nothing.

Markup as Orga's: `countBadge(n)` inside `.nav-icon` (shows "9+" above 9), and an
accessible name on the link: `nav.admin.marks` "Admin, {n} brauchen deinen
Blick" (all ten catalogs); the segment gets `admin.switch.usage.marks`
"Nutzung, {n} brauchen deinen Blick".

## Reads

One reader shared with the page's list (research R5): the Strava rate-limit row,
connected riders (this team, latest per other team), the Cloudflare figures'
latest values, today's CPU rows, the re-check, routing and Strava-calls rows of
today and yesterday, the peers' exchange states. No Strava or Cloudflare call,
no history. Computed alongside the page in the same `Promise.all` as the open
requests, so it adds no sequential wait. Not computed for riders who aren't
administrators.

## Same number everywhere

For one request, the Admin tab, the "Nutzung" segment and the list's head show
the same total (SC-005): the shell reads the usage state once per request
(`readUsageState`, for administrators only) and hands it to the page as
`ShellViewer.usage`; the tab, the segment and the list all count that one state.
