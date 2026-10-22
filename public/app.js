// RynkePoints page script (feature 010 contracts/client.md, research R16). It
// only wires up what a server-rendered page can't do itself: the service worker,
// the install group and the app prompt, the notifications switch, the theme
// menu, bringing a section up to date on return and once the first data is
// there, other views and saves swapped in place (`data-swap`), the
// buttons' press and busy feedback, opening a badge's large view on mouse
// hover (feature 013 research R19), the event page's tri-state boxes
// (feature 019 research R5) and the Overview's progress charts (feature 009).
// It holds no text: every word shown comes from the page's markup, rendered
// from the catalogs and hidden until this shows it.

/**
 * Resolves to whether the service worker is registered. Firefox's private
 * windows have `navigator.serviceWorker` but may refuse to register one, and
 * its `ready` then never resolves.
 */
function registerWorker() {
	if (!("serviceWorker" in navigator)) return Promise.resolve(false);
	const lang = encodeURIComponent(document.documentElement.lang);
	return navigator.serviceWorker
		.register(`/sw.js?lang=${lang}`, { scope: "/" })
		.then(
			() => true,
			() => false,
		);
}

function standalone() {
	return (
		matchMedia("(display-mode: standalone)").matches ||
		navigator.standalone === true
	);
}

/**
 * The browser's install prompt, kept by one listener so the Settings group and
 * the app prompt can both offer it (015 contracts/client.md).
 */
let installEvent = null;
const installable = [];
window.addEventListener("beforeinstallprompt", (event) => {
	event.preventDefault();
	installEvent = event;
	for (const callback of installable) callback();
});

/**
 * The steps to show where the browser has no install prompt of its own: Safari
 * on iOS, Firefox on Android and Safari 17+ on the Mac. Null elsewhere.
 */
function manualInstall() {
	// Only Safari on iOS defines it, and false means "not on the home screen".
	if (navigator.standalone === false) return "ios";
	const agent = navigator.userAgent;
	if (/Android/.test(agent) && /Firefox\//.test(agent)) return "firefox";
	const safari = agent.match(/Macintosh.*Version\/(\d+)[\d.]* Safari\//);
	if (
		safari &&
		Number(safari[1]) >= 17 &&
		!/Chrome|Chromium|Edg|Firefox|OPR/.test(agent)
	) {
		return "macSafari";
	}
	return null;
}

/** Shows the browser's install prompt once; the event can't be reused. */
function promptInstall() {
	installEvent?.prompt();
	installEvent = null;
}

/**
 * The App group in Settings (FR-004, 015 FR-011, research R11): it shows where
 * installing helps, has no dismiss, and ignores the app prompt's answers.
 */
function installSettings(signal) {
	const hint = document.querySelector("#settings-app #install");
	if (!hint || standalone()) return;
	const group = hint.closest("section#settings-app");
	const setShown = (shown) => {
		hint.hidden = !shown;
		group.hidden = !shown;
	};
	const prompt = hint.querySelector('[data-install="prompt"]');
	const showPrompt = () => {
		prompt.hidden = false;
		setShown(true);
	};
	installable.push(() => {
		if (!signal.aborted) showPrompt();
	});
	if (installEvent) showPrompt();
	prompt.querySelector("button").addEventListener("click", () => {
		setShown(false);
		promptInstall();
	});

	const manual = manualInstall();
	if (manual) {
		hint.querySelector(`[data-install="${manual}"]`).hidden = false;
		setShown(true);
	}

	window.addEventListener(
		"appinstalled",
		() => {
			setShown(false);
		},
		{ signal },
	);
}

function fromBase64Url(value) {
	const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Asks the server about, or changes, this device's registration. */
async function post(action, endpoint) {
	const body = new FormData();
	body.set("action", action);
	body.set("endpoint", endpoint);
	const response = await fetch("/me/notifications", {
		method: "POST",
		body,
		credentials: "same-origin",
	});
	if (response.status !== 200) throw new Error(`status ${response.status}`);
	return (await response.json()).on;
}

/** Signing out ends this device's notifications (research R9). */
function setSignOutEndpoint(endpoint) {
	for (const input of document.querySelectorAll("input[name=push_endpoint]")) {
		input.value = endpoint;
	}
}

/**
 * Turns notifications on for this device, from a tap: the Settings switch and
 * the app prompt's offer (015 FR-014, research R10). Resolves to the state to
 * show, "on", "off" or "blocked", and throws when it fails.
 */
async function subscribePush(pushKey) {
	// Asked inside the tap, before anything else (FR-010).
	const permission = await Notification.requestPermission();
	if (permission === "denied") return "blocked";
	if (permission !== "granted") return "off";
	const { pushManager } = await navigator.serviceWorker.ready;
	const subscription =
		(await pushManager.getSubscription()) ??
		(await pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: fromBase64Url(pushKey),
		}));
	await post("on", subscription.endpoint);
	setSignOutEndpoint(subscription.endpoint);
	return "on";
}

/** Tells the Settings switch that the app prompt changed this device. */
const PUSH_CHANGED = "rp-push-changed";

/**
 * The section in Settings (FR-010, FR-011, research R8's state table; feature
 * 011 contracts/client.md "Notifications switch").
 */
async function notifications(signal) {
	const section = document.getElementById("notifications");
	if (!section) return;
	const toggle = section.querySelector('[data-action="toggle"]');
	/**
	 * Shows exactly one state. The switch shows for on, off and failed; failed
	 * keeps the value it had before the attempt.
	 */
	const show = (state, checked) => {
		for (const p of section.querySelectorAll("[data-state]")) {
			p.hidden = p.dataset.state !== state;
		}
		toggle.hidden = !["on", "off", "failed"].includes(state);
		if (checked !== undefined) toggle.setAttribute("aria-checked", checked);
		section.hidden = false;
	};

	if (
		!("serviceWorker" in navigator) ||
		!("PushManager" in window) ||
		!("Notification" in window)
	) {
		show("unsupported");
		return;
	}
	if (navigator.standalone === false) {
		show("needsHomeScreen");
		return;
	}
	if (!(await registered)) {
		show("unsupported");
		return;
	}
	let pushManager;
	let subscription;
	try {
		({ pushManager } = await navigator.serviceWorker.ready);
		subscription = await pushManager.getSubscription();
	} catch {
		show("unsupported");
		return;
	}
	if (subscription) setSignOutEndpoint(subscription.endpoint);

	const turnOn = async () => {
		try {
			const state = await subscribePush(section.dataset.pushKey);
			if (state === "on") {
				subscription = await pushManager.getSubscription();
				show("on", true);
			} else {
				show(state, state === "off" ? false : undefined);
			}
		} catch {
			show("failed");
		}
	};
	const turnOff = async () => {
		try {
			if (subscription) {
				const { endpoint } = subscription;
				await subscription.unsubscribe();
				subscription = null;
				setSignOutEndpoint("");
				await post("off", endpoint);
			}
			show("off", false);
		} catch {
			show("failed");
		}
	};
	// One change at a time: a second tap mid-way would subscribe twice.
	toggle.addEventListener("click", async () => {
		toggle.disabled = true;
		try {
			await (toggle.getAttribute("aria-checked") === "true"
				? turnOff()
				: turnOn());
		} finally {
			toggle.disabled = false;
		}
	});

	const sync = async () => {
		if (Notification.permission === "denied") {
			show("blocked");
		} else if (!subscription) {
			show("off", false);
		} else {
			try {
				// The server decides: sign-out or another rider may have ended it.
				const on = await post("check", subscription.endpoint);
				show(on ? "on" : "off", on);
			} catch {
				show("failed", false);
			}
		}
	};
	// The app prompt may turn them on while Settings is open (research R10).
	document.addEventListener(
		PUSH_CHANGED,
		async () => {
			subscription = await pushManager.getSubscription();
			if (subscription) setSignOutEndpoint(subscription.endpoint);
			await sync();
		},
		{ signal },
	);
	await sync();
}

/**
 * The floating prompt in the signed-in sections (015 FR-012–FR-016,
 * contracts/client.md, data-model.md "Prompt panel transitions"): once per
 * device it offers installing, then turning on notifications. One panel shows
 * at a time; nothing moves focus, and Escape closes it like the close button.
 */
function appPrompt() {
	const aside = document.getElementById("app-prompt");
	if (!aside) return;
	const INSTALL = "rp-install-prompt";
	const NOTIFY = "rp-notify-offer";
	const answered = {};
	try {
		// The old hint's dismissal is no answer to this prompt (research R9).
		localStorage.removeItem("rp-install-dismissed");
		answered[INSTALL] = localStorage.getItem(INSTALL) !== null;
		answered[NOTIFY] = localStorage.getItem(NOTIFY) !== null;
	} catch {
		return;
	}
	const answer = (key) => {
		answered[key] = true;
		try {
			localStorage.setItem(key, "done");
		} catch {}
	};
	const panels = {
		install: aside.querySelector('[data-panel="install"]'),
		notify: aside.querySelector('[data-panel="notify"]'),
	};
	const keys = { install: INSTALL, notify: NOTIFY };
	let shown = null;
	const show = (name) => {
		for (const [key, panel] of Object.entries(panels)) {
			panel.hidden = key !== name;
		}
		aside.hidden = name === null;
		shown = name;
	};
	const close = () => {
		if (shown === null) return;
		answer(keys[shown]);
		show(null);
	};

	const offerNotifications = async () => {
		if (
			shown !== null ||
			answered[NOTIFY] ||
			!("serviceWorker" in navigator) ||
			!("PushManager" in window) ||
			!("Notification" in window) ||
			Notification.permission !== "default" ||
			!(await registered)
		) {
			return;
		}
		const { pushManager } = await navigator.serviceWorker.ready;
		if (shown !== null || (await pushManager.getSubscription())) return;
		// The visible panel's first paragraph names the prompt.
		document.getElementById("app-prompt-title")?.removeAttribute("id");
		panels.notify.querySelector("p").id = "app-prompt-title";
		show("notify");
	};

	if (!standalone() && !answered[INSTALL]) {
		const showInstall = (way) => {
			if (shown !== null && shown !== "install") return;
			panels.install.querySelector(`[data-install="${way}"]`).hidden = false;
			show("install");
		};
		installable.push(() => showInstall("prompt"));
		if (installEvent) showInstall("prompt");
		const manual = manualInstall();
		if (manual) showInstall(manual);
		panels.install
			.querySelector('[data-install="prompt"] button')
			.addEventListener("click", () => {
				answer(INSTALL);
				show(null);
				promptInstall();
			});
	}
	window.addEventListener("appinstalled", () => {
		answer(INSTALL);
		if (shown === "install") show(null);
		offerNotifications().catch(() => {});
	});

	const accept = panels.notify.querySelector('[data-action="accept"]');
	accept.addEventListener("click", async () => {
		accept.disabled = true;
		try {
			await subscribePush(aside.dataset.pushKey);
		} catch {
			// Settings still offers the switch, with its own error state.
		}
		answer(NOTIFY);
		show(null);
		document.dispatchEvent(new Event(PUSH_CHANGED));
	});
	panels.notify
		.querySelector('[data-action="decline"]')
		.addEventListener("click", close);
	aside.querySelector('[data-action="close"]').addEventListener("click", close);
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") close();
	});

	if (standalone()) offerNotifications().catch(() => {});
}

