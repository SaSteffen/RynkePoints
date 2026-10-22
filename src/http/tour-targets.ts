// The elements a tour step can point at, each an `id` on its page (feature
// 020 FR-003). Apart from `tour.ts`, so the stylesheet can list them without
// importing the tour's handlers.

export const TOUR_TARGETS = [
	"tour-peloton",
	"tour-elevation",
	"tour-team",
	"tour-outdoor",
	"tour-rejected-ride",
	"tour-short-ride",
	"tour-groups",
	"tour-pace",
	"tour-requests",
	"tour-new-event",
	"tour-later-event",
	"tour-past-event",
	"tour-theme",
] as const;

export type TourTarget = (typeof TOUR_TARGETS)[number];
