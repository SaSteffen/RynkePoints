// Types for scripts/badge-prompts.mjs, for the tests in test/unit/.

export interface BadgeArt {
	id: string;
	group: string;
	category: string;
	threshold: number;
	scene: string;
}

/** Problems with the badge list (data-model.md), empty when it is valid. */
export function validateBadges(data: unknown): string[];

/** Problems with a team's own scenes against the shared list; empty when valid. */
export function validateTeamBadges(data: unknown, shared: unknown): string[];

/** The badge's prompt: the template with its scene and snippets filled in. */
export function buildPrompt(
	template: string,
	snippets: Record<string, string>,
	badge: BadgeArt,
): string;