/**
 * The header's theme menu (feature 022 contracts/theme-menu.md): the palette
 * button opens it with the theme shown now checked; a choice applies at once,
 * as the head script does on load, is kept for this device only and leaves the
 * menu open. Escape, a tap outside or the close button close it and put focus
 * back on the palette button. Run once per page load: content swapped in place
 * leaves the header and the menu alone.
 */
function themeMenu() {
	const button = document.querySelector("button.theme-button");
	const panel = document.getElementById("theme-menu");
	if (!button || !panel) return;
	const KEY = "rp-theme";
	const root = document.documentElement;
	const radios = [...panel.querySelectorAll("input[name=theme]")];
	const byValue = (value) => radios.find((radio) => radio.value === value);
	const shown = byValue(root.dataset.theme) ?? byValue("auto");
	if (shown) shown.checked = true;
	// Automatisch's two colours, one per system setting, as the page is served.
	const autoColour = {
		light: byValue("rynke-day")?.dataset.color,
		dark: byValue("rynke-night")?.dataset.color,
	};

	const open = () => {
		panel.hidden = false;
		button.setAttribute("aria-expanded", "true");
		(panel.querySelector("input:checked") ?? radios[0])?.focus();
	};
	const close = () => {
		if (panel.hidden) return;
		panel.hidden = true;
		button.setAttribute("aria-expanded", "false");
		button.focus();
	};
	button.addEventListener("click", () => (panel.hidden ? open() : close()));
	panel
		.querySelector('[data-action="close"]')
		?.addEventListener("click", close);
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") close();
	});
	document.addEventListener("click", (event) => {
		const target = event.target;
		if (
			target instanceof Node &&
			!panel.contains(target) &&
			!button.contains(target)
		) {
			close();
		}
	});

	for (const radio of radios) {
		radio.addEventListener("change", () => {
			const theme = radio.value;
			try {
				if (theme === "auto") localStorage.removeItem(KEY);
				else localStorage.setItem(KEY, theme);
			} catch {}
			const metas = document.querySelectorAll('meta[name="theme-color"]');
			if (theme === "auto") {
				delete root.dataset.theme;
				delete root.dataset.scheme;
				for (const [i, m] of [...metas].entries()) {
					const scheme = i === 0 ? "light" : "dark";
					m.media = `(prefers-color-scheme: ${scheme})`;
					m.content = autoColour[scheme];
				}
			} else {
				root.dataset.theme = theme;
				root.dataset.scheme = radio.dataset.scheme;
				for (const m of metas) {
					m.removeAttribute("media");
					m.content = radio.dataset.color;
				}
			}
		});
	}
}

/** How long the next page may take before the progress bar shows (issue #108). */
const LOADING_DELAY_MS = 1000;
let loadingTimer = null;

/**
 * Shows the page's progress bar if the next page isn't there within a second
 * (issue #108). Every page is a full round trip to the server, and until it
 * answers the browser keeps showing this one as if nothing happened.
 */
