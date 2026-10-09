// RynkePoints page script (feature 010 contracts/client.md, research R16). It
// only wires up what a server-rendered page can't do itself: the service worker,
// the install group and the app prompt, the notifications switch, the scheme picker and reloading
// a section on return. It holds no text: every word shown comes from the page's markup,
// rendered from the catalogs and hidden until this shows it.

function registerWorker() {
	if (!("serviceWorker" in navigator)) return;
	const lang = encodeURIComponent(document.documentElement.lang);
	navigator.serviceWorker
		.register(`/sw.js?lang=${lang}`, { scope: "/" })
		.catch(() => {});
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

/** Shows the browser's install prompt once; the event can't be reused. */
function promptInstall() {
	installEvent?.prompt();
	installEvent = null;
}

/**
 * The App group in Settings (FR-004, 015 FR-011, research R11): it shows where
 * installing helps, has no dismiss, and ignores the app prompt's answers.
 */
function installSettings() {
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
	installable.push(showPrompt);
	if (installEvent) showPrompt();
	prompt.querySelector("button").addEventListener("click", () => {
		setShown(false);
		promptInstall();
	});

	// Only Safari on iOS defines it, and false means "not on the home screen".
	if (navigator.standalone === false) {
		hint.querySelector('[data-install="ios"]').hidden = false;
		setShown(true);
	}

	window.addEventListener("appinstalled", () => {
		setShown(false);
	});
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
async function notifications() {
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
	const { pushManager } = await navigator.serviceWorker.ready;
	let subscription = await pushManager.getSubscription();
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
	document.addEventListener(PUSH_CHANGED, async () => {
		subscription = await pushManager.getSubscription();
		if (subscription) setSignOutEndpoint(subscription.endpoint);
		await sync();
	});
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
			Notification.permission !== "default"
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
		// Only Safari on iOS defines it, and false means "not on the home screen".
		if (navigator.standalone === false) showInstall("ios");
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

/** The `surface` colour of each scheme, as in the head script (research R12). */
const THEME_COLOR = { light: "#fffdf5", dark: "#12110c" };

/**
 * The Appearance group in Settings (FR-032a): System, Light or Dark for this
 * device only. It applies the choice the way the head script does on load.
 */
function schemePicker() {
	const radios = document.querySelectorAll("input[name=scheme]");
	if (radios.length === 0) return;
	const KEY = "rp-scheme";
	let stored = null;
	try {
		stored = localStorage.getItem(KEY);
	} catch {}
	const current = stored === "light" || stored === "dark" ? stored : "system";
	for (const radio of radios) {
		radio.checked = radio.value === current;
		radio.addEventListener("change", () => {
			const scheme = radio.value;
			try {
				if (scheme === "system") localStorage.removeItem(KEY);
				else localStorage.setItem(KEY, scheme);
			} catch {}
			const metas = document.querySelectorAll('meta[name="theme-color"]');
			if (scheme === "system") {
				delete document.documentElement.dataset.scheme;
				// Back to one colour per system setting, as the page is served.
				for (const [i, m] of [...metas].entries()) {
					const s = i === 0 ? "light" : "dark";
					m.media = `(prefers-color-scheme: ${s})`;
					m.content = THEME_COLOR[s];
				}
			} else {
				document.documentElement.dataset.scheme = scheme;
				for (const m of metas) {
					m.removeAttribute("media");
					m.content = THEME_COLOR[scheme];
				}
			}
		});
	}
}

/**
 * A section brought back after more than a minute in the background reloads,
 * so its figures are current (feature 011 FR-009, research R8). Public pages
 * have no `nav.app-nav` and keep what the rider typed.
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
			location.reload();
		}
	});
}

/**
 * The waiting state before the first data (015 contracts/client.md): asks
 * /me/ready every data-poll-seconds while the page is visible, and reloads once
 * the first balance is there. A 401, a network error or "not yet" just waits
 * for the next tick.
 */
function waitForFirstData() {
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
				location.reload();
			}
		} catch {
			// Offline or a bad answer: try again on the next tick.
		}
	}, seconds * 1000);
}

registerWorker();
installSettings();
appPrompt();
schemePicker();
refreshOnReturn();
waitForFirstData();
notifications().catch(() => {});
