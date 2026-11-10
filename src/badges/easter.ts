// Easter Sunday of a year in the Gregorian calendar, for the Osterhase
// surprise badge (feature 013 part F, FR-017, research R44): the anonymous
// Gregorian algorithm (Meeus/Jones/Butcher), integer arithmetic only.

/** Easter Sunday of `year` as `YYYY-MM-DD`. */
export function easterSunday(year: number): string {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The first Advent Sunday of `year` as `YYYY-MM-DD`, for the Advent quote
 * monkey (feature 035 FR-005): the fourth Sunday before Christmas Day, 21 days
 * before the last Sunday on or before 24 December (27 Nov to 3 Dec).
 */
export function firstAdventSunday(year: number): string {
	const eve = Date.UTC(year, 11, 24);
	const fourth = eve - new Date(eve).getUTCDay() * 86_400_000;
	return new Date(fourth - 21 * 86_400_000).toISOString().slice(0, 10);
}