function startLoading() {
	const bar = document.querySelector(".page-loading");
	if (!bar || loadingTimer !== null) return;
	loadingTimer = setTimeout(() => {
		bar.hidden = false;
	}, LOADING_DELAY_MS);
}

function stopLoading() {
	clearTimeout(loadingTimer);
	loadingTimer = null;
	const bar = document.querySelector(".page-loading");
	if (bar) bar.hidden = true;
}

/**
 * Starts the progress bar for whatever leaves this page for another of ours: a
 * link, the top bar's refresh, a form. Links to another site, a new tab, a
 * download or a file don't count: this page stays. A page restored from the
 * back-forward cache, or left for another app (Strava's, say), starts without
 * it.
 */
function pageLoading() {
	document.addEventListener("click", (event) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		const link =
			event.target instanceof Element ? event.target.closest("a[href]") : null;
		if (
			!(link instanceof HTMLAnchorElement) ||
			link.hasAttribute("download") ||
			(link.target !== "" && link.target !== "_self")
		) {
			return;
		}
		const url = new URL(link.href);
		const samePage =
			url.pathname === location.pathname && url.search === location.search;
		if (
			url.origin !== location.origin ||
			(samePage && url.hash !== "") ||
			/\.[a-z0-9]+$/i.test(url.pathname)
		) {
			return;
		}
		startLoading();
	});
	document.addEventListener("submit", (event) => {
		if (!event.defaultPrevented) startLoading();
	});
	window.addEventListener("pageshow", stopLoading);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") stopLoading();
	});
}

/**
 * A section brought back after more than a minute in the background is
 * brought up to date in place, so its figures are current without a reload
 * (feature 011 FR-009, research R8). Public pages have no `nav.app-nav` and
 * keep what the rider typed.
 */
function refreshOnReturn() {
	let hiddenAt = null;
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			hiddenAt = Date.now();
		} else if (
			hiddenAt !== null &&
			Date.now() - hiddenAt > 60000 &&
			document.querySelector("nav.app-nav")
		) {
			refreshPage();
		}
	});
}

/**
 * The waiting state before the first data (015 contracts/client.md): asks
 * /me/ready every data-poll-seconds while the page is visible, and brings the
 * page up to date once the first balance is there. A 401, a network error or
 * "not yet" just waits for the next tick.
 */
function waitForFirstData(signal) {
	const waiting = document.querySelector("[data-waiting]");
	if (!waiting) return;
	const configured = Number(waiting.dataset.pollSeconds);
	const seconds =
		Number.isInteger(configured) && configured > 0 ? configured : 10;
	const timer = setInterval(async () => {
		if (document.visibilityState !== "visible") return;
		try {
			const res = await fetch("/me/ready", {
				credentials: "same-origin",
				cache: "no-store",
			});
			if (!res.ok) return;
			const { ready } = await res.json();
			if (ready === true) {
				clearInterval(timer);
				refreshPage();
			}
		} catch {
			// Offline or a bad answer: try again on the next tick.
		}
	}, seconds * 1000);
	signal.addEventListener("abort", () => clearInterval(timer));
}

/** Ends the listeners of the content shown now, when other content replaces it. */
let content = new AbortController();

/** A page's view, without its fragment: a link to `#…` changes no view. */
const viewOf = (url) => url.pathname + url.search;

/** The view the content shows, for the back button (`swapViews`). */
let shownView = viewOf(location);

/**
 * Puts `doc`, this page as the server sends it now, in place of the shown one:
 * the content, the navigation with its counts, the refresh link and a tour's
 * card. The scroll position stays. `false` without content to swap; the caller
 * then loads the page instead.
 */
function swapPage(doc) {
	const main = document.querySelector("main");
	const next = doc.querySelector("main");
	const nav = document.querySelector("nav.app-nav");
	if (!main || !next || !nav) return false;
	content.abort();
	content = new AbortController();
	main.replaceChildren(...next.childNodes);
	// The tour's card sits before the app prompt and the navigation.
	const tour = doc.querySelector("aside.tour");
	document.querySelector("aside.tour")?.remove();
	if (tour) (document.getElementById("app-prompt") ?? nav).before(tour);
	for (const selector of ["header.top-bar a.refresh", "nav.app-nav"]) {
		const fresh = doc.querySelector(selector);
		if (fresh) document.querySelector(selector)?.replaceWith(fresh);
	}
	document.title = doc.title;
	const { signal } = content;
	const scripts = missingScripts(doc);
	if (scripts.length === 0) enhance(signal);
	else {
		loadScripts(scripts).then(() => {
			if (!signal.aborted) enhance(signal);
		});
	}
	return true;
}

/**
 * The scripts `doc` loads before this one that this page hasn't, such as the
 * chart library of an Overview that only now shows its charts (feature 009).
 */
function missingScripts(doc) {
	const loaded = new Set(
		[...document.scripts].map((script) => script.getAttribute("src")),
	);
	return [...doc.head.querySelectorAll("script[src]")]
		.map((script) => script.getAttribute("src"))
		.filter((src) => !loaded.has(src));
}

/** Loads `sources` one after the other; one that fails is passed over. */
async function loadScripts(sources) {
	for (const src of sources) {
		await new Promise((resolve) => {
			const script = document.createElement("script");
			script.src = src;
			script.addEventListener("load", resolve);
			script.addEventListener("error", resolve);
			document.head.append(script);
		});
	}
}

/** The page in `res`, when it is this page again and fine to swap in. */
async function samePage(res) {
	if (!res.ok || new URL(res.url).pathname !== location.pathname) return null;
	return new DOMParser().parseFromString(await res.text(), "text/html");
}

/** The request swapping the page now; a newer one cancels it. */
let swapping = null;

/**
 * Shows this page at `url` in place: `push` adds a history entry, as following
 * a link does. Anything unexpected (signed out, another page, an error) loads
 * it the usual way instead.
 */
async function showPage(url, push) {
	swapping?.abort();
	const controller = new AbortController();
	swapping = controller;
	startLoading();
	try {
		const res = await fetch(url, {
			credentials: "same-origin",
			cache: "no-store",
			signal: controller.signal,
		});
		const doc = await samePage(res);
		if (!doc) {
			location.assign(res.ok ? res.url : url);
			return;
		}
		const focused = document.activeElement?.closest("a[data-swap]");
		const href = focused?.getAttribute("href");
		if (!swapPage(doc)) {
			location.assign(url);
			return;
		}
		shownView = viewOf(new URL(url));
		if (push) history.pushState(null, "", url);
		// Keyboard users stay on the link of the view they picked.
		if (href) {
			document
				.querySelector(`main a[data-swap][href="${href}"]`)
				?.focus({ preventScroll: true });
		}
	} catch (error) {
		if (error.name === "AbortError") return;
		location.assign(url);
		return;
	} finally {
		if (swapping === controller) swapping = null;
	}
	stopLoading();
}

/**
 * The page again, in place. Rides, with more rides loaded than its first
 * batch, reloads instead: its own restore finds the ride in view (feature 018).
 */
