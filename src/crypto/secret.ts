/** Compares in constant time; hashing first makes the lengths equal. */
export async function secretEquals(
	given: string,
	expected: string,
): Promise<boolean> {
	const digest = (value: string) =>
		crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	const [a, b] = await Promise.all([digest(given), digest(expected)]);
	return crypto.subtle.timingSafeEqual(a, b);
}
