import { escapeHtml, SafeHtml } from "../http/html";
import type {
	Catalog,
	Catalogs,
	MessageId,
	MessageValue,
	PluralCategory,
} from "./catalogs";
import { de } from "./messages/de";

// Per-request translation helpers (research R16). The router builds one per
// request; handlers never import a catalog.

export type Params = Record<string, string | number>;
export type HtmlParams = Record<string, string | number | SafeHtml>;

export interface I18n {
	locale: string;
	t(id: MessageId, params?: Params): string;
	/** Escapes the message text; `SafeHtml` params are inserted as markup. */
	tHtml(id: MessageId, params?: HtmlParams): SafeHtml;
	formatNumber(value: number, options: { fractionDigits: number }): string;
	/** The UTC wall-clock date of an ISO-8601 timestamp, e.g. `06.10.2026`. */
	formatDate(iso: string): string;
	/** The UTC wall-clock time of an ISO-8601 timestamp, e.g. `08:00`. */
	formatTime(iso: string): string;
	locales: { locale: string; languageName: string }[];
}

const PLACEHOLDER = /\{(\w+)\}/g;

export function createI18n(locale: string, catalogs: Catalogs): I18n {
	// A locale nobody ships falls back to German, the catalogs' key source. The
	// router never asks for one: it resolves against the team (contracts/locales.md).
	const resolved = Object.hasOwn(catalogs, locale) ? locale : "de";
	const catalog: Partial<Catalog> = catalogs[resolved] ?? de;

	function value(id: MessageId): MessageValue {
		const text = catalog[id] ?? de[id];
		if (text === undefined) throw new Error(`Unknown message ${id}`);
		return text;
	}

	/**
	 * The message's text; a plural message picks its form by the `n` param
	 * (feature 026 research R3) and gets `n` formatted for the locale.
	 */
	function message<T>(
		id: MessageId,
		params: Record<string, T>,
	): { text: string; params: Record<string, T | string> } {
		const found = value(id);
		if (typeof found === "string") return { text: found, params };
		const n = params.n;
		if (typeof n !== "number" || !Number.isFinite(n)) {
			throw new Error(`Plural message ${id} needs a numeric param n`);
		}
		const category = pluralRules.select(n) as PluralCategory;
		const text = found[category] ?? found.other;
		const shown = Number.isInteger(n)
			? formatNumber(n, { fractionDigits: 0 })
			: String(n);
		return { text, params: { ...params, n: shown } };
	}

	function param<T>(id: MessageId, params: Record<string, T>, name: string): T {
		if (!Object.hasOwn(params, name)) {
			throw new Error(`Message ${id} needs param ${name}`);
		}
		return params[name] as T;
	}

	const intlLocale = value("meta.intlLocale") as string;
	// Plural rules by the catalog's language: the Workers runtime has them for
	// Icelandic, whose numbers and dates it can't format (`meta.intlLocale`).
	const pluralRules = new Intl.PluralRules(resolved);
	// Building a format is the slow part, and a page can use thousands of numbers.
	const numberFormats = new Map<number, Intl.NumberFormat>();
	const dateFormat = new Intl.DateTimeFormat(intlLocale, {
		timeZone: "UTC",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
	const timeFormat = new Intl.DateTimeFormat(intlLocale, {
		timeZone: "UTC",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	});

	function formatNumber(
		value: number,
		{ fractionDigits }: { fractionDigits: number },
	): string {
		let format = numberFormats.get(fractionDigits);
		if (!format) {
			format = new Intl.NumberFormat(intlLocale, {
				minimumFractionDigits: fractionDigits,
				maximumFractionDigits: fractionDigits,
			});
			numberFormats.set(fractionDigits, format);
		}
		return format.format(value);
	}

	return {
		locale: resolved,
		t(id, given = {}) {
			const { text, params } = message(id, given);
			return text.replace(PLACEHOLDER, (_, name: string) =>
				String(param(id, params, name)),
			);
		},
		tHtml(id, given = {}) {
			const { text, params } = message(id, given);
			let out = "";
			let last = 0;
			for (const match of text.matchAll(PLACEHOLDER)) {
				const value = param(id, params, match[1] ?? "");
				out += escapeHtml(text.slice(last, match.index));
				out +=
					value instanceof SafeHtml ? value.value : escapeHtml(String(value));
				last = match.index + match[0].length;
			}
			return new SafeHtml(out + escapeHtml(text.slice(last)));
		},
		formatNumber,
		formatDate(iso) {
			return dateFormat.format(new Date(iso));
		},
		formatTime(iso) {
			return timeFormat.format(new Date(iso));
		},
		locales: Object.entries(catalogs).map(([code, c]) => ({
			locale: code,
			languageName: c["meta.languageName"],
		})),
	};
}