function refreshPage() {
	if (document.querySelector("section#rides[data-lazy]")) {
		startLoading();
		location.reload();
		return;
	}
	showPage(location.href, false);
}

/**
 * Sends `form` and swaps the page it leads back to in place, at the same
 * scroll position, in place of its history entry (POST, then redirect). A
 * notice of the result that isn't in view floats above the navigation for a
 * while. Where the answer is another page or an error, the browser takes over.
 */
async function sendForm(form, submitter) {
	submitter?.setAttribute("aria-busy", "true");
	startLoading();
	let res;
	try {
		res = await fetch(form.action, {
			method: "POST",
			body: new FormData(form, submitter),
			credentials: "same-origin",
		});
	} catch {
		// Offline: the browser's own submit says so.
		nativeSubmit(form, submitter);
		return;
	}
	// Refused without a redirect: the browser shows that answer itself.
	if (!res.ok && !res.redirected) {
		nativeSubmit(form, submitter);
		return;
	}
	const doc = await samePage(res);
	if (!doc || !swapPage(doc)) {
		location.assign(res.url);
		return;
	}
	history.replaceState(null, "", res.url);
	shownView = viewOf(new URL(res.url));
	stopLoading();
	floatNotice();
}

/** Submits `form` the usual way, past `sendForm`. */
function nativeSubmit(form, submitter) {
	form.dataset.native = "true";
	delete form.dataset.submitting;
	submitter?.removeAttribute("aria-busy");
	stopLoading();
	form.requestSubmit(submitter);
}

/** How long a floating notice stays, unless focus is in it (its undo, say). */
const NOTICE_FLOAT_MS = 10000;

/** Floats the content's first notice while it is out of view after a save. */
function floatNotice() {
	const notice = document.querySelector(
		"main .notice[role=status], main .notice[role=alert]",
	);
	if (!notice) return;
	const bar = document.querySelector("header.top-bar");
	const top = bar ? bar.getBoundingClientRect().bottom : 0;
	const { top: from, bottom: to } = notice.getBoundingClientRect();
	if (from >= top && to <= innerHeight) return;
	notice.classList.add("notice-floating");
	const land = () => {
		if (notice.contains(document.activeElement)) {
			notice.addEventListener("focusout", land, { once: true });
		} else {
			notice.classList.remove("notice-floating");
		}
	};
	setTimeout(land, NOTICE_FLOAT_MS);
}

/**
 * Links that show this page in another view (`data-swap`: the Team section's
 * switches, all past events) swap it in place, without a reload, and the
 * address and the back button follow (issue #113). Forms with `data-swap`
 * save in place (`sendForm`).
 */
function swapViews() {
	const path = location.pathname;
	document.addEventListener("click", (event) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		const link =
			event.target instanceof Element
				? event.target.closest("a[href][data-swap]")
				: null;
		if (!(link instanceof HTMLAnchorElement)) return;
		const url = new URL(link.href);
		if (url.origin !== location.origin || url.pathname !== path) return;
		event.preventDefault();
		if (url.href !== location.href) showPage(url.href, true);
	});
	document.addEventListener("submit", (event) => {
		const form = event.target;
		if (
			event.defaultPrevented ||
			!(form instanceof HTMLFormElement) ||
			!form.hasAttribute("data-swap")
		) {
			return;
		}
		if (form.dataset.native === "true") return;
		event.preventDefault();
		// One save at a time, as `pendingSubmit` does for the others.
		if (form.dataset.submitting === "true") return;
		form.dataset.submitting = "true";
		sendForm(form, event.submitter);
	});
	addEventListener("popstate", () => {
		if (location.pathname === path && viewOf(location) !== shownView) {
			showPage(location.href, false);
		}
	});
}

/** Where Rides keeps its place in this tab (feature 018 research R5). */
const RIDES_PLACE = "rp-rides-place";

/** The most rides one request may bring back (018 contracts/http-routes.md). */
const MAX_RIDE_BATCH = 1000;

/**
 * Rides as one continuous list (feature 018 contracts/client.md): the next
 * rides load as the end of the list comes within a screen, and a reload or the
 * back button finds the same ride in view.
 */
function lazyRides(signal) {
	const section = document.querySelector("section#rides[data-lazy]");
	const list = section?.querySelector("ol.ride-list");
	const more = section?.querySelector(".rides-more");
	const status = more?.querySelector(".rides-status");
	const retry = more?.querySelector("[data-retry]");
	if (!list || !status || !retry) return;
	try {
		history.scrollRestoration = "manual";
	} catch {}

	const cards = () => Array.from(list.querySelectorAll("li.ride-card"));
	/** A card's ride, from its "View on Strava" link. */
	const rideOf = (card) => {
		const link = card.querySelector("a.strava-activity");
		return link?.href.match(/\/(\d+)$/)?.[1] ?? null;
	};
	const setState = (state) => {
		if (state) more.dataset.state = state;
		else more.removeAttribute("data-state");
		const text = state ? status.dataset[state] : "";
		status.textContent = text ?? "";
		retry.hidden = state !== "failed";
	};

	let busy = false;
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) load();
		},
		{ rootMargin: "0px 0px 100% 0px" },
	);
	signal.addEventListener("abort", () => observer.disconnect());
	/** Observing afresh reports whether the end is still in reach. */
	const watch = () => {
		observer.unobserve(more);
		if (list.dataset.more) observer.observe(more);
	};

	/** Appends the next batch, or `limit` rides; `false` once it reloads. */
	async function load(limit) {
		const url = list.dataset.more;
		if (busy || !url) return true;
		busy = true;
		setState("loading");
		list.setAttribute("aria-busy", "true");
		try {
			const res = await fetch(limit ? `${url}&limit=${limit}` : url, {
				credentials: "same-origin",
				cache: "no-store",
			});
			// Signed out, the consent gate or the waiting state: the page shows it.
			if ([401, 403, 409].includes(res.status)) {
				startLoading();
				location.reload();
				return false;
			}
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const parser = new DOMParser();
			const doc = parser.parseFromString(await res.text(), "text/html");
			const batch = doc.querySelector("ol.ride-list");
			if (!batch) throw new Error("no ride list");
			const next = batch.dataset.more;
			list.append(...batch.children);
			if (next) list.dataset.more = next;
			else list.removeAttribute("data-more");
			setState("added");
		} catch {
			// Offline or a bad answer: retry, back online or at the end again.
			setState("failed");
			return true;
		} finally {
			busy = false;
			list.removeAttribute("aria-busy");
		}
		if (list.dataset.more) {
			watch();
		} else {
			observer.disconnect();
			more.hidden = true;
		}
		return true;
	}

	retry.addEventListener("click", () => load());
	addEventListener(
		"online",
		() => {
			if (more.dataset.state === "failed") load();
		},
		{ signal },
	);

	addEventListener(
		"pagehide",
		() => {
			const bar = document.querySelector("header.top-bar");
			const top = bar ? bar.getBoundingClientRect().bottom : 0;
			const all = cards();
			const anchor = all.find(
				(card) => card.getBoundingClientRect().bottom > top,
			);
			try {
				sessionStorage.setItem(
					RIDES_PLACE,
					JSON.stringify({
						url: location.pathname + location.search,
						loaded: all.length,
						anchor: anchor ? rideOf(anchor) : null,
						offset: anchor ? anchor.getBoundingClientRect().top : 0,
						y: scrollY,
					}),
				);
			} catch {}
		},
		{ signal },
	);

	/** After a reload or the back button: the rides and the ride in view. */
	async function restore() {
		let place = null;
		try {
			place = JSON.parse(sessionStorage.getItem(RIDES_PLACE) ?? "null");
			sessionStorage.removeItem(RIDES_PLACE);
		} catch {
			return true;
		}
		const type = performance.getEntriesByType?.("navigation")[0]?.type;
		if (!place || place.url !== location.pathname + location.search) {
			return true;
		}
		if (type !== "reload" && type !== "back_forward") return true;
		const missing = Number(place.loaded) - cards().length;
		if (Number.isInteger(missing) && missing > 0) {
			if (!(await load(Math.min(missing, MAX_RIDE_BATCH)))) return false;
		}
		const anchor = cards().find((card) => rideOf(card) === place.anchor);
		if (anchor) {
			const offset = Number(place.offset) || 0;
			scrollTo(0, anchor.getBoundingClientRect().top + scrollY - offset);
		} else if (Number.isFinite(place.y)) {
			scrollTo(0, place.y);
		}
		return true;
	}

	more.hidden = !list.dataset.more;
	restore().then((going) => {
		if (going) watch();
	});
}

