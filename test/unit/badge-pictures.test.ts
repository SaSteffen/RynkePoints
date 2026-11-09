import { describe, expect, it } from "vitest";
import { BADGES } from "../../src/badges/catalog";
import {
	BADGE_PICTURES,
	badgePicture,
	PLACEHOLDER_PICTURE,
} from "../../src/badges/pictures";
import { artUrl } from "../../src/http/art";
import { badgeNames, renderBadgeReveal } from "../../src/http/sections/badges";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { TEAMS } from "../../src/teams";
import type { TeamData } from "../../src/teams/types";
import { makeCtx } from "../support/ctx";

// Badge pictures through the team's badge map (feature 026 T051, FR-024): a
// team's own picture, the neutral placeholder for a badge whose shared picture
// shows another team's motifs, else the shared picture. The maps here are
// synthetic, not any team's real one.

const [drawn, undrawn] = [
	BADGES.find((b) => BADGE_PICTURES.has(b.id)),
	BADGES.find((b) => !BADGE_PICTURES.has(b.id)),
];
const [own, swapped] = BADGES.filter((b) => BADGE_PICTURES.has(b.id)).slice(
	1,
	3,
);
if (!drawn || !own || !swapped) throw new Error("too few badge pictures");

const SYNTHETIC: TeamData["art"]["badges"] = {
	[own.id]: "/teams/synthetic/badges/own.svg",
	[swapped.id]: "placeholder",
};

describe("badgePicture", () => {
	it("gives the team's own picture, or the neutral one for a placeholder", () => {
		expect(badgePicture(SYNTHETIC, own)).toBe(
			"/teams/synthetic/badges/own.svg",
		);
		expect(badgePicture(SYNTHETIC, swapped)).toBe(PLACEHOLDER_PICTURE);
		expect(PLACEHOLDER_PICTURE).toBe("/badges/placeholder.svg");
	});

	it("gives the shared picture, or the group's placeholder, outside the map", () => {
		expect(badgePicture(SYNTHETIC, drawn)).toBe(`/badges/${drawn.id}.svg`);
		if (undrawn) {
			expect(badgePicture(SYNTHETIC, undrawn)).toBe(
				`/badges/placeholder-${undrawn.group}.svg`,
			);
		}
	});

	it("is hashed like the other badge pictures", () => {
		expect(artUrl(PLACEHOLDER_PICTURE)).toMatch(
			/^\/badges\/placeholder\.svg\?v=[0-9a-f]{10}$/,
		);
	});
});

describe("the badges page's pictures", () => {
	const i18n = createI18n("en", CATALOGS);
	const founding = TEAMS[0] as TeamData;
	const team: TeamData = {
		...founding,
		art: { ...founding.art, badges: SYNTHETIC },
	};

	it("show the team's map", () => {
		const names = badgeNames(makeCtx({ team }), i18n);
		const reveal = String(
			renderBadgeReveal(i18n, names, [
				{ badgeId: swapped.id, earnedOn: "2026-10-01" },
				{ badgeId: own.id, earnedOn: "2026-10-01" },
			]),
		);
		expect(reveal).toContain(`src="${artUrl(PLACEHOLDER_PICTURE)}"`);
		expect(reveal).toContain('src="/teams/synthetic/badges/own.svg"');
		expect(reveal).not.toContain(`/badges/${swapped.id}.svg`);
	});
});
