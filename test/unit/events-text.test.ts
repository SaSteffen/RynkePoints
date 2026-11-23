import { describe, expect, it } from "vitest";
import { CATALOGS } from "../../src/i18n/catalogs";
import { eventsText, type NoEventsId } from "../../src/i18n/events-text";
import { europe } from "../../teams/europe/team";
import { hamburg } from "../../teams/hamburg/team";

// Feature 039 research R7, contracts/messages.md: a team without events reads
// the `.noEvents` variant of the texts that mention them.

/** Every base key of the contract's "Variants for a team without events". */
const VARIANTS: NoEventsId[] = [
	"landing.purpose",
	"consent.organisers",
	"privacy.team.body",
	"privacy.visibility.organisers",
	"privacy.legal.body",
	"tour.rider.outdoor",
	"tour.organiser.riders",
	"progress.day",
	"organiser.overview.qualifiedHint",
	"organiser.overview.amounts",
	"organiser.overview.corrections",
	"badges.surprise.sunday-outing.for",
];

describe("eventsText", () => {
	it.each(VARIANTS)("gives a team with events the base key %s", (id) => {
		expect(eventsText(hamburg, id)).toBe(id);
	});

	it.each(VARIANTS)("gives a team without events %s.noEvents", (id) => {
		expect(eventsText(europe, id)).toBe(`${id}.noEvents`);
	});
});

describe("the .noEvents variants", () => {
	it.each(Object.entries(CATALOGS))(
		"all exist in the %s catalog",
		(_locale, catalog) => {
			for (const id of VARIANTS) {
				expect(catalog, `${id}.noEvents`).toHaveProperty([`${id}.noEvents`]);
				expect(catalog[`${id}.noEvents`]).toBeTruthy();
			}
		},
	);
});