/** The Material buttons that show press feedback (issue #107). */
const PRESSABLE =
	".button,.button-outlined,.button-text,.danger,.segmented,.segmented-group label,.icon-button";

/**
 * A ripple from the point of the tap on a Material button (issue #107). Without
 * it, or with reduced motion, the stylesheet's flat pressed layer shows instead:
 * the `ripples` class on the root switches that layer off.
 */
function pressFeedback() {
	// Safari on iOS applies :active on touch only once a touch listener exists.
	document.addEventListener("touchstart", () => {}, { passive: true });
	if (
		matchMedia("(prefers-reduced-motion: reduce)").matches ||
		typeof Element.prototype.animate !== "function"
	) {
		return;
	}
	document.documentElement.classList.add("ripples");
	document.addEventListener("pointerdown", (event) => {
		if (!event.isPrimary || event.button !== 0) return;
		const target =
			event.target instanceof Element ? event.target.closest(PRESSABLE) : null;
		if (!target || target.getAttribute("aria-busy") === "true") return;
		const box = target.getBoundingClientRect();
		const x = event.clientX - box.left;
		const y = event.clientY - box.top;
		const radius = Math.hypot(
			Math.max(x, box.width - x),
			Math.max(y, box.height - y),
		);
		const ripple = document.createElement("span");
		ripple.className = "ripple";
		ripple.setAttribute("aria-hidden", "true");
		ripple.style.left = `${x - radius}px`;
		ripple.style.top = `${y - radius}px`;
		ripple.style.width = ripple.style.height = `${radius * 2}px`;
		target.append(ripple);
		const grow = ripple.animate(
			[{ transform: "scale(0)" }, { transform: "scale(1)" }],
			{ duration: 300, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
		);
		const ends = ["pointerup", "pointercancel", "pointerleave"];
		const release = () => {
			for (const type of ends) target.removeEventListener(type, release);
			grow.finished
				.then(
					() =>
						ripple.animate([{ opacity: 0 }], {
							duration: 150,
							fill: "forwards",
						}).finished,
				)
				.catch(() => {})
				.finally(() => ripple.remove());
		};
		for (const type of ends) target.addEventListener(type, release);
	});
}

/**
 * Marks the button that sent a form as busy until the next page arrives, and
 * ignores a second submit meanwhile (issue #107). The button stays enabled: a
 * disabled submitter drops its name and value from the form data, which the
 * language buttons need. A page restored from the back-forward cache starts
 * idle again.
 */
function pendingSubmit() {
	document.addEventListener("submit", (event) => {
		const form = event.target;
		if (event.defaultPrevented || !(form instanceof HTMLFormElement)) return;
		if (form.dataset.submitting === "true") {
			event.preventDefault();
			return;
		}
		form.dataset.submitting = "true";
		const button =
			event.submitter ?? form.querySelector("button:not([type=button])");
		button?.setAttribute("aria-busy", "true");
	});
	window.addEventListener("pageshow", (event) => {
		if (!event.persisted) return;
		for (const form of document.querySelectorAll("form[data-submitting]")) {
			delete form.dataset.submitting;
		}
		for (const button of document.querySelectorAll("[aria-busy=true]")) {
			button.removeAttribute("aria-busy");
		}
	});
}

/**
 * A badge's large view also opens while a mouse rests on the badge (feature
 * 013 research R19); tap, click and keyboard stay the popover's own. A click
 * on a badge the hover opened keeps it open instead of toggling it shut.
 */
function badgeHover() {
	if (!("showPopover" in HTMLElement.prototype)) return;
	for (const button of document.querySelectorAll(
		"button.badge[popovertarget]",
	)) {
		const large = document.getElementById(button.getAttribute("popovertarget"));
		if (!large) continue;
		// While hover holds the large view open it floats beside the mouse
		// and follows it, lets the pointer through to the badge, and hides
		// its close button: leaving the badge closes it.
		let byHover = false;
		const hover = (on) => {
			byHover = on;
			large.classList.toggle("badge-large-hover", on);
			if (!on) large.style.removeProperty("left");
			if (!on) large.style.removeProperty("top");
		};
		const follow = (event) => {
			if (event.pointerType !== "mouse" || !byHover) return;
			const gap = 16;
			const { width, height } = large.getBoundingClientRect();
			let left = event.clientX + gap;
			if (left + width > innerWidth - gap) left = event.clientX - gap - width;
			let top = event.clientY + gap;
			if (top + height > innerHeight - gap) top = innerHeight - gap - height;
			large.style.left = `${Math.max(gap, left)}px`;
			large.style.top = `${Math.max(gap, top)}px`;
		};
		button.addEventListener("pointerenter", (event) => {
			if (event.pointerType !== "mouse" || large.matches(":popover-open"))
				return;
			hover(true);
			large.showPopover();
			follow(event);
		});
		button.addEventListener("pointermove", follow);
		button.addEventListener("pointerleave", (event) => {
			if (event.pointerType !== "mouse" || !byHover) return;
			hover(false);
			if (large.matches(":popover-open")) large.hidePopover();
		});
		large.addEventListener("toggle", (event) => {
			if (event.newState === "closed") hover(false);
		});
		button.addEventListener("click", (event) => {
			if (!byHover) return;
			hover(false);
			event.preventDefault();
		});
	}
}

/**
 * The event page's open requests (feature 019 research R5): each rider's box
 * cycles grey, ticked, empty and grey again, its hidden `decide-{id}` field
 * keeps the choice for saving, and the tag beside it says what saving will do.
 */
function triState() {
	const form = document.querySelector("form.attendance-form");
	if (!form) return;
	const toggles = [...form.querySelectorAll(".tri-toggle")];
	if (toggles.length === 0) return;
	const order = ["open", "yes", "no"];
	const checked = { open: "mixed", yes: "true", no: "false" };
	const fieldOf = (toggle) =>
		toggle.parentElement.querySelector("input[name^=decide-]");
	const summary = form.querySelector(".tri-summary");
	const update = () => {
		if (!summary) return;
		const counts = { open: 0, yes: 0, no: 0 };
		for (const toggle of toggles) counts[fieldOf(toggle).value] += 1;
		summary.textContent = summary.dataset.text
			.replace("{yes}", counts.yes)
			.replace("{no}", counts.no)
			.replace("{open}", counts.open);
	};
	const choose = (toggle, value) => {
		fieldOf(toggle).value = value;
		toggle.setAttribute("aria-checked", checked[value]);
		toggle.dataset.state = value;
		for (const tag of toggle.parentElement.querySelectorAll(".tri-tag")) {
			tag.hidden = !tag.classList.contains(`tri-tag-${value}`);
		}
		update();
	};
	for (const toggle of toggles) {
		toggle.addEventListener("click", () => {
			const value = fieldOf(toggle).value;
			choose(toggle, order[(order.indexOf(value) + 1) % order.length]);
		});
	}
	form.querySelector(".confirm-all")?.addEventListener("click", () => {
		for (const toggle of toggles) {
			if (fieldOf(toggle).value === "open") choose(toggle, "yes");
		}
	});
}

/**
 * The badges page's switch (feature 013 Part I): "Deine" and "Team" link to
 * their groups, and the one whose group fills the screen below the switch is
 * marked while scrolling either way; at the bottom of the page the last
 * group, however short. Filtering changes the heights, so it is marked again
 * then.
 */
function badgeSwitch(signal) {
	const bar = document.querySelector(".badges-switch");
	const links = bar
		? [...bar.querySelectorAll('nav a.segmented[href^="#"]')]
		: [];
	const groups = links.map((link) =>
		document.getElementById(link.hash.slice(1)),
	);
	if (links.length === 0 || groups.includes(null)) return;
	let frame = 0;
	const mark = () => {
		frame = 0;
		// A group counts once its top is in the upper third below the switch.
		const below = bar.getBoundingClientRect().bottom;
		const line = below + (innerHeight - below) / 3;
		let current = 0;
		groups.forEach((group, i) => {
			if (group.getBoundingClientRect().top <= line) current = i;
		});
		const bottom = document.documentElement.scrollHeight - innerHeight - 2;
		if (scrollY > 0 && scrollY >= bottom) current = groups.length - 1;
		links.forEach((link, i) => {
			if (i === current) link.setAttribute("aria-current", "true");
			else link.removeAttribute("aria-current");
		});
	};
	const soon = () => {
		if (!frame) frame = requestAnimationFrame(mark);
	};
	addEventListener("scroll", soon, { passive: true, signal });
	addEventListener("resize", soon, { signal });
	bar.addEventListener("change", soon);
	mark();
}

/**
 * The badges page opens on the card of the first new badge, the rider's own
 * before the team's, as the reveal names it (feature 013 Part I), in the
 * middle of the screen, below the sticky switch.
 */
function scrollToNewBadge() {
	const category = document.querySelector(".badges-reveal[data-scroll-to]")
		?.dataset.scrollTo;
	if (!category) return;
	document
		.querySelector(`.badge-card[data-category="${CSS.escape(category)}"]`)
		?.scrollIntoView({ block: "center" });
}

/** The smallest stretch a chart zooms to, in days (feature 009 FR-023). */
const PROGRESS_MIN_DAYS = 7;

/** How far a finger or a shift-dragged mouse moves before the period follows. */
const PROGRESS_PAN_SLOP = 8;

/**
 * The Overview's progress charts (feature 009 contracts/client.md): Chart.js
 * draws the server's figures on the two canvases, both always on one period.
 * The zoom plugin gives mouse drag, the focused wheel and the limits; pinch
 * and a sideways drag come from Pointer Events here, so Hammer.js is never
 * needed. Every word comes from the section's templates; this only fills in
 * dates and numbers. Nothing is fetched or kept.
 */
function progressCharts(signal) {
	const section = document.getElementById("progress");
	const source = document.getElementById("progress-data");
	if (!section || !source) return;
	if (!window.Chart || !window.ChartZoom) {
		console.error("The chart library is missing");
		return;
	}
	let data;
	try {
		data = JSON.parse(source.textContent);
	} catch (error) {
		console.error("Unreadable progress data", error);
		return;
	}
	const { Chart, ChartZoom } = window;
	Chart.register(ChartZoom);
	const { axisDays, lastIndex } = data;
	const locale = section.dataset.locale;
	const [year, month, day] = data.seasonStart.split("-").map(Number);
	const dateOf = (index) => new Date(Date.UTC(year, month - 1, day + index));
	const shortDate = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		day: "numeric",
		month: "short",
	});
	const monthName = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		month: "short",
	});
	const fullDate = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
	const longDate = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
	const paceAt = (threshold, index) =>
		Math.min(
			threshold,
			Math.max(0, Math.floor((threshold * index) / axisDays)),
		);
	const clampDay = (index) => Math.min(lastIndex, Math.max(0, index));

	/** The colours and type of the scheme shown now (research R12). */
	const look = () => {
		const style = getComputedStyle(section);
		const token = (name) => style.getPropertyValue(name).trim();
		return {
			font: style.fontFamily,
			training: token("--rp-line-training"),
			team: token("--rp-line-team"),
			outside: token("--rp-line-outside"),
			threshold: token("--rp-line-threshold"),
			pace: token("--rp-line-pace"),
			muted: token("--md-sys-color-on-surface-variant"),
			grid: token("--md-sys-color-outline-variant"),
			surface: token("--md-sys-color-surface"),
		};
	};

	/** The labels on the time axis for the stretch shown (research R10). */
	function dayTicks(scale) {
		const from = Math.ceil(scale.min);
		const to = Math.floor(scale.max);
		const span = scale.max - scale.min;
		const ticks = [];
		for (let i = from; i <= to; i++) {
			const date = dateOf(i);
			if (
				span > 62
					? date.getUTCDate() === 1
					: span >= 15
						? date.getUTCDay() === 1
						: (i - from) % 2 === 0
			) {
				ticks.push({ value: i });
			}
		}
		scale.ticks = ticks;
	}

	/** The hairline at the selected day (dataviz: thin, behind nothing). */
	const crosshair = {
		id: "progressCrosshair",
		afterDatasetsDraw(chart) {
			const x = chart.scales.x.getPixelForValue(selected);
			const { top, bottom, left, right } = chart.chartArea;
			if (x < left || x > right) return;
			const { ctx } = chart;
			ctx.save();
			ctx.strokeStyle = colours.muted;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(Math.round(x) + 0.5, top);
			ctx.lineTo(Math.round(x) + 0.5, bottom);
			ctx.stroke();
			ctx.restore();
		},
	};

	let colours = look();
	let selected = lastIndex;
	let syncing = false;
	const charts = [];

	/** The datasets of one chart; curves first, as the selection marks them. */
	function datasets(kind) {
		const series = data[kind];
		const line = (to, colour, threshold) => ({
			data: [
				{ x: 0, y: to === "pace" ? 0 : threshold },
				{ x: axisDays, y: threshold },
			],
			borderColor: colour,
			borderWidth: 1.5,
			pointRadius: 0,
			pointHoverRadius: 0,
		});
		const curve = (values, colour) => ({
			data: values.map((y, x) => ({ x, y })),
			// Training's many small days read best as a smooth rise; a monotone
			// curve never dips or overshoots the total. Team's few big days rise
			// straight up on their day.
			...(kind === "team"
				? { stepped: "before" }
				: { cubicInterpolationMode: "monotone" }),
			borderColor: colour,
			borderWidth: 3,
			pointRadius: 0,
			pointHoverRadius: 4,
			pointHoverBorderWidth: 2,
			pointHoverBorderColor: colours.surface,
			pointHoverBackgroundColor: colour,
		});
		const sets = [curve(series.values, colours[kind])];
		const outside = kind === "training" ? data.outside : null;
		if (outside) {
			sets.push(curve(outside.values, colours.outside));
		}
		sets.push(line("threshold", colours.threshold, series.threshold));
		if (series.pace) {
			sets.push(line("pace", colours.pace, series.threshold));
		}
		if (outside) {
			sets.push(line("threshold", colours.outside, outside.threshold));
			if (outside.pace) {
				sets.push(line("pace", colours.pace, outside.threshold));
			}
		}
		return sets;
	}

	/** How many of a chart's first datasets are curves. */
	const curves = (kind) => (kind === "training" && data.outside ? 2 : 1);

	function makeChart(canvas) {
		const kind = canvas.dataset.series;
		const font = { family: colours.font, size: 12 };
		return new Chart(canvas, {
			type: "line",
			data: { datasets: datasets(kind) },
			plugins: [crosshair],
			options: {
				animation: false,
				responsive: true,
				maintainAspectRatio: false,
				// The selection is ours (pointer and keys), not Chart.js's hover.
				events: [],
				interaction: { mode: "index", intersect: false, axis: "x" },
				normalized: true,
				elements: { line: { tension: 0 } },
				scales: {
					x: {
						type: "linear",
						min: 0,
						max: axisDays,
						afterBuildTicks: dayTicks,
						grid: { color: colours.grid },
						border: { color: colours.grid },
						ticks: {
							color: colours.muted,
							font,
							maxRotation: 0,
							autoSkip: true,
							callback(value) {
								const span = this.max - this.min;
								return (span > 62 ? monthName : shortDate).format(
									dateOf(value),
								);
							},
						},
					},
					y: {
						min: 0,
						max: data[kind].yMax,
						grid: { color: colours.grid },
						border: { color: colours.grid },
						ticks: {
							color: colours.muted,
							font,
							precision: 0,
							callback: (value) => number.format(value),
						},
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: { enabled: false },
					zoom: {
						limits: {
							x: { min: 0, max: axisDays, minRange: PROGRESS_MIN_DAYS },
						},
						pan: {
							// Only so a shift-drag isn't a drag-zoom; our handler pans.
							enabled: true,
							mode: "x",
							modifierKey: "shift",
							onPan: ({ chart }) => follow(chart),
						},
						zoom: {
							mode: "x",
							wheel: { enabled: true },
							drag: { enabled: true, threshold: PROGRESS_PAN_SLOP },
							pinch: { enabled: false },
							// The wheel zooms a chart with focus; otherwise it scrolls.
							onZoomStart: ({ chart, event }) =>
								event.type !== "wheel" ||
								document.activeElement === chart.canvas,
							onZoom: ({ chart }) => follow(chart),
						},
					},
				},
			},
		});
	}

	/** Puts the other charts on `chart`'s period. */
	function follow(chart) {
		if (syncing) return;
		const { min, max } = chart.scales.x;
		setPeriod(min, max, chart);
	}

	/** Shows `from` … `to` (day indexes) in every chart but `except`. */
	function setPeriod(from, to, except) {
		syncing = true;
		try {
			for (const chart of charts) {
				if (chart !== except) {
					chart.zoomScale("x", { min: from, max: to }, "none");
				}
			}
		} finally {
			syncing = false;
		}
		periodShown(from, to);
	}

	function resetPeriod() {
		syncing = true;
		try {
			for (const chart of charts) chart.resetZoom("none");
		} finally {
			syncing = false;
		}
		periodShown(0, axisDays);
	}

	/** Buttons and labels after the period changed (contracts/client.md). */
	function periodShown(from, to) {
		const near = (a, b) => Math.abs(a - b) < 0.5;
		for (const button of section.querySelectorAll("button[data-from]")) {
			const pressed =
				near(Number(button.dataset.from), from) &&
				near(Number(button.dataset.to), to);
			button.setAttribute("aria-pressed", String(pressed));
		}
		const first = Math.max(0, Math.round(from));
		const last = Math.min(axisDays, Math.round(to));
		for (const chart of charts) {
			const kind = chart.canvas.dataset.series;
			const template = section.querySelector(`template[data-label="${kind}"]`);
			if (!template) continue;
			const label = fill(template, {
				from: fullDate.format(dateOf(first)),
				to: fullDate.format(dateOf(last)),
				value: number.format(data[kind].values[clampDay(last)] ?? 0),
				threshold: number.format(data[kind].threshold),
			});
			chart.canvas.setAttribute("aria-label", label.textContent);
		}
	}

	/** A copy of `template`'s content with its slots filled in. */
	function fill(template, values) {
		const content = template.content.cloneNode(true);
		for (const slot of content.querySelectorAll("[data-slot]")) {
			slot.textContent = values[slot.dataset.slot] ?? "";
		}
		return content;
	}

	const readout = section.querySelector(".progress-readout");

	/** The selected day's figures, line by line (research R9). */
	function readoutOf(index) {
		const template = (readout, series) =>
			section.querySelector(
				series
					? `template[data-readout="${readout}"][data-series="${series}"]`
					: `template[data-readout="${readout}"]`,
			);
		const lines = [];
		const day = template("day");
		if (day) {
			lines.push([
				fill(day, {
					date: longDate.format(dateOf(index)),
					training: number.format(data.training.values[index]),
					team: number.format(data.team.values[index]),
				}),
			]);
		}
		for (const series of ["training", "team", "outside"]) {
			const line = data[series];
			if (!line?.pace) continue;
			const value = line.values[index];
			const pace = paceAt(line.threshold, index);
			const part = template(
				value > pace ? "pace-ahead" : value < pace ? "pace-behind" : "pace-on",
				series,
			);
			if (!part) continue;
			const parts = [
				fill(part, {
					n: number.format(Math.abs(value - pace)),
					pace: number.format(pace),
				}),
			];
			const outside = template("outside");
			if (series === "training" && data.outside && outside) {
				parts.push(
					fill(outside, { value: number.format(data.outside.values[index]) }),
				);
			}
			lines.push(parts);
		}
		readout?.replaceChildren(
			...lines.map((parts) => {
				const line = document.createElement("span");
				line.className = "progress-readout-line";
				line.append(...parts);
				return line;
			}),
		);
	}

	/** Selects `index` in every chart and says so in the readout. */
	function select(index) {
		selected = clampDay(index);
		for (const chart of charts) {
			const n = curves(chart.canvas.dataset.series);
			chart.setActiveElements(
				Array.from({ length: n }, (_, datasetIndex) => ({
					datasetIndex,
					index: selected,
				})),
			);
			chart.update("none");
		}
		readoutOf(selected);
	}

	/** The day under `clientX` on `chart`. */
	const dayAt = (chart, clientX) =>
		Math.round(
			chart.scales.x.getValueForPixel(
				clientX - chart.canvas.getBoundingClientRect().left,
			),
		);

	/** Moves the period by half its width: -1 earlier, 1 later. */
	function move(direction) {
		const [chart] = charts;
		if (!chart) return;
		const { left, right } = chart.chartArea;
		chart.pan({ x: (-direction * (right - left)) / 2 }, undefined, "none");
	}

	/** Pinch and a sideways drag (contracts/client.md "Gestures"). */
	function gestures(chart) {
		const canvas = chart.canvas;
		const pointers = new Map();
		let moved = false;
		let panning = false;
		let spread = 0;
		const local = (event) => {
			const rect = canvas.getBoundingClientRect();
			return { x: event.clientX - rect.left, y: event.clientY - rect.top };
		};
		const distance = () => {
			const [a, b] = [...pointers.values()];
			return Math.hypot(a.x - b.x, a.y - b.y);
		};
		canvas.addEventListener(
			"pointerdown",
			(event) => {
				const mouse = event.pointerType === "mouse";
				if (mouse && !(event.button === 0 && event.shiftKey)) return;
				pointers.set(event.pointerId, {
					...local(event),
					startX: event.clientX,
				});
				try {
					canvas.setPointerCapture(event.pointerId);
				} catch {
					// A pointer the browser no longer tracks can't be captured.
				}
				if (pointers.size === 2) spread = distance();
				moved = false;
				panning = false;
			},
			{ signal },
		);
		canvas.addEventListener(
			"pointermove",
			(event) => {
				const pointer = pointers.get(event.pointerId);
				if (!pointer) {
					// A mouse over the chart selects the day under it.
					if (event.pointerType === "mouse" && event.buttons === 0) {
						select(dayAt(chart, event.clientX));
					}
					return;
				}
				const at = local(event);
				if (pointers.size === 2) {
					pointer.x = at.x;
					pointer.y = at.y;
					const now = distance();
					if (spread > 0 && now > 0) {
						const [a, b] = [...pointers.values()];
						chart.zoom(
							{
								x: now / spread,
								focalPoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
							},
							"none",
						);
						moved = true;
					}
					spread = now;
					return;
				}
				if (
					!panning &&
					Math.abs(event.clientX - pointer.startX) < PROGRESS_PAN_SLOP
				) {
					return;
				}
				const dx = at.x - pointer.x;
				pointer.x = at.x;
				pointer.y = at.y;
				if (!panning) {
					panning = true;
					return;
				}
				if (dx !== 0) chart.pan({ x: dx }, undefined, "none");
				moved = true;
			},
			{ signal },
		);
		const end = (event) => {
			if (!pointers.has(event.pointerId)) return;
			pointers.delete(event.pointerId);
			// A tap selects the day, as a click does.
			if (
				event.type === "pointerup" &&
				!moved &&
				!panning &&
				pointers.size === 0
			) {
				select(dayAt(chart, event.clientX));
			}
			if (pointers.size < 2) spread = 0;
			if (pointers.size === 0) {
				if (moved) follow(chart);
				moved = false;
				panning = false;
			}
		};
		canvas.addEventListener("pointerup", end, { signal });
		canvas.addEventListener("pointercancel", end, { signal });
		// A mouse click without a drag selects the day.
		canvas.addEventListener(
			"click",
			(event) => {
				if (!event.shiftKey) select(dayAt(chart, event.clientX));
			},
			{ signal },
		);
	}

	/** The keys of research R7 on a focused chart. */
	function keys(chart) {
		chart.canvas.addEventListener(
			"keydown",
			(event) => {
				if (event.altKey || event.ctrlKey || event.metaKey) return;
				const zoomBy = (factor) => {
					const { top, bottom } = chart.chartArea;
					chart.zoom(
						{
							x: factor,
							focalPoint: {
								x: chart.scales.x.getPixelForValue(selected),
								y: (top + bottom) / 2,
							},
						},
						"none",
					);
				};
				switch (event.key) {
					case "ArrowLeft":
						select(selected - 1);
						break;
					case "ArrowRight":
						select(selected + 1);
						break;
					case "Home":
						select(0);
						break;
					case "End":
						select(lastIndex);
						break;
					case "+":
					case "=":
						zoomBy(1.5);
						break;
					case "-":
						zoomBy(1 / 1.5);
						break;
					case "PageUp":
						move(-1);
						break;
					case "PageDown":
						move(1);
						break;
					case "0":
					case "Escape":
						resetPeriod();
						break;
					default:
						return;
				}
				event.preventDefault();
			},
			{ signal },
		);
	}

	/** The scheme changed: the lines take its colours (research R12). */
	function recolour() {
		colours = look();
		for (const chart of charts) {
			const kind = chart.canvas.dataset.series;
			const { min, max } = chart.scales.x;
			chart.data.datasets = datasets(kind);
			for (const axis of ["x", "y"]) {
				const scale = chart.options.scales[axis];
				scale.grid.color = colours.grid;
				scale.border.color = colours.grid;
				scale.ticks.color = colours.muted;
			}
			chart.options.scales.x.min = min;
			chart.options.scales.x.max = max;
			chart.update("none");
		}
		select(selected);
	}

	for (const canvas of section.querySelectorAll("canvas[data-series]")) {
		const chart = makeChart(canvas);
		charts.push(chart);
		gestures(chart);
		keys(chart);
	}
	section.addEventListener(
		"click",
		(event) => {
			const button =
				event.target instanceof Element ? event.target.closest("button") : null;
			if (!button || !section.contains(button)) return;
			if (button.dataset.from !== undefined) {
				setPeriod(Number(button.dataset.from), Number(button.dataset.to));
			}
		},
		{ signal },
	);
	matchMedia("(prefers-color-scheme: dark)").addEventListener(
		"change",
		recolour,
		{ signal },
	);
	const scheme = new MutationObserver(recolour);
	scheme.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-scheme", "data-theme"],
	});
	signal.addEventListener("abort", () => {
		scheme.disconnect();
		for (const chart of charts) chart.destroy();
	});
	select(lastIndex);
}

/**
 * What the page's content needs: run on load and again on content swapped in
 * place (`swapPage`), whose `signal` ends the listeners of the content before.
 */
function enhance(signal) {
	lazyRides(signal);
	installSettings(signal);
	waitForFirstData(signal);
	badgeHover();
	triState();
	badgeSwitch(signal);
	notifications(signal).catch(() => {});
	progressCharts(signal);
}

const registered = registerWorker();
swapViews();
pressFeedback();
pendingSubmit();
appPrompt();
themeMenu();
refreshOnReturn();
pageLoading();
enhance(content.signal);
scrollToNewBadge();
