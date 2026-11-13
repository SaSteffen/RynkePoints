# Contract: the ride card's "So geht's"

For a ride that doesn't count for a fixable reason, the steps are:

1. The crop step, as today (`rynke.ride.fix.crop`).
2. The wait step, new: `rynke.ride.fix.wait_recheck`.

German (key source):

> Danach musst du nichts weiter tun. Die App schaut regelmäßig bei Strava nach und übernimmt die
> Änderung von selbst, meist nach ein paar Stunden, spätestens nach 24 Stunden. Tut sich dann
> nichts, wende dich an die Orga.

- `rynke.ride.fix.rename` is removed from all ten catalogs and from the card.
- `rynke.ride.fix.manual` and the manual-entry card are unchanged.
- No catalog entry of the ride card mentions the title in any language (test over all locales).
- Europe's English is written fresh, not translated word for word; "die Orga" becomes that
  team's word for its organisers, as elsewhere in the catalog.
