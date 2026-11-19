// The solstices, for the Sonnenwende surprise badge (feature 013 part F,
// FR-017): the longest and the shortest day fall on 20 or 21 June and 21 or
// 22 December. Stored by year as the date in Central European time, worked
// out with Meeus's algorithm (Astronomical Algorithms, chapter 27), through
// the season 2046/47; a later year falls back to 21 June and 21 December.

/** Per year, the June and the December solstice as `MM-DD`. */
const SOLSTICES: Readonly<Record<number, readonly [string, string]>> = {
	2025: ["06-21", "12-21"],
	2026: ["06-21", "12-21"],
	2027: ["06-21", "12-22"],
	2028: ["06-20", "12-21"],
	2029: ["06-21", "12-21"],
	2030: ["06-21", "12-21"],
	2031: ["06-21", "12-22"],
	2032: ["06-20", "12-21"],
	2033: ["06-21", "12-21"],
	2034: ["06-21", "12-21"],
	2035: ["06-21", "12-22"],
	2036: ["06-20", "12-21"],
	2037: ["06-21", "12-21"],
	2038: ["06-21", "12-21"],
	2039: ["06-21", "12-22"],
	2040: ["06-20", "12-21"],
	2041: ["06-21", "12-21"],
	2042: ["06-21", "12-21"],
	2043: ["06-21", "12-22"],
	2044: ["06-20", "12-21"],
	2045: ["06-21", "12-21"],
	2046: ["06-21", "12-21"],
	2047: ["06-21", "12-22"],
};

/** The June (6) or December (12) solstice of `year` as `YYYY-MM-DD`. */
export function solstice(year: number, month: 6 | 12): string {
	const [june, december] = SOLSTICES[year] ?? ["06-21", "12-21"];
	return `${year}-${month === 6 ? june : december}`;
}

/** Whether `date` (`YYYY-MM-DD`) is its year's June or December solstice. */
export function isSolstice(date: string, month: 6 | 12): boolean {
	return date === solstice(Number(date.slice(0, 4)), month);
}
