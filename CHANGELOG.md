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

## 1.0.0

- The app has a version number. Settings shows it and links to this list of changes.
- Settings is one page of grouped rows instead of nine cards, with the Strava connection on top.
- A rider can sign out on every device at once from Settings. Signing in at one team no longer counts at another.
- Strava's very large activity and athlete numbers, expected from mid-2027, are kept exactly.
- A rider rides for one team at a time. Someone who already rides for another team chooses at sign-in to stay there or switch, and switching deletes their rides, Rynke and badges at the old team. Guests may still be on more than one team.
