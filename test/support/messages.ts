import type { MessageValue } from "../../src/i18n/catalogs";

// Catalog values are a string or a plural object (feature 026 research R3).

/** Every text of a message: the string, or each plural form. */
export function forms(value: MessageValue): string[] {
	return typeof value === "string" ? [value] : Object.values(value);
}

/** The message with `fn` applied to each of its texts. */
export function mapMessage<T extends MessageValue>(
	value: T,
	fn: (text: string) => string,
): T {
	if (typeof value === "string") return fn(value) as T;
	return Object.fromEntries(
		Object.entries(value).map(([category, text]) => [category, fn(text)]),
	) as T;
}
