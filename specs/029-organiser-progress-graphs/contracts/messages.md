# Contract: Texts

Rider-facing text goes in `src/i18n/messages/en.ts` and `de.ts`, and in `catalogs.test.ts` where that lists
keys. The wording below is a proposal for review with the code. German follows the project's gender wording.

## Consent and privacy

**New `consent.dailyFigures`**, after `consent.organisers` in the consent form:

- EN: "The organisers also see, with your first name, how many kilometres you rode outdoors and virtually and
  how many metres of elevation you climbed, as a total per day, across the whole season. This includes private
  rides that count. They don't see a list of your rides, their names, times or routes."
- DE: "Die Orga sieht mit deinem Vornamen außerdem, wie viele Kilometer du draußen und virtuell gefahren bist
  und wie viele Höhenmeter du gesammelt hast, als Summe pro Tag und über die ganze Saison. Private Fahrten,
  die gewertet werden, sind dabei. Eine Liste deiner Fahrten, ihre Namen, Zeiten oder Strecken sieht sie nicht."

**Changed `landing.purpose`**:

- EN: "We use the data only for Rynke and team events. Only you see the list of your rides and their names."
- DE: "Wir nutzen die Daten nur für Rynke und Teamtermine. Die Liste deiner Fahrten und ihre Namen siehst nur du."

**Changed `privacy.visibility.organisers`**: replace the ending "but no individual activities" with:

- EN: "and your kilometres outdoors and virtually and your elevation as totals per day, but no list of your rides."
- DE: "und deine Kilometer draußen und virtuell und deine Höhenmeter als Summen pro Tag, aber keine Liste deiner
  Fahrten."

## New interface texts

All under `organiser.graphs.*` unless noted:

| Purpose | EN, from the draft |
| --- | --- |
| Heading | Progress |
| Graph titles | Outdoor kilometres (km), Virtual kilometres (km), Elevation (m) |
| Tabs | Outdoor, Virtual, Elevation |
| Picker label | Shown in the graphs |
| Summary | {n} riders, team average, team total, in the combinations shown |
| Picker | Find a rider, Clear all, Done, Team average, Team total |
| Picker foot | Not agreed yet: {names} |
| No match | No rider matches “{query}”. |
| Range | From, To, Season, 3 months, 4 weeks, Custom |
| Mode | Running total, Per day |
| Hint | Drag across a graph to choose dates. "Season" shows everything again. |
| Group note | 1 rider has no line, not agreed to showing daily figures yet. / {n} riders have… |
| Nobody yet | Riders are still being asked to agree. No lines yet. |
| Switch | Graphs, Riders ({n}) |
| Reports box | 1 open report, {n} open reports, Show all {n} |

The existing `progress.period.*` texts are reused for the presets where they match.
