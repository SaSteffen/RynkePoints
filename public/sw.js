// RynkePoints service worker (feature 010 contracts/client.md, research R2).
// Network only: every page comes from the server, asked for while this worker
// still starts (navigation preload). The only cached responses are
// the offline notice and the notification text in the device's language, never
// a page or rider data (FR-005). The page registers it as `/sw.js?lang=<l>`, so
// switching the language installs it again with the new texts.

const param = new URL(location.href).searchParams.get("lang") ?? "";
// Any other value asks with no language, so the server gives the team's default
// (feature 026 contracts/locales.md › Picker); it accepts only shipped ones.
const lang = /^[a-z]{2}$/.test(param) ? param : "";
const CACHE = `rp-${lang}`;
const OFFLINE = `/offline?lang=${lang}`;
const TEXT = `/notification-text?lang=${lang}`;
const RIDER_TEXT = `/me/notification-text?lang=${lang}`;
/** Where a notification may lead; the rider page unless the text says. */
const PAGES = ["/me", "/me/badges"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll([OFFLINE, TEXT]);
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			await Promise.all(
				names
					.filter((name) => name.startsWith("rp-") && name !== CACHE)
					.map((name) => caches.delete(name)),
			);
			// The browser sends a navigation itself while this worker starts,
			// where it can; the page no longer waits for the start.
			await self.registration.navigationPreload?.enable();
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	if (event.request.mode !== "navigate") return;
	// The notice is stored with `Vary: Accept-Language, Cookie`; its URL already
	// holds the language, so it matches whatever the navigation sent.
	event.respondWith(
		(async () => {
			try {
				// The preloaded answer, where the browser asked ahead.
				return (await event.preloadResponse) ?? (await fetch(event.request));
			} catch {
				return (
					(await caches.match(OFFLINE, { ignoreVary: true })) ??
					Response.error()
				);
			}
		})(),
	);
});

/** What the signed-in rider still needs (issue #45), else null. */
async function riderText() {
	try {
		const response = await fetch(RIDER_TEXT, { cache: "no-store" });
		if (response.status === 200) return await response.json();
	} catch {
		// Offline or signed out on this device: the team's text instead.
	}
	return null;
}

/**
 * The cached text, else the server's, else the app name alone (FR-032). It
 * holds the team's icons: this file is the same for every team.
 */
async function teamText() {
	try {
		const response =
			(await caches.match(TEXT, { ignoreVary: true })) ?? (await fetch(TEXT));
		if (!response.ok) throw new Error(`status ${response.status}`);
		return await response.json();
	} catch {
		return { title: "RynkePoints" };
	}
}

/** The rider's words where there are some, always the team's icons. */
async function notificationText() {
	const [rider, team] = await Promise.all([riderText(), teamText()]);
	return rider ? { ...rider, icon: team.icon, badge: team.badge } : team;
}

// The push has no body; the device asks the server what to show
// (contracts/push-delivery.md "What the device shows").
self.addEventListener("push", (event) => {
	event.waitUntil(
		(async () => {
			const text = await notificationText();
			await self.registration.showNotification(text.title, {
				body: text.body,
				tag: "new-rynke",
				renotify: true,
				icon: text.icon,
				badge: text.badge,
				// Badges open the badges page (#125); anything else the rider page.
				data: { url: PAGES.includes(text.url) ? text.url : "/me" },
			});
		})(),
	);
});

// Opens the notification's page in an open RynkePoints window, or a new one
// (FR-019).
self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	event.waitUntil(
		(async () => {
			const url = PAGES.includes(event.notification.data?.url)
				? event.notification.data.url
				: "/me";
			const [open] = await self.clients.matchAll({
				type: "window",
				includeUncontrolled: true,
			});
			try {
				if (open) {
					await (await open.focus()).navigate(url);
					return;
				}
			} catch {
				// A window this worker doesn't control can't be navigated.
			}
			await self.clients.openWindow(url);
		})(),
	);
});
