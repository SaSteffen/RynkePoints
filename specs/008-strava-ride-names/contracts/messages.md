# Contract: catalog messages

Changes to `src/i18n/messages/de.ts` and `en.ts` (FR-007, FR-012). The two
catalogs keep the same IDs and placeholders (`test/unit/catalogs.test.ts`).

## New

| ID | de | en |
|---|---|---|
| `brand.viewOnStrava` | View on Strava | View on Strava |

This is Strava's link text, word for word in every language (FR-009,
clarification Q2). A test asserts that `de["brand.viewOnStrava"]` is exactly
`"View on Strava"`, and the ID joins `CONTRACT_IDS`.

## Changed (consent text, version stays 1)

The changes are marked in **bold**; everything else stays word for word.

`landing.dataRead`
- de: Wir lesen von deinen Radfahrten nur **Namen,** Sportart, Startzeit,
  Distanz, Bewegungszeit, Gesamtzeit mit Pausen, Höhenmeter, ob die Fahrt manuell
  eingetragen oder auf dem Rollentrainer gefahren wurde und ob Strava sie markiert
  hat – keine GPS-Spuren, Karten, Fotos oder Gesundheitsdaten.
- en: From your rides we only read **name,** sport type, start time, distance,
  moving time, elapsed time including pauses, elevation gain, whether the ride was
  entered manually or ridden on an indoor trainer, and whether Strava has flagged
  it – no GPS tracks, maps, photos or health data.

`landing.purpose`
- de: Wir nutzen die Daten nur für die Rynke (Punkte) und Events des Teams. Deine
  einzelnen Fahrten **und ihre Namen** sieht niemand außer dir.
- en: We use the data only for the team's Rynke (points) and events. Nobody but you
  sees your individual rides **or their names**.

`CONSENT_VERSION` stays `1` (FR-007, research R6). The comment in
`src/consent.ts` records why this change doesn't raise it.

## Where they appear

- `landing.dataRead` and `landing.purpose`: the landing page, as today, and newly
  the consent section of `/me`, above `consent.organisers` (research R6).
- `brand.viewOnStrava`: each ride's detail row on `/me`
  ([rider-page.md](rider-page.md)).

The ride name itself is rider data, never a message and never translated. The
copy guard exempts `span.ride-name` (research R8).
