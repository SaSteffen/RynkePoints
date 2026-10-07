import { escapeHtml, SafeHtml } from "../http/html";
import {
	type Catalog,
	type Catalogs,
	DEFAULT_LOCALE,
	type MessageId,
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
	const resolved = Object.hasOwn(catalogs, locale) ? locale : DEFAULT_LOCALE;
	const catalog: Partial<Catalog> = catalogs[resolved] ?? de;

	function message(id: MessageId): string {
		const text = catalog[id] ?? de[id];
		if (text === undefined) throw new Error(`Unknown message ${id}`);
		return text;
	}

	function param<T>(id: MessageId, params: Record<string, T>, name: string): T {
		if (!Object.hasOwn(params, name)) {
			throw new Error(`Message ${id} needs param ${name}`);
		}
		return params[name] as T;
	}

	const intlLocale = message("meta.intlLocale");
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

	return {
		locale: resolved,
		t(id, params = {}) {
			return message(id).replace(PLACEHOLDER, (_, name: string) =>
				String(param(id, params, name)),
			);
		},
		tHtml(id, params = {}) {
			const text = message(id);
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
		formatNumber(value, { fractionDigits }) {
			return new Intl.NumberFormat(intlLocale, {
				minimumFractionDigits: fractionDigits,
				maximumFractionDigits: fractionDigits,
			}).format(value);
		},
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
