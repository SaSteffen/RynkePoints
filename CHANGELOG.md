# Changelog

What changed in each version of the app, newest first. The app shows this list
on its changelog page, linked from Settings.

<!--
Every release adds its version at the top, in the pull request that raises the
version in package.json (README "Releasing", the release skill); a test keeps
the two equal. The app reads this file, so it keeps one shape: after this
introduction, a "## X.Y.Z" heading per version, then one "- " line per change
(a long one may go on in lines indented by two spaces). The entries are plain
English sentences for the administrators, without formatting or links, and
name no team, place or rider: every team shows the same list.
-->

## 1.5.0

- The Team page's total card shows both sides of the team's coin, with the team's own side in front.
- When installing the app on Android, riders see a note that it can take up to two minutes to appear on the home screen.

## 1.4.0

- Each day warning in the usage view's list (Strava calls, ride re-check, gateway routing) has a button to mark it as seen. It then leaves that administrator's list and the Admin tab's number; the day's table keeps its mark, and a new reason brings it back.
- Gateway routing no longer warns of a possible miss on the day a team sends its first full list.

## 1.3.0

- The usage view starts with a list of what needs a look, worst first, and says so in one line when everything is within limits.
- Every usage figure has a third, earlier level, Hinweis, at 25 % for now. Administrators who turned alerts on get a notification for it too.
- Strava's and Cloudflare's figures are rows with a bar marked at each level; a row opens to its levels, how the teams share it and its history.
- The waiting work, Strava calls, ride re-check, gateway routing and CPU time are rows with one line each, and the alerts setting is a switch.
- The Admin tab and Usage show how many usage marks need a look.
- The CPU time row shows a graph of the season: each week's highest daily median CPU time for this team, the other teams and the gateway. Its table shows the median next to the slowest runs.

## 1.2.0

- The Admin tab now opens on Riders and Roles.
- The usage view shows how much CPU time the app used each day, against the free allowance.
- With more than one team on the same Strava app, each new or changed ride from Strava now reaches only the teams the rider belongs to.
- Rides from before the season are found faster.

## 1.1.0

- The admin view's Riders tab is now Riders and Roles. Administrators give and take the Orga and Admin roles there; an administrator is always in the Orga too, and nobody changes their own role.
- One search on Riders and Roles finds every rider, a red line shows only when a rider's connection needs attention, and Change on a row shows their connection, their role and Remove.
- A rider whose role changed sees a card about it the next time they open the app, and someone new in the Orga can start a tour of the Orga tab.
- Settings shows the Orga and the administrators who is in the Orga, with a link for administrators to change it.

## 1.0.0

- The app has a version number. Settings shows it and links to this list of changes.
- Settings is one page of grouped rows instead of nine cards, with the Strava connection on top.
- A rider can sign out on every device at once from Settings. Signing in at one team no longer counts at another.
- Strava's very large activity and athlete numbers, expected from mid-2027, are kept exactly.
- A rider rides for one team at a time. Someone who already rides for another team chooses at sign-in to stay there or switch, and switching deletes their rides, Rynke and badges at the old team. Guests may still be on more than one team.
