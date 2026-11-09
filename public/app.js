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
			preloadShow(theme);
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
 * The link a plain left click follows to another page of ours, with its
 * address; null for a click with a modifier, a link to another site, a new
 * tab, a download, a file or a spot on this page.
 */
function linkToOurPage(event) {
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	) {
		return null;
	}
	const link =
		event.target instanceof Element ? event.target.closest("a[href]") : null;
	if (
		!(link instanceof HTMLAnchorElement) ||
		link.hasAttribute("download") ||
		(link.target !== "" && link.target !== "_self")
	) {
		return null;
	}
	const url = new URL(link.href);
	const samePage =
		url.pathname === location.pathname && url.search === location.search;
	if (
		url.origin !== location.origin ||
		(samePage && url.hash !== "") ||
		/\.[a-z0-9]+$/i.test(url.pathname)
	) {
		return null;
	}
	return { link, url, samePage };
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
		if (linkToOurPage(event)) startLoading();
	});
	document.addEventListener("submit", (event) => {
		if (!event.defaultPrevented) startLoading();
	});
	window.addEventListener("pageshow", stopLoading);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") stopLoading();
	});
}

/** The page-switch show's length (022). */
const SHOW_MS = 2700;
/** The show's peak: the old section goes, unseen under the full cover. */
const SHOW_HIDE_MS = 1350;
/**
 * The next section swaps in, still hidden: Disco half a second before the
 * show's end, where the show is nearly gone; Konfetti while the rainbow still
 * covers, just before it clears the view.
 */
const SHOW_SWAP_MS = { confetti: 1650, disco: 2200 };
/** Konfetti: the section fades in as the rainbow starts clearing the view. */
const SHOW_IN_MS = 1815;
const SECTION_FADE_MS = 300;
/** Disco: the section fades in as the room fades out, its last 40 %. */
const SHOW_ROOM_OUT = 0.6;
/** Reduced motion: a fade to the surface instead. */
const FADE_MS = 250;
/** The Konfetti rain: as many coins as confetti pieces, in turn. */
const SHOW_CONFETTI = 110;
const SHOW_COINS = SHOW_CONFETTI;
const SHOW_SPOTS = 34;
/** The turning coin's rim, one disc per pixel of its thickness. */
const SHOW_COIN_LAYERS = 26;
/** "off" turns the shows off on this device (Settings). */
const SHOWS_KEY = "rp-shows";
const FUN_THEMES = new Set(["confetti", "disco"]);

/** The canvas's fixed sequence, so every show rains the same way. */
function seeded(n) {
	const x = Math.sin(n * 9301 + 49297) * 233280;
	return x - Math.floor(x);
}

/** The show's pictures, as the page's theme menu names them (FR-049). */
function showPictures() {
	const data = document.getElementById("theme-menu")?.dataset ?? {};
	return {
		coin: data.showCoin,
		coinBack: data.showCoinBack,
		unicorn: data.showUnicorn,
		disco: data.showDisco,
	};
}

/** Loads the theme's show pictures ahead, so the first show doesn't wait. */
function preloadShow(theme) {
	const pictures = showPictures();
	const urls =
		theme === "confetti"
			? [pictures.coin, pictures.coinBack, pictures.unicorn]
			: theme === "disco"
				? [pictures.disco]
				: [];
	for (const url of urls) {
		if (url) new Image().src = url;
	}
}

function showPart(parent, className, style = {}) {
	const part = document.createElement("div");
	part.className = className;
	for (const [name, value] of Object.entries(style)) {
		part.style.setProperty(name, value);
	}
	parent.append(part);
	return part;
}

function showPicture(parent, src) {
	const img = document.createElement("img");
	img.src = src;
	img.alt = "";
	parent.append(img);
}

/**
 * The overlay of one show (contracts/page-switch-show.md): Konfetti's rainbow,
 * coin and rain, or Disco's room, beams, ball and spots, with Rynke once the
 * picture is built; under reduced motion a fade of the surface. Hidden from
 * screen readers, nothing in it takes focus (FR-046).
 */
function buildShow(theme, reduced) {
	const show = document.createElement("div");
	show.className = `show show-${theme}`;
	show.setAttribute("aria-hidden", "true");
	if (reduced) {
		showPart(show, "show-fade");
		return show;
	}
	const pictures = showPictures();
	if (theme === "confetti") {
		showPart(show, "show-rainbow");
		if (pictures.unicorn) {
			showPicture(showPart(show, "show-unicorn"), pictures.unicorn);
		}
		if (pictures.coin) {
			// Both sides, back to back, with a stack of discs between them as
			// the rim, so the turning coin has depth seen edge on.
			const turn = showPart(showPart(show, "show-pop"), "show-pop-turn");
			for (let i = 0; i < SHOW_COIN_LAYERS; i++) {
				const z = i - (SHOW_COIN_LAYERS - 1) / 2;
				showPart(turn, "show-pop-edge", { "--z": z });
			}
			showPicture(turn, pictures.coin);
			turn.lastChild.className = "show-pop-front";
			if (pictures.coinBack) {
				showPicture(turn, pictures.coinBack);
				turn.lastChild.className = "show-pop-back";
			}
		}
		for (let i = 0; i < SHOW_CONFETTI + SHOW_COINS; i++) {
			const coin = i % 2 === 1;
			const long = seeded(i + 1) > 0.5;
			const kind = coin
				? `coin ${Math.floor(i / 2) % 2 === 0 ? "training" : "team"}`
				: seeded(i + 3) > 0.7
					? "round"
					: "";
			showPart(show, `show-piece ${kind}`.trim(), {
				left: `${Math.round(seeded(i + 2) * 100)}%`,
				width: coin ? "20px" : long ? "7px" : "9px",
				height: coin ? "20px" : long ? "15px" : "9px",
				background: coin ? "" : `var(--rp-show-confetti-${(i % 8) + 1})`,
				"animation-delay": `${(seeded(i + 4) * 1.35).toFixed(2)}s`,
				"animation-duration": `${(1.4 + seeded(i + 5)).toFixed(2)}s`,
				"--sway": `${Math.round((seeded(i + 6) - 0.5) * 160)}px`,
				"--spin": `${Math.round(360 + seeded(i + 7) * 720)}deg`,
			});
		}
		return show;
	}
	showPart(show, "show-room");
	showPart(show, "show-beams");
	for (let j = 0; j < SHOW_SPOTS; j++) {
		showPart(show, "show-spot", {
			left: `${Math.round(seeded(j + 40) * 92)}%`,
			top: `${Math.round(15 + seeded(j + 41) * 80)}%`,
			"--size": `${Math.round(10 + seeded(j + 42) * 22)}px`,
			background: `var(--rp-show-spot-${(j % 6) + 1})`,
			"animation-delay": `0s,${(-seeded(j + 43) * 1.6).toFixed(2)}s`,
			"--dx": `${Math.round((seeded(j + 44) - 0.5) * 220)}px`,
			"--dy": `${Math.round((seeded(j + 45) - 0.5) * 120)}px`,
		});
	}
	if (pictures.disco) {
		showPart(show, "show-floor");
		showPicture(showPart(show, "show-dancer"), pictures.disco);
	}
	showPart(show, "show-wire");
	const ball = showPart(show, "show-ball");
	for (const name of [
		"show-ball-face",
		"show-glint",
		"show-glint",
		"show-glint",
	]) {
		const part = document.createElement("span");
		part.className = name;
		ball.append(part);
	}
	const face = ball.firstElementChild;
	for (const name of ["show-facets", "show-shade"]) {
		const part = document.createElement("span");
		part.className = name;
		face.append(part);
	}
	return show;
}

/**
 * The section's fade in, on the show's clock: with the room under Disco
 * (opacity the reverse of the room's, `show-room` in style.ts), after the
 * rainbow under Konfetti.
 */
function sectionFadeIn(theme) {
	if (theme === "disco") {
		return [
			{ opacity: 0 },
			{ opacity: 0, offset: SHOW_ROOM_OUT, easing: "ease-in-out" },
			{ opacity: 1 },
		];
	}
	return [
		{ opacity: 0 },
		{ opacity: 0, offset: SHOW_IN_MS / SHOW_MS, easing: "ease-out" },
		{ opacity: 1, offset: (SHOW_IN_MS + SECTION_FADE_MS) / SHOW_MS },
		{ opacity: 1 },
	];
}

/**
 * Plays the show over this page while the section at `href` loads in the
 * background. Under the show's peak the page's section goes (`SHOW_HIDE_MS`),
 * shortly before the show clears the view the new one swaps in
 * (`SHOW_SWAP_MS`) and fades in on the show's clock (`sectionFadeIn`): no
 * page load to see. A
 * section not there by then comes in once it is, past the show's end with the
 * progress bar (#108). Anything unexpected (signed out, an error) loads the
 * page the usual way at the show's end. A tap or a key skips the show,
 * straight to the section; the overlay takes the tap so it doesn't also hit a
 * control.
 */
function leaveWithShow(theme, href) {
	const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const show = buildShow(theme, reduced);
	const main = document.querySelector("main");
	// The section's page, null where it can't swap in; undefined while loading.
	let doc;
	let hidden = null;
	let due = false;
	let arrived = false;
	let over = false;
	const arrive = () => {
		if (arrived) return;
		arrived = true;
		if (doc && swapSection(doc, href)) {
			stopLoading();
			if (hidden && !over) {
				// On the show's clock, so a slow swap doesn't put it out of step.
				const clock = show.firstElementChild?.getAnimations()[0]?.startTime;
				const fade = main.animate(sectionFadeIn(theme), {
					duration: SHOW_MS,
					fill: "both",
				});
				fade.startTime = clock ?? begun;
			}
			hidden?.cancel();
			return;
		}
		startLoading();
		location.assign(href);
	};
	const end = () => {
		if (over) return;
		over = true;
		clearTimeout(hide);
		clearTimeout(swap);
		clearTimeout(timer);
		document.removeEventListener("keydown", skip, true);
		show.remove();
		if (doc !== undefined) arrive();
		else startLoading();
	};
	const skip = (event) => {
		if (event.type === "pointerdown") event.preventDefault();
		end();
	};
	fetchSection(href).then((page) => {
		doc = page;
		if (over || due) arrive();
	});
	const hide = setTimeout(() => {
		if (!reduced && main) {
			hidden = main.animate({ opacity: [0, 0] }, { fill: "forwards" });
		}
	}, SHOW_HIDE_MS);
	const swap = setTimeout(
		() => {
			due = true;
			if (doc !== undefined) arrive();
		},
		reduced ? FADE_MS : SHOW_SWAP_MS[theme],
	);
	const timer = setTimeout(end, reduced ? 2 * FADE_MS : SHOW_MS);
	show.addEventListener("pointerdown", skip);
	document.addEventListener("keydown", skip, true);
	const begun = document.timeline.currentTime;
	document.body.append(show);
}

/** The page of the section at `href`, or null where it can't swap in. */
async function fetchSection(href) {
	try {
		const res = await fetch(href, {
			credentials: "same-origin",
			cache: "no-store",
		});
		return await samePage(res, new URL(href).pathname);
	} catch {
		return null;
	}
}

/**
 * Puts the section `doc` in place of this one, as following the link at
 * `href` would: a history entry, the top of the page, and a keyboard user on
 * the section's item in the navigation. `false` where it can't.
 */
function swapSection(doc, href) {
	const inNav = document.activeElement?.closest("nav.app-nav");
	if (!swapPage(doc)) return false;
	history.pushState(null, "", href);
	shownView = viewOf(new URL(href));
	scrollTo(0, 0);
	if (inNav) {
		document
			.querySelector('nav.app-nav a[aria-current="page"]')
			?.focus({ preventScroll: true });
	}
	scrollToNewBadge();
	return true;
}

/**
 * The Settings switch for the page-switch shows on this device (feature 022),
 * on unless turned off; the other animations stay. Hidden where storage
 * refuses.
 */
function showsSetting() {
	const section = document.getElementById("settings-shows");
	const toggle = section?.querySelector("[role=switch]");
	if (!toggle) return;
	try {
		localStorage.getItem(SHOWS_KEY);
	} catch {
		return;
	}
	toggle.setAttribute("aria-checked", String(!showsOff()));
	section.hidden = false;
	toggle.addEventListener("click", () => {
		const off = !showsOff();
		try {
			if (off) localStorage.setItem(SHOWS_KEY, "off");
			else localStorage.removeItem(SHOWS_KEY);
		} catch {
			return;
		}
		toggle.setAttribute("aria-checked", String(!off));
	});
}

/** Whether the rider turned the shows off on this device. */
function showsOff() {
	try {
		return localStorage.getItem(SHOWS_KEY) === "off";
	} catch {
		return false;
	}
}

/**
 * The fun themes' page-switch shows (feature 022 US4, FR-040–FR-049): a
 * plain click on another section's item in the navigation bar plays the show
 * and swaps that section in under it. Settings, links in the pages, reloads, back and
 * forward, forms, a running tour, the other themes and a device with the
 * shows turned off play nothing.
 */
function pageSwitchShows() {
	preloadShow(document.documentElement.dataset.theme);
	document.addEventListener(
		"click",
		(event) => {
			const theme = document.documentElement.dataset.theme;
			if (!FUN_THEMES.has(theme) || document.querySelector(".show")) return;
			const hit = linkToOurPage(event);
			if (
				!hit ||
				hit.samePage ||
				!hit.link.closest("nav.app-nav") ||
				hit.link.getAttribute("aria-current") === "page" ||
				hit.url.pathname === "/me/settings" ||
				// A tour's step is showing: the tour moves on without shows.
				document.querySelector("aside.tour .tour-progress") ||
				showsOff()
			) {
				return;
			}
			event.preventDefault();
			leaveWithShow(theme, hit.url.href);
		},
		true,
	);
	// A page brought back from the back-forward cache drops a leftover show.
	window.addEventListener("pageshow", (event) => {
		if (!event.persisted) return;
		for (const show of document.querySelectorAll(".show")) show.remove();
	});
}

/** How far and how fast a finger moves sideways to swipe (feature 023). */
const SWIPE_PX = 64;
const SWIPE_MS = 800;
/** The screen's edges belong to the system's own back and forward swipes. */
const SWIPE_EDGE_PX = 24;

/**
 * The navigation's sections a swipe rotates through, in its order, and the
 * index of the shown one: all but Settings (feature 023 FR-002). Null on a
 * page outside them.
 */
function swipeRing() {
	const links = [...document.querySelectorAll("nav.app-nav a[href]")].filter(
		(link) => new URL(link.href).pathname !== "/me/settings",
	);
	const at = links.findIndex(
		(link) => link.getAttribute("aria-current") === "page",
	);
	return at < 0 || links.length < 2 ? null : { links, at };
}

/**
 * Whether a touch at `x` on `target` may start a swipe: not near the edges,
 * zoomed in, on a field or chart, on something that scrolls sideways, or while
 * a menu, a dialog, a show or a tour's step is up (FR-004).
 */
function swipeStarts(target, x) {
	if (
		x < SWIPE_EDGE_PX ||
		x > innerWidth - SWIPE_EDGE_PX ||
		(visualViewport?.scale ?? 1) > 1.01 ||
		!(target instanceof Element) ||
		target.closest("input, textarea, select, canvas, [contenteditable]") ||
		document.getElementById("theme-menu")?.hidden === false ||
		document.querySelector("dialog[open], .show, aside.tour .tour-progress")
	) {
		return false;
	}
	for (let el = target; el && el !== document.body; el = el.parentElement) {
		const { overflowX } = getComputedStyle(el);
		if (
			(overflowX === "auto" || overflowX === "scroll") &&
			el.scrollWidth > el.clientWidth
		) {
			return false;
		}
	}
	return true;
}

/**
 * Swiping sideways moves to the neighbouring section of the navigation, round
 * in a circle: a swipe to the left to the next one, to the right to the one
 * before (feature 023). It taps that section's item, so the switch is the
 * same as a tap's, show included. Two fingers, a slow drag, a mostly
 * vertical one or one that selected text move nothing.
 */
function swipeSections() {
	let start = null;
	document.addEventListener(
		"touchstart",
		(event) => {
			const touch = event.touches[0];
			start =
				event.touches.length === 1 &&
				swipeRing() &&
				swipeStarts(event.target, touch.clientX)
					? { x: touch.clientX, y: touch.clientY, at: event.timeStamp }
					: null;
		},
		{ passive: true },
	);
	document.addEventListener("touchcancel", () => {
		start = null;
	});
	document.addEventListener("touchend", (event) => {
		const from = start;
		start = null;
		const touch = event.changedTouches[0];
		const ring = swipeRing();
		if (!from || !touch || !ring || event.touches.length > 0) return;
		const dx = touch.clientX - from.x;
		const dy = touch.clientY - from.y;
		if (
			event.timeStamp - from.at > SWIPE_MS ||
			Math.abs(dx) < SWIPE_PX ||
			Math.abs(dx) < 2 * Math.abs(dy) ||
			getSelection()?.isCollapsed === false
		) {
			return;
		}
		const { links, at } = ring;
		const step = dx < 0 ? 1 : -1;
		links[(at + step + links.length) % links.length].click();
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

/**
 * The line saying how far the rider's activities are (feature 024
 * contracts/http-routes.md): asks /me/fetching every data-poll-seconds while
 * the page is visible and puts the server's text in; once it answers null,
 * brings the page up to date so the new rides show. A 401, a network error or
 * a bad answer just waits for the next tick.
 */
function followFetching(signal) {
	const line = document.querySelector("[data-fetching]");
	const text = line?.querySelector("p");
	if (!line || !text) return;
	const configured = Number(line.dataset.pollSeconds);
	const seconds =
		Number.isInteger(configured) && configured > 0 ? configured : 10;
	const timer = setInterval(async () => {
		if (document.visibilityState !== "visible") return;
		try {
			const res = await fetch("/me/fetching", {
				credentials: "same-origin",
				cache: "no-store",
			});
			if (!res.ok) return;
			const answer = await res.json();
			if (answer.text === null) {
				clearInterval(timer);
				refreshPage();
			} else if (typeof answer.text === "string") {
				text.textContent = answer.text;
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
 * Puts `doc`, this page as the server sends it now or another section
 * (`swapSection`), in place of the shown one: the content, the navigation with
 * its counts, the section's title, the refresh link and a tour's card. The scroll position stays. `false` without content to swap; the caller
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
	for (const selector of [
		"header.top-bar .section-title",
		"header.top-bar a.refresh",
		"nav.app-nav",
	]) {
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

/** The page in `res`, when it is the page at `path` and fine to swap in. */
async function samePage(res, path = location.pathname) {
	if (!res.ok || new URL(res.url).pathname !== path) return null;
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
		const moved =
			new URL(url).pathname !== new URL(shownView, location.origin).pathname;
		if (!swapPage(doc)) {
			location.assign(url);
			return;
		}
		shownView = viewOf(new URL(url));
		// Another section, back or forward: from its top.
		if (moved) scrollTo(0, 0);
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
 * save in place (`sendForm`). Back and forward between those views, and
 * between the sections a show swapped in (`swapSection`), swap in place too.
 */
function swapViews() {
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
		if (url.origin !== location.origin || url.pathname !== location.pathname) {
			return;
		}
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
	// Only entries this document pushed come back here: the views and sections
	// swapped in place.
	addEventListener("popstate", () => {
		if (viewOf(location) !== shownView) showPage(location.href, false);
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

/** The day under `clientX` on `chart`. */
function chartDayAt(chart, clientX) {
	return Math.round(
		chart.scales.x.getValueForPixel(
			clientX - chart.canvas.getBoundingClientRect().left,
		),
	);
}

/**
 * Pinch and a sideways drag on a chart, a mouse over it and a tap, for the
 * rider's charts and the organiser's (feature 009 contracts/client.md
 * "Gestures", feature 029 research R4). `select` takes the day under the
 * pointer, `settled` the chart once a gesture has ended.
 */
function chartGestures(chart, signal, { select, settled }) {
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
					select(chartDayAt(chart, event.clientX));
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
			select(chartDayAt(chart, event.clientX));
		}
		if (pointers.size < 2) spread = 0;
		if (pointers.size === 0) {
			if (moved) settled(chart);
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
			if (!event.shiftKey) select(chartDayAt(chart, event.clientX));
		},
		{ signal },
	);
}

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

	/** Moves the period by half its width: -1 earlier, 1 later. */
	function move(direction) {
		const [chart] = charts;
		if (!chart) return;
		const { left, right } = chart.chartArea;
		chart.pan({ x: (-direction * (right - left)) / 2 }, undefined, "none");
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
		chartGestures(chart, signal, { select, settled: follow });
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

/** What survives a tile click, until a full reload (feature 029 research R5). */
const graphsKept = {
	from: null,
	to: null,
	mode: "running",
	average: true,
	total: false,
	metric: "outdoor",
	custom: false,
	view: null,
};

const GRAPH_WIDE = "(min-width: 1100px)";
// "sessions" only while the page draws its figure (feature 032).
const GRAPH_METRICS = ["outdoor", "virtual", "elevation", "sessions"];
/** More selected riders than this go thin and grey (FR-016). */
const GRAPH_CROWDED = 8;

/** A round top for the y axis. */
function graphNiceMax(value) {
	if (value <= 0) return 10;
	const power = 10 ** Math.floor(Math.log10(value));
	const fraction = value / power;
	return (
		(fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
	);
}

/**
 * The organiser's graphs (feature 029 contracts/client.md): one chart per
 * measure over one range, with rider and team lines from the page's data. A
 * running total starts from zero on the range's first day, so moving the range
 * works every line out again.
 */
function organiserGraphs(signal) {
	const section = document.getElementById("organiser-graphs");
	const source = document.getElementById("organiser-graphs-data");
	if (!section || !source) return;
	if (!window.Chart || !window.ChartZoom) {
		console.error("The chart library is missing");
		return;
	}
	let data;
	try {
		data = JSON.parse(source.textContent);
	} catch (error) {
		console.error("Unreadable graph data", error);
		return;
	}
	const { Chart, ChartZoom } = window;
	Chart.register(ChartZoom);
	const kept = graphsKept;
	const locale = section.dataset.locale;
	const last = data.presets.season.to;
	const [year, month, date] = data.firstDay.split("-").map(Number);
	const dateOf = (index) => new Date(Date.UTC(year, month - 1, date + index));
	const isoOf = (index) => dateOf(index).toISOString().slice(0, 10);
	const indexOf = (value) => {
		const time = Date.parse(`${value}T00:00:00Z`);
		if (Number.isNaN(time)) return null;
		const index = Math.round((time - dateOf(0).getTime()) / 86400000);
		return Math.max(0, Math.min(last, index));
	};
	const shortDate = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		day: "numeric",
		month: "short",
	});
	const monthName = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		month: "short",
	});
	const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
	const oneDecimal = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});

	/** A catalog text from a `data-text` template, with its slots filled. */
	const text = (name, values = {}) => {
		const template = section.querySelector(`template[data-text="${name}"]`);
		if (!template) return "";
		const content = template.content.cloneNode(true);
		for (const slot of content.querySelectorAll("[data-slot]")) {
			slot.textContent = values[slot.dataset.slot] ?? "";
		}
		return content.textContent ?? "";
	};
	const valueText = (metric, value) =>
		metric === "sessions"
			? text("sessions", { n: whole.format(value) })
			: metric === "elevation"
				? text("m", { n: whole.format(value) })
				: text("km", {
						n: value < 100 ? oneDecimal.format(value) : whole.format(value),
					});

	// Every line as one dense list per measure, in km or m.
	const riders = data.riders.map((rider) => {
		const series = {
			outdoor: new Float64Array(last + 1),
			virtual: new Float64Array(last + 1),
			elevation: new Float64Array(last + 1),
			sessions: new Float64Array(last + 1),
		};
		for (const [index, outdoor, virtual, elevation, sessions] of rider.days) {
			series.outdoor[index] = outdoor / 1000;
			series.virtual[index] = virtual / 1000;
			series.elevation[index] = elevation / 10;
			series.sessions[index] = sessions ?? 0;
		}
		return { ...rider, series };
	});
	const team = {
		outdoor: Float64Array.from(data.teamSum.outdoorM, (m) => m / 1000),
		virtual: Float64Array.from(data.teamSum.virtualM, (m) => m / 1000),
		elevation: Float64Array.from(data.teamSum.elevationDm, (dm) => dm / 10),
		sessions: Float64Array.from(data.teamSum.sessions ?? [], (n) => n),
	};
	const averageOf = {};
	for (const metric of GRAPH_METRICS) {
		averageOf[metric] = team[metric].map((v) => v / (data.agreedCount || 1));
	}

	const wide = matchMedia(GRAPH_WIDE);
	/** The riders of the current tile, as today's default group (FR-014). */
	const inGroup = (rider) => {
		const group = data.group ?? (wide.matches ? "all" : "push");
		if (group === "all") return true;
		if (group === "requests") return rider.requests;
		return rider.status === group;
	};
	const selected = new Set(riders.filter(inGroup).map((rider) => rider.id));
	let highlight = null;
	let picked = null;
	if (kept.from === null || kept.to === null) {
		kept.from = 0;
		kept.to = last;
	}
	kept.from = Math.min(kept.from, last);
	kept.to = Math.min(kept.to, last);

	const look = () => {
		const style = getComputedStyle(section);
		const token = (name) => style.getPropertyValue(name).trim();
		return {
			font: style.fontFamily,
			lines: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => token(`--rp-graph-${n}`)),
			grey: token("--rp-graph-grey"),
			average: token("--rp-graph-average"),
			total: token("--rp-graph-total"),
			halo: token("--rp-graph-halo"),
			band: token("--rp-graph-band"),
			muted: token("--md-sys-color-on-surface-variant"),
			grid: token("--md-sys-color-outline-variant"),
			ink: token("--md-sys-color-on-surface"),
		};
	};
	let colours = look();

	const chosen = () => riders.filter((rider) => selected.has(rider.id));
	const crowded = () => selected.size > GRAPH_CROWDED;
	const colourOf = (rider) => {
		const index = chosen().indexOf(rider);
		return colours.lines[index % colours.lines.length];
	};

	/** The lines of one measure: `key`, `name`, per-day values and looks. */
	function linesOf(metric) {
		const lines = chosen().map((rider) => ({
			key: rider.id,
			name: rider.name,
			daily: rider.series[metric],
			colour: colourOf(rider),
		}));
		if (data.agreedCount > 0) {
			if (kept.average) {
				lines.push({
					key: "average",
					name: text("average"),
					daily: averageOf[metric],
					colour: colours.average,
					team: true,
				});
			}
			if (kept.total) {
				lines.push({
					key: "total",
					name: text("total"),
					daily: team[metric],
					colour: colours.total,
					team: true,
				});
			}
		}
		return lines;
	}

	/** A line's points over the range, and their top. */
	function pointsOf(daily) {
		const points = [];
		let sum = 0;
		let top = 0;
		for (let index = kept.from; index <= kept.to; index++) {
			sum += daily[index];
			const y = kept.mode === "running" ? sum : daily[index];
			if (y > top) top = y;
			points.push({ x: index, y });
		}
		return { points, top };
	}

	const rangeSum = (daily) => {
		let sum = 0;
		for (let index = kept.from; index <= kept.to; index++) sum += daily[index];
		return sum;
	};

	/** What a line shows at `index`, in the current view. */
	function valueAt(daily, index) {
		if (kept.mode === "daily") return daily[index];
		let sum = 0;
		for (let i = kept.from; i <= index; i++) sum += daily[i];
		return sum;
	}

	function datasetsOf(metric) {
		const many = crowded();
		const single = kept.from === kept.to;
		const sets = [];
		let top = 0;
		for (const line of linesOf(metric)) {
			const { points, top: lineTop } = pointsOf(line.daily);
			top = Math.max(top, lineTop);
			const lit = highlight === line.key;
			const faded = highlight !== null && !lit;
			const greyed = many && !line.team && !lit;
			const base = {
				data: points,
				pointRadius: single ? 3 : 0,
				pointHoverRadius: 0,
				borderDash: line.key === "total" ? [6, 4] : [],
			};
			const colour = greyed ? colours.grey : line.colour;
			sets.push({
				...base,
				lineKey: line.key,
				borderColor: colour,
				backgroundColor: colour,
				borderWidth: line.team || lit ? 3 : greyed ? 1 : 2,
				order: line.key === "average" ? 0 : line.team ? 2 : lit ? 3 : 10,
				// The grey crowd stays behind; a fade makes room for the highlight.
				opacity: faded ? 0.2 : greyed ? 0.55 : 1,
			});
			if (line.key === "average" && !faded) {
				sets.push({
					...base,
					lineKey: "halo",
					borderColor: colours.halo,
					backgroundColor: colours.halo,
					borderWidth: 7,
					order: 1,
				});
			}
		}
		for (const set of sets) {
			if (set.opacity !== undefined && set.opacity < 1) {
				set.borderColor = withAlpha(set.borderColor, set.opacity);
			}
		}
		return { sets, top };
	}

	/** `colour` (`#rrggbb`) at `alpha`; anything else as it is. */
	function withAlpha(colour, alpha) {
		if (!/^#[0-9a-f]{6}$/i.test(colour)) return colour;
		const part = Math.round(alpha * 255)
			.toString(16)
			.padStart(2, "0");
		return `${colour}${part}`;
	}

	const dayTicks = (scale) => {
		const from = Math.ceil(scale.min);
		const to = Math.floor(scale.max);
		const span = scale.max - scale.min;
		const ticks = [];
		for (let i = from; i <= to; i++) {
			const at = dateOf(i);
			if (
				span > 62
					? at.getUTCDate() === 1
					: span >= 15
						? at.getUTCDay() === 1
						: (i - from) % 2 === 0
			) {
				ticks.push({ value: i });
			}
		}
		scale.ticks = ticks;
	};

	const crosshair = {
		id: "organiserCrosshair",
		afterDatasetsDraw(chart) {
			if (picked === null) return;
			const x = chart.scales.x.getPixelForValue(picked);
			const { top, bottom, left, right } = chart.chartArea;
			if (x < left || x > right) return;
			const { ctx } = chart;
			ctx.save();
			ctx.strokeStyle = colours.ink;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(Math.round(x) + 0.5, top);
			ctx.lineTo(Math.round(x) + 0.5, bottom);
			ctx.stroke();
			ctx.restore();
		},
	};

	const xBounds = () =>
		kept.from === kept.to
			? { min: kept.from - 0.5, max: kept.to + 0.5 }
			: { min: kept.from, max: kept.to };

	function makeChart(canvas) {
		const font = { family: colours.font, size: 12 };
		// Sessions come in whole numbers, so the axis does too.
		const wholeTicks =
			canvas.dataset.metric === "sessions" ? { precision: 0 } : {};
		const { min, max } = xBounds();
		return new Chart(canvas, {
			type: "line",
			data: { datasets: [] },
			plugins: [crosshair],
			options: {
				animation: false,
				responsive: true,
				maintainAspectRatio: false,
				events: [],
				parsing: false,
				normalized: true,
				elements: { line: { tension: 0 } },
				scales: {
					x: {
						type: "linear",
						min,
						max,
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
						max: 10,
						grid: { color: colours.grid },
						border: { color: colours.grid },
						ticks: {
							color: colours.muted,
							font,
							maxTicksLimit: 6,
							...wholeTicks,
							callback: (value) => whole.format(value),
						},
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: { enabled: false },
					zoom: {
						limits: {
							x: { min: 0, max: last, minRange: PROGRESS_MIN_DAYS },
						},
						pan: {
							// Only so a shift-drag isn't a drag-zoom; the gestures pan.
							enabled: true,
							mode: "x",
							modifierKey: "shift",
							onPan: ({ chart }) => follow(chart, false),
						},
						zoom: {
							mode: "x",
							wheel: { enabled: true },
							drag: {
								enabled: true,
								threshold: PROGRESS_PAN_SLOP,
								backgroundColor: colours.band,
								borderColor: colours.ink,
								borderWidth: 2,
							},
							pinch: { enabled: false },
							onZoomStart: ({ chart, event }) =>
								event.type !== "wheel" ||
								document.activeElement === chart.canvas,
							onZoom: ({ chart, trigger }) =>
								follow(chart, trigger === "drag" || trigger === "wheel"),
						},
					},
				},
			},
		});
	}

	const figures = new Map(
		[...section.querySelectorAll("figure[data-metric]")].map((figure) => [
			figure.dataset.metric,
			figure,
		]),
	);
	const charts = new Map();

	/** A chart for each measure on screen, none for the others (research R4). */
	function syncCharts() {
		const overview = section.closest(".team-overview");
		const shown = wide.matches || overview?.dataset.view !== "riders";
		for (const metric of GRAPH_METRICS) {
			const figure = figures.get(metric);
			const on = shown && (wide.matches || kept.metric === metric);
			if (figure) figure.hidden = !wide.matches && kept.metric !== metric;
			const chart = charts.get(metric);
			if (on && !chart && figure) {
				const canvas = figure.querySelector("canvas");
				const made = makeChart(canvas);
				charts.set(metric, made);
				chartGestures(made, signal, {
					select: selectDay,
					settled: (c) => follow(c, true),
				});
				keys(made, metric, canvas);
			} else if (!on && chart) {
				chart.destroy();
				charts.delete(metric);
			}
		}
	}

	/** The chart's range becomes everyone's; `snap` once a gesture is over. */
	function follow(chart, snap) {
		const { min, max } = chart.scales.x;
		const from = Math.max(0, Math.round(min));
		const to = Math.min(last, Math.round(max));
		kept.from = Math.min(from, to);
		kept.to = Math.max(from, to);
		kept.custom = true;
		picked = null;
		redraw(snap ? null : { chart, min, max });
	}

	function setRange(from, to) {
		kept.from = Math.max(0, Math.min(last, from));
		kept.to = Math.max(kept.from, Math.min(last, to));
		picked = null;
		redraw(null);
	}

	let drawing = 0;
	let pending = null;

	/**
	 * Works every line out for the range. A gesture sends many of these: one per
	 * frame is enough, with its chart kept on the unrounded period it has reached.
	 */
	function redraw(live) {
		pending = live;
		if (live === null) {
			if (drawing) cancelAnimationFrame(drawing);
			drawing = 0;
			drawNow();
			return;
		}
		if (drawing) return;
		drawing = requestAnimationFrame(() => {
			drawing = 0;
			if (!signal.aborted) drawNow();
		});
	}

	function drawNow() {
		const live = pending;
		pending = null;
		const bounds = live ? { min: live.min, max: live.max } : xBounds();
		for (const [metric, chart] of charts) {
			const { sets, top } = datasetsOf(metric);
			chart.data.datasets = sets;
			chart.options.scales.x.min = bounds.min;
			chart.options.scales.x.max = bounds.max;
			chart.options.scales.y.max = graphNiceMax(top);
			chart.update("none");
			updateAria(metric, chart);
		}
		updateControls();
		renderLegends();
	}

	/** Only colours and widths changed: no need to work the sums out again. */
	function restyle() {
		for (const [metric, chart] of charts) {
			const { sets } = datasetsOf(metric);
			chart.data.datasets = sets;
			chart.update("none");
		}
		for (const button of section.querySelectorAll(".org-legend-entry")) {
			const on = button.dataset.line === String(highlight);
			button.setAttribute("aria-pressed", String(on));
		}
	}

	const rangeLabel = () =>
		text("range", {
			from: shortDate.format(dateOf(kept.from)),
			to: shortDate.format(dateOf(kept.to)),
		});

	function updateAria(metric, chart) {
		const lines = linesOf(metric)
			.map((line) => `${line.name} ${valueText(metric, rangeSum(line.daily))}`)
			.join(", ");
		chart.canvas.setAttribute(
			"aria-label",
			text("aria", {
				title: text(`title.${metric}`),
				from: shortDate.format(dateOf(kept.from)),
				to: shortDate.format(dateOf(kept.to)),
				lines,
			}),
		);
	}

	const entryTemplate = section.querySelector("template[data-legend-entry]");

	/** Each graph's legend: range sums, or the selected day's values (FR-008). */
	function renderLegends() {
		const many = crowded();
		for (const [metric, figure] of figures) {
			const legend = figure.querySelector("[data-legend]");
			if (!legend || !entryTemplate) continue;
			let lines = linesOf(metric);
			if (many) {
				lines = lines
					.map((line) => ({ line, sum: rangeSum(line.daily) }))
					.sort(
						(a, b) =>
							Number(Boolean(b.line.team)) - Number(Boolean(a.line.team)) ||
							b.sum - a.sum,
					)
					.map(({ line }) => line);
			}
			legend.classList.toggle("org-legend-many", many);
			legend.replaceChildren(
				...lines.map((line) => {
					const entry = entryTemplate.content.cloneNode(true);
					const button = entry.querySelector("button");
					button.dataset.line = String(line.key);
					button.setAttribute("aria-pressed", String(highlight === line.key));
					const key = entry.querySelector(".org-legend-key");
					key.style.background = line.colour;
					if (line.key === "average") key.classList.add("org-legend-halo");
					entry.querySelector("[data-slot=name]").textContent = line.name;
					entry.querySelector("[data-slot=value]").textContent = legendValue(
						metric,
						line,
					);
					return entry;
				}),
			);
			const readout = figure.querySelector("[data-readout]");
			if (readout) {
				readout.textContent =
					picked === null ? rangeLabel() : shortDate.format(dateOf(picked));
			}
		}
	}

	const legendValue = (metric, line) =>
		valueText(
			metric,
			picked === null ? rangeSum(line.daily) : valueAt(line.daily, picked),
		);

	/** The selected day in the legends, without rebuilding them. */
	function updateDay() {
		for (const [metric, figure] of figures) {
			const lines = new Map(
				linesOf(metric).map((line) => [String(line.key), line]),
			);
			for (const button of figure.querySelectorAll(".org-legend-entry")) {
				const line = lines.get(button.dataset.line);
				const value = button.querySelector("[data-slot=value]");
				if (line && value) value.textContent = legendValue(metric, line);
			}
			const readout = figure.querySelector("[data-readout]");
			if (readout) {
				readout.textContent =
					picked === null ? rangeLabel() : shortDate.format(dateOf(picked));
			}
		}
		for (const chart of charts.values()) chart.render();
	}

	function selectDay(index) {
		picked = Math.max(kept.from, Math.min(kept.to, index));
		updateDay();
	}

	function updateControls() {
		const from = section.querySelector("input[data-from]");
		const to = section.querySelector("input[data-to]");
		if (from) from.value = isoOf(kept.from);
		if (to) to.value = isoOf(kept.to);
		for (const button of section.querySelectorAll("button[data-preset]")) {
			const range = data.presets[button.dataset.preset];
			const on = range && range.from === kept.from && range.to === kept.to;
			button.setAttribute("aria-pressed", String(Boolean(on)));
		}
		section
			.querySelector("button[data-custom]")
			?.setAttribute("aria-pressed", String(kept.custom));
		section.dataset.custom = String(kept.custom);
		for (const button of section.querySelectorAll("button[data-mode]")) {
			button.setAttribute(
				"aria-pressed",
				String(button.dataset.mode === kept.mode),
			);
		}
		for (const button of section.querySelectorAll("button[data-tab]")) {
			button.setAttribute(
				"aria-pressed",
				String(button.dataset.tab === kept.metric),
			);
		}
		updatePicker();
		updateNote();
	}

	function updatePicker() {
		const riderCount = selected.size;
		const parts = [];
		if (riderCount === 1) {
			parts.push(chosen()[0]?.name ?? "");
		} else if (riderCount > 1) {
			parts.push(text("summary.riders", { n: whole.format(riderCount) }));
		}
		if (kept.average) parts.push(text("summary.average"));
		if (kept.total) parts.push(text("summary.total"));
		const summary = section.querySelector("[data-summary]");
		if (summary) {
			const line = parts.join(", ");
			summary.textContent =
				line === ""
					? text("summary.none")
					: line.charAt(0).toLocaleUpperCase(locale) + line.slice(1);
		}
		for (const label of section.querySelectorAll(".org-graphs-option")) {
			const input = label.querySelector("input");
			if (!input) continue;
			if (label.dataset.team === "average") input.checked = kept.average;
			else if (label.dataset.team === "total") input.checked = kept.total;
			else input.checked = selected.has(Number(label.dataset.rider));
		}
	}

	function updateNote() {
		const note = section.querySelector("[data-note]");
		if (!note) return;
		const missing = data.notAgreed.filter(inGroup).length;
		const line =
			data.agreedCount === 0
				? text("note.nobody")
				: missing === 1
					? text("note.one")
					: missing > 1
						? text("note.other", { n: whole.format(missing) })
						: "";
		note.textContent = line;
		note.hidden = line === "";
	}

	/** The keys of the rider's charts (feature 009 research R7). */
	function keys(chart, metric, canvas) {
		canvas.addEventListener(
			"keydown",
			(event) => {
				if (event.altKey || event.ctrlKey || event.metaKey) return;
				const zoomBy = (factor) => {
					const { top, bottom } = chart.chartArea;
					chart.zoom(
						{
							x: factor,
							focalPoint: {
								x: chart.scales.x.getPixelForValue(picked ?? kept.to),
								y: (top + bottom) / 2,
							},
						},
						"none",
					);
					follow(chart, true);
				};
				const moveDays = (direction) => {
					const span = kept.to - kept.from;
					const by = Math.max(1, Math.round(span / 2)) * direction;
					const from = Math.max(0, Math.min(last - span, kept.from + by));
					kept.custom = true;
					setRange(from, from + span);
				};
				switch (event.key) {
					case "ArrowLeft":
						selectDay((picked ?? kept.to) - 1);
						announce(metric);
						break;
					case "ArrowRight":
						selectDay((picked ?? kept.from) + 1);
						announce(metric);
						break;
					case "Home":
						selectDay(kept.from);
						announce(metric);
						break;
					case "End":
						selectDay(kept.to);
						announce(metric);
						break;
					case "+":
					case "=":
						zoomBy(1.5);
						break;
					case "-":
						zoomBy(1 / 1.5);
						break;
					case "PageUp":
						moveDays(-1);
						break;
					case "PageDown":
						moveDays(1);
						break;
					case "0":
					case "Escape":
						kept.custom = false;
						setRange(0, last);
						break;
					default:
						return;
				}
				event.preventDefault();
			},
			{ signal },
		);
	}

	/** Says the selected day's values, for the focused graph only (FR-009). */
	function announce(metric) {
		const live = section.querySelector("[data-live]");
		if (!live || picked === null) return;
		const lines = linesOf(metric)
			.map((line) => `${line.name} ${legendValue(metric, line)}`)
			.join(", ");
		live.textContent = `${text(`title.${metric}`)}, ${shortDate.format(dateOf(picked))}: ${lines}`;
	}

	// The panel of "Shown in the graphs".
	const toggle = section.querySelector("[data-picker-toggle]");
	const panel = section.querySelector("[data-picker-panel]");
	const query = section.querySelector("[data-picker-query]");
	const none = section.querySelector("[data-picker-none]");
	const closePanel = (focus) => {
		if (!panel || panel.hidden) return;
		panel.hidden = true;
		toggle?.setAttribute("aria-expanded", "false");
		if (query) query.value = "";
		filterOptions();
		if (highlight !== null) {
			highlight = null;
			restyle();
		}
		if (focus) toggle?.focus();
	};
	function filterOptions() {
		const needle = (query?.value ?? "").trim().toLowerCase();
		let shown = 0;
		for (const label of section.querySelectorAll(".org-graphs-option")) {
			const match = label.dataset.name.includes(needle);
			label.hidden = !match;
			if (match) shown += 1;
		}
		if (none) {
			none.hidden = shown > 0 || needle === "";
			none.textContent = none.hidden
				? ""
				: text("noMatch", { query: (query?.value ?? "").trim() });
		}
	}
	toggle?.addEventListener(
		"click",
		() => {
			if (!panel) return;
			if (panel.hidden) {
				panel.hidden = false;
				toggle.setAttribute("aria-expanded", "true");
				query?.focus();
			} else {
				closePanel(true);
			}
		},
		{ signal },
	);
	query?.addEventListener("input", filterOptions, { signal });
	document.addEventListener(
		"click",
		(event) => {
			const picker = section.querySelector("[data-picker]");
			if (panel?.hidden || !(event.target instanceof Node)) return;
			if (!picker?.contains(event.target)) closePanel(false);
		},
		{ signal },
	);
	section.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "Escape" && panel && !panel.hidden) {
				closePanel(true);
				event.stopPropagation();
			}
		},
		{ signal },
	);
	panel?.addEventListener(
		"change",
		(event) => {
			const label =
				event.target instanceof Element
					? event.target.closest(".org-graphs-option")
					: null;
			if (!label) return;
			const on = label.querySelector("input")?.checked ?? false;
			if (label.dataset.team === "average") kept.average = on;
			else if (label.dataset.team === "total") kept.total = on;
			else if (on) selected.add(Number(label.dataset.rider));
			else selected.delete(Number(label.dataset.rider));
			highlight = null;
			redraw(null);
		},
		{ signal },
	);

	// A fine pointer highlights a line from its legend entry or panel row.
	const fine = matchMedia("(hover: hover)");
	const hoverLine = (key) => {
		if (!fine.matches || highlight === key) return;
		highlight = key;
		restyle();
	};
	const lineKeyOf = (value) =>
		value === "average" || value === "total" ? value : Number(value);
	section.addEventListener(
		"mouseover",
		(event) => {
			if (!(event.target instanceof Element)) return;
			const entry = event.target.closest(".org-legend-entry");
			if (entry) {
				hoverLine(lineKeyOf(entry.dataset.line));
				return;
			}
			const option = event.target.closest(".org-graphs-option");
			if (!option) return;
			const key = option.dataset.team ?? Number(option.dataset.rider);
			const on = option.querySelector("input")?.checked;
			hoverLine(on ? key : null);
		},
		{ signal },
	);
	section.addEventListener(
		"mouseout",
		(event) => {
			if (!(event.target instanceof Element)) return;
			if (
				event.target.closest(".org-legend-entry, .org-graphs-option") &&
				!(
					event.relatedTarget instanceof Element &&
					event.relatedTarget.closest(".org-legend-entry, .org-graphs-option")
				)
			) {
				hoverLine(null);
			}
		},
		{ signal },
	);
	for (const canvas of section.querySelectorAll("canvas[data-metric]")) {
		canvas.addEventListener(
			"pointerleave",
			(event) => {
				if (
					event.pointerType === "mouse" &&
					event.buttons === 0 &&
					picked !== null
				) {
					picked = null;
					updateDay();
				}
			},
			{ signal },
		);
	}

	section.addEventListener(
		"click",
		(event) => {
			const button =
				event.target instanceof Element ? event.target.closest("button") : null;
			if (!button || !section.contains(button)) return;
			if (button.dataset.preset) {
				const range = data.presets[button.dataset.preset];
				if (!range) return;
				kept.custom = false;
				setRange(range.from, range.to);
			} else if (button.dataset.custom !== undefined) {
				kept.custom = !kept.custom;
				updateControls();
			} else if (button.dataset.mode) {
				kept.mode = button.dataset.mode;
				redraw(null);
			} else if (button.dataset.tab) {
				kept.metric = button.dataset.tab;
				picked = null;
				syncCharts();
				redraw(null);
			} else if (button.classList.contains("org-legend-entry")) {
				const key = lineKeyOf(button.dataset.line);
				highlight = highlight === key ? null : key;
				restyle();
			} else if (button.hasAttribute("data-picker-clear")) {
				selected.clear();
				kept.average = false;
				kept.total = false;
				highlight = null;
				redraw(null);
			} else if (button.hasAttribute("data-picker-done")) {
				closePanel(true);
			}
		},
		{ signal },
	);
	section.addEventListener(
		"change",
		(event) => {
			const input = event.target;
			if (!(input instanceof HTMLInputElement)) return;
			if (input.dataset.from === undefined && input.dataset.to === undefined) {
				return;
			}
			const index = indexOf(input.value);
			if (index === null) return;
			kept.custom = true;
			if (input.dataset.from !== undefined) {
				setRange(index, Math.max(index, kept.to));
			} else {
				setRange(Math.min(index, kept.from), index);
			}
		},
		{ signal },
	);

	wide.addEventListener(
		"change",
		() => {
			syncCharts();
			redraw(null);
		},
		{ signal },
	);
	const onViewChange = () => {
		syncCharts();
		redraw(null);
	};
	section
		.closest(".team-overview")
		?.addEventListener("rp-view-change", onViewChange, { signal });

	/** The scheme changed: the lines take its colours (research R13). */
	function recolour() {
		colours = look();
		for (const chart of charts.values()) {
			for (const axis of ["x", "y"]) {
				const scale = chart.options.scales[axis];
				scale.grid.color = colours.grid;
				scale.border.color = colours.grid;
				scale.ticks.color = colours.muted;
			}
			const { drag } = chart.options.plugins.zoom.zoom;
			drag.backgroundColor = colours.band;
			drag.borderColor = colours.ink;
		}
		redraw(null);
	}
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
		if (drawing) cancelAnimationFrame(drawing);
		for (const chart of charts.values()) chart.destroy();
		charts.clear();
	});
	syncCharts();
	redraw(null);
}

/**
 * Below 1100 px: the Graphs / Riders switch, the rider search across the whole
 * team, and rows that open by themselves when few show (feature 029 contracts/
 * client.md "Narrow Riders view"). A view kept across a tile click stays.
 */
function organiserRiders(signal) {
	const overview = document.querySelector(".team-overview");
	if (!overview) return;
	const rows = [...overview.querySelectorAll(".rider-row")];
	const list = overview.querySelector(".rider-rows");
	const search = overview.querySelector("[data-rider-search]");
	const none = overview.querySelector("[data-rider-none]");
	const noneText = overview.querySelector("template[data-rider-none-text]");
	const wasHidden = new Set(rows.filter((row) => row.hidden));
	const isDefault = list?.classList.contains("default") ?? false;
	const count = overview.querySelector("[data-riders-count]");
	const whole = new Intl.NumberFormat(document.documentElement.lang || "en");

	const needle = () => (search?.value ?? "").trim().toLowerCase();
	/** Whether a row shows without a search, as `.default` does in the CSS. */
	const inGroup = (row) =>
		!wasHidden.has(row) &&
		(!isDefault ||
			matchMedia(GRAPH_WIDE).matches ||
			row.classList.contains("status-push"));
	const shows = (row) =>
		needle() === "" ? inGroup(row) : row.dataset.name.includes(needle());

	function expandFew() {
		const showing = rows.filter(shows);
		const open = showing.length <= 5;
		for (const row of rows) {
			const details = row.querySelector("details");
			if (details) details.open = open && showing.includes(row);
		}
	}

	function applySearch() {
		const query = needle();
		list?.classList.toggle("default", isDefault && query === "");
		let shown = 0;
		for (const row of rows) {
			const on = shows(row);
			row.hidden = query === "" ? wasHidden.has(row) : !on;
			if (on) shown += 1;
		}
		if (none && noneText) {
			none.hidden = query === "" || shown > 0;
			const content = noneText.content.cloneNode(true);
			const slot = content.querySelector("[data-slot=query]");
			if (slot) slot.textContent = (search?.value ?? "").trim();
			none.textContent = none.hidden ? "" : (content.textContent ?? "");
		}
		expandFew();
	}
	search?.addEventListener("input", applySearch, { signal });
	if (count && isDefault) {
		count.textContent = whole.format(rows.filter(inGroup).length);
	}
	if (rows.length > 0) expandFew();

	// The view: from the address when it asks for one, else as it was.
	const asked = new URL(location.href).searchParams.get("view");
	if (asked === "riders" || asked === "graphs") graphsKept.view = asked;
	const setView = (view) => {
		if (overview.dataset.view === undefined) return;
		graphsKept.view = view;
		overview.dataset.view = view;
		for (const button of overview.querySelectorAll("[data-view-pick]")) {
			button.setAttribute(
				"aria-pressed",
				String(button.dataset.viewPick === view),
			);
		}
		overview.dispatchEvent(new Event("rp-view-change"));
	};
	if (graphsKept.view) setView(graphsKept.view);
	overview.addEventListener(
		"click",
		(event) => {
			const button =
				event.target instanceof Element
					? event.target.closest("[data-view-pick]")
					: null;
			if (button) setView(button.dataset.viewPick);
		},
		{ signal },
	);
}

/**
 * What the page's content needs: run on load and again on content swapped in
 * place (`swapPage`), whose `signal` ends the listeners of the content before.
 */
/**
 * Says a day's figures on the admin page's graphs, on hovering or tapping
 * (feature 025). The values and words come from the graph's data attributes, and
 * the same figures are in its table of days.
 */
function usageGraphs(signal) {
	const graphs = document.querySelectorAll(".usage-graph");
	if (graphs.length === 0) return;
	const { locale } = graphs[0].dataset;
	const date = new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "UTC",
	});
	const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
	const gigabytes = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	const hide = [];
	for (const graph of graphs) {
		const { first, numbers, gap, gb } = graph.dataset;
		const days = graph.dataset.days.split(",");
		const start = Date.parse(`${first}T00:00:00Z`);
		const amount = (value) =>
			gb
				? gb.replace("{n}", gigabytes.format(value / 1e9))
				: whole.format(value);
		const text = (day) => {
			if (!day) return gap;
			const [used, limit] = day.split("/").map(Number);
			return numbers
				.replace("{used}", amount(used))
				.replace("{limit}", amount(limit))
				.replace(
					"{percent}",
					whole.format(limit > 0 ? Math.floor((used * 100) / limit) : 0),
				);
		};
		const cursor = document.createElement("div");
		cursor.className = "usage-cursor";
		cursor.hidden = true;
		const tip = document.createElement("p");
		tip.className = "usage-tip";
		tip.hidden = true;
		graph.append(cursor, tip);
		const off = () => {
			cursor.hidden = true;
			tip.hidden = true;
		};
		hide.push(off);
		const show = (event) => {
			const box = graph.getBoundingClientRect();
			const share = (event.clientX - box.left) / box.width;
			const i = Math.min(
				days.length - 1,
				Math.max(0, Math.floor(share * days.length)),
			);
			const slot = box.width / days.length;
			cursor.style.left = `${i * slot}px`;
			cursor.style.width = `${slot}px`;
			cursor.hidden = false;
			tip.textContent = `${date.format(start + i * 86_400_000)}: ${text(days[i])}`;
			tip.hidden = false;
			const middle = (i + 0.5) * slot - tip.offsetWidth / 2;
			tip.style.left = `${Math.max(0, Math.min(box.width - tip.offsetWidth, middle))}px`;
		};
		graph.addEventListener("pointermove", show, { signal });
		graph.addEventListener("pointerdown", show, { signal });
		graph.addEventListener("pointercancel", off, { signal });
		// A finger lifts off without meaning to leave: tapping elsewhere does that.
		graph.addEventListener(
			"pointerleave",
			(event) => {
				if (event.pointerType !== "touch") off();
			},
			{ signal },
		);
	}
	document.addEventListener(
		"pointerdown",
		(event) => {
			if (!event.target.closest?.(".usage-graph"))
				for (const off of hide) off();
		},
		{ signal },
	);
}

/**
 * Sharing a badge (feature 033). A share button on an earned badge, or
 * "Teilen" in its large view, opens the page's one share sheet: a story
 * (9:16), a square picture, or the badge alone as a sticker. Every picture is
 * drawn here, on a canvas, from what the large view shows; nothing is
 * uploaded, and no rider's name is ever drawn or in a file name (FR-018,
 * FR-022, FR-029). The file is made as soon as the preview settles, so a tap
 * on "Teilen …" shares it at once, as iOS requires (FR-013).
 */
const SHARE_BASE = 1024;
/** The large view's badge, which the ribbon text and shadow are sized for. */
const SHARE_LARGE = 280;

function shareLoadImage(src) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = src;
	});
}

/** An SVG drawn sharp at `size`: its text with a width and height set. */
async function shareSvgImage(text, size) {
	const sized = text.replace(/<svg\b/, `<svg width="${size}" height="${size}"`);
	const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
	try {
		return await shareLoadImage(url);
	} finally {
		URL.revokeObjectURL(url);
	}
}

function shareCanvas(width, height) {
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(width);
	canvas.height = Math.round(height);
	return canvas;
}

/** "rgba(…) 0px 0px 2px", a computed text-shadow, as canvas shadow values. */
function shareTextShadow(value, scale) {
	const match =
		/^(rgba?\([^)]*\)|#\w+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/.exec(
			value ?? "",
		);
	if (!match) return null;
	return {
		color: match[1],
		x: Number(match[2]) * scale,
		y: Number(match[3]) * scale,
		blur: Number(match[4]) * scale,
	};
}

/**
 * The badge as the large view shows it, at SHARE_BASE (research R2): the
 * picture and the ribbon under one cream sticker edge (--rp-badge-edge's four
 * 2 px steps at 280 px), and the milestone over the ribbon in the page's
 * typeface and the ribbon's text colour. Those are the coin's own colours,
 * the same in every theme and scheme, so the picture never follows dark mode.
 */
async function shareBadgeAssets(large) {
	const B = SHARE_BASE;
	const k = B / SHARE_LARGE;
	const img = large.querySelector(".badge-art img");
	const response = await fetch(img.currentSrc || img.src);
	if (!response.ok) throw new Error(`badge picture ${response.status}`);
	const picture = await shareSvgImage(await response.text(), B);
	const fill =
		large.querySelector(".badge-ribbon use")?.getAttribute("fill") ?? null;
	const ribbonShape = document.getElementById("badge-ribbon");
	const ribbon =
		fill && ribbonShape
			? await shareSvgImage(
					`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="${fill}">${ribbonShape.outerHTML}</g></svg>`,
					B,
				)
			: null;
	const art = shareCanvas(B, B);
	const a = art.getContext("2d");
	a.drawImage(picture, 0, 0, B, B);
	if (ribbon) a.drawImage(ribbon, 0, 0, B, B);
	// The edge: the art's outline in cream at every 2 px step around it.
	const e = Math.round(2 * k);
	const silhouette = shareCanvas(B, B);
	const s = silhouette.getContext("2d");
	s.drawImage(art, 0, 0);
	s.globalCompositeOperation = "source-in";
	s.fillStyle = "#fffdf5";
	s.fillRect(0, 0, B, B);
	const layer = shareCanvas(B + 2 * e, B + 2 * e);
	const l = layer.getContext("2d");
	for (const dx of [-e, 0, e]) {
		for (const dy of [-e, 0, e]) l.drawImage(silhouette, e + dx, e + dy);
	}
	l.drawImage(art, e, e);
	// The milestone, as .badge-ribbon-text: 8.5 % of the badge, centred in
	// the ribbon's box and clipped to it.
	const label = large.querySelector(".badge-ribbon-text");
	if (ribbon && label) {
		await document.fonts?.ready;
		const style = getComputedStyle(label);
		const size = 0.085 * B;
		l.save();
		l.beginPath();
		l.rect(e + 0.13 * B, e + 0.7 * B, 0.74 * B, 0.14 * B);
		l.clip();
		l.font = `600 ${size}px ${style.fontFamily}`;
		if ("letterSpacing" in l) l.letterSpacing = `${0.04 * size}px`;
		l.textAlign = "center";
		l.textBaseline = "middle";
		l.fillStyle = style.color;
		const glow = shareTextShadow(style.textShadow, k);
		if (glow) {
			l.shadowColor = glow.color;
			l.shadowOffsetX = glow.x;
			l.shadowOffsetY = glow.y;
			l.shadowBlur = glow.blur;
		}
		l.fillText(label.textContent ?? "", e + 0.5 * B, e + 0.77 * B);
		l.restore();
	}
	return { art, layer, edge: e, shine: shareCanvas(B, B) };
}

/** The whole badge at `size` px with its top left at x, y, and its shadow. */
function shareDrawBadge(ctx, assets, x, y, size) {
	const e = (assets.edge * size) / SHARE_BASE;
	const unit = size / SHARE_LARGE;
	ctx.save();
	ctx.shadowColor = "rgba(28,27,19,.3)";
	ctx.shadowBlur = 2 * unit;
	ctx.shadowOffsetY = 2 * unit;
	ctx.drawImage(assets.layer, x - e, y - e, size + 2 * e, size + 2 * e);
	ctx.restore();
}

/** CSS's cubic-bezier(x1, y1, x2, y2) as a function of 0…1. */
function shareBezier(x1, y1, x2, y2) {
	const at = (a, b, u) =>
		3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
	return (x) => {
		let lo = 0;
		let hi = 1;
		for (let i = 0; i < 20; i++) {
			const mid = (lo + hi) / 2;
			if (at(x1, x2, mid) < x) lo = mid;
			else hi = mid;
		}
		return at(y1, y2, (lo + hi) / 2);
	};
}
const SHARE_EASE_OUT = shareBezier(0, 0, 0.58, 1);
const SHARE_EASE_IN_OUT = shareBezier(0.42, 0, 0.58, 1);

/** The video: 5 s at 30 frames a second, looping (FR-023, research R4). */
const SHARE_FPS = 30;
const SHARE_FRAMES = 150;
/** Two shine sweeps (badge-shine-new, 1.1 s), half the clip apart. */
const SHARE_SHINES = [0.25, 2.75];
const SHARE_SHINE_SECONDS = 1.1;
/** badge-twinkle's 1.8 s, made 5 s / 3 so the stars loop with the clip. */
const SHARE_TWINKLE = SHARE_FRAMES / SHARE_FPS / 3;
/** The large view's four stars (.badge-sparkles, inset -3 %), as fractions. */
const SHARE_STARS = [
	{ left: 0.08, top: 0.02, size: 0.12, delay: 0 },
	{ left: 1 - 0.02 - 0.09, top: 0.1, size: 0.09, delay: 0.5 },
	{ left: 0, top: 1 - 0.16 - 0.08, size: 0.08, delay: 1 },
	{ left: 1 - 0.12 - 0.11, top: 1 - 0.02 - 0.11, size: 0.11, delay: 1.3 },
];
const SHARE_STAR = [
	[50, 0],
	[61, 39],
	[100, 50],
	[61, 61],
	[50, 100],
	[39, 61],
	[0, 50],
	[39, 39],
];

/** The large view's shine at `progress` (0 to 1), masked to the badge. */
function shareShine(assets, progress) {
	const B = SHARE_BASE;
	const c = assets.shine.getContext("2d");
	c.globalCompositeOperation = "source-over";
	c.clearRect(0, 0, B, B);
	// linear-gradient(115deg, …) over a 250 % × 100 % box moving from 150 %
	// to -50 %, as badge-shine-new.
	const p = 1.5 - 2 * SHARE_EASE_OUT(progress);
	const cx = -1.5 * B * p + 1.25 * B;
	const cy = 0.5 * B;
	const angle = (115 * Math.PI) / 180;
	const dx = Math.sin(angle);
	const dy = -Math.cos(angle);
	const half = (2.5 * B * Math.abs(dx) + B * Math.abs(dy)) / 2;
	const g = c.createLinearGradient(
		cx - dx * half,
		cy - dy * half,
		cx + dx * half,
		cy + dy * half,
	);
	g.addColorStop(0.38, "rgba(255,253,245,0)");
	g.addColorStop(0.5, "rgba(255,253,245,.8)");
	g.addColorStop(0.62, "rgba(255,253,245,0)");
	c.fillStyle = g;
	c.fillRect(0, 0, B, B);
	c.globalCompositeOperation = "destination-in";
	c.drawImage(assets.art, 0, 0);
	return assets.shine;
}

/**
 * The video's own frame `t` (seconds) over a badge drawn at x, y, `size`:
 * the four stars twinkling as badge-twinkle, and the shine when it sweeps.
 * Still pictures never get this (FR-020).
 */
function shareSparkle(ctx, assets, x, y, size, t) {
	const box = size * 1.06;
	const x0 = x - size * 0.03;
	const y0 = y - size * 0.03;
	for (const star of SHARE_STARS) {
		const phase = ((((t - star.delay) / SHARE_TWINKLE) % 1) + 1) % 1;
		const eased = SHARE_EASE_IN_OUT(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
		if (eased <= 0.01) continue;
		const w = star.size * box;
		const scale = 0.3 + 0.7 * eased;
		ctx.save();
		ctx.globalAlpha = eased;
		ctx.translate(
			x0 + (star.left + star.size / 2) * box,
			y0 + (star.top + star.size / 2) * box,
		);
		ctx.rotate((45 * eased * Math.PI) / 180);
		ctx.scale((scale * w) / 100, (scale * w) / 100);
		ctx.translate(-50, -50);
		ctx.beginPath();
		for (const [px, py] of SHARE_STAR) ctx.lineTo(px, py);
		ctx.closePath();
		ctx.shadowColor = "#1c1b13";
		ctx.shadowBlur = (size / SHARE_LARGE) * 1;
		ctx.fillStyle = "#fbe122";
		ctx.fill();
		ctx.restore();
	}
	for (const start of SHARE_SHINES) {
		if (t >= start && t < start + SHARE_SHINE_SECONDS) {
			const progress = (t - start) / SHARE_SHINE_SECONDS;
			ctx.drawImage(shareShine(assets, progress), x, y, size, size);
		}
	}
}

/** H.264 at level 4.0 up to 1080 × 1920, 5.0 above (larger photos). */
function shareVideoConfig(width, height) {
	const blocks = Math.ceil(width / 16) * Math.ceil(height / 16);
	return {
		codec: blocks <= 8192 ? "avc1.640028" : "avc1.640032",
		width,
		height,
		bitrate: 8_000_000,
		framerate: SHARE_FPS,
		avc: { format: "avc" },
	};
}

/** The vendored MP4 muxer, loaded once, when a share sheet first opens (R5). */
let shareMuxer = null;
function shareLoadMuxer() {
	shareMuxer ??= loadScripts(["/vendor/mp4-muxer-5.2.2.js"]);
	return shareMuxer;
}

/**
 * Whether one frame of `config` really encodes: some browsers say yes to
 * H.264 and only fail once they're given a frame.
 */
async function shareTryEncoder(config) {
	const answer = await VideoEncoder.isConfigSupported(config);
	if (!answer.supported) return false;
	let made = false;
	let failed = false;
	const encoder = new VideoEncoder({
		output: () => {
			made = true;
		},
		error: () => {
			failed = true;
		},
	});
	const canvas = shareCanvas(config.width, config.height);
	canvas.getContext("2d").fillRect(0, 0, 2, 2);
	try {
		encoder.configure(config);
		const frame = new VideoFrame(canvas, { timestamp: 0, alpha: "discard" });
		encoder.encode(frame, { keyFrame: true });
		frame.close();
		await encoder.flush();
		return made && !failed;
	} catch {
		return false;
	} finally {
		if (encoder.state !== "closed") encoder.close();
		canvas.width = 0;
	}
}

/** Whether this browser can make the video at width × height (FR-024). */
const shareVideoSizes = new Map();
function shareCanVideo(width, height) {
	if (!window.Mp4Muxer || !window.VideoEncoder || !window.VideoFrame) {
		return Promise.resolve(false);
	}
	if (width < 2 || height < 2 || width % 2 || height % 2) {
		return Promise.resolve(false);
	}
	const key = `${width}x${height}`;
	if (!shareVideoSizes.has(key)) {
		shareVideoSizes.set(
			key,
			shareTryEncoder(shareVideoConfig(width, height)).catch(() => false),
		);
	}
	return shareVideoSizes.get(key);
}

/**
 * The sparkling video of `still` with the badge at `box`, as MP4 bytes, all on
 * the device (research R4): each frame is drawn from a fixed clock, encoded by
 * the browser and packed by the muxer in memory. Null once `signal` aborts.
 */
async function shareEncode(still, assets, box, signal) {
	const { width, height } = still;
	const target = new window.Mp4Muxer.ArrayBufferTarget();
	const muxer = new window.Mp4Muxer.Muxer({
		target,
		video: { codec: "avc", width, height },
		fastStart: "in-memory",
	});
	let failure = null;
	const encoder = new VideoEncoder({
		output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
		error: (error) => {
			failure = error;
		},
	});
	const stop = () => {
		if (encoder.state !== "closed") encoder.close();
	};
	signal.addEventListener("abort", stop, { once: true });
	const frame = shareCanvas(width, height);
	const c = frame.getContext("2d", { alpha: false });
	const step = 1e6 / SHARE_FPS;
	try {
		encoder.configure(shareVideoConfig(width, height));
		for (let i = 0; i < SHARE_FRAMES; i++) {
			if (signal.aborted) return null;
			if (failure) throw failure;
			c.drawImage(still, 0, 0);
			shareSparkle(c, assets, box.x, box.y, box.size, i / SHARE_FPS);
			const picture = new VideoFrame(frame, {
				timestamp: Math.round(i * step),
				duration: Math.round(step),
				alpha: "discard",
			});
			encoder.encode(picture, { keyFrame: i % SHARE_FPS === 0 });
			picture.close();
			// The page stays usable, and the encoder catches up.
			do await new Promise((resolve) => setTimeout(resolve, 0));
			while (encoder.encodeQueueSize > 3 && !signal.aborted && !failure);
		}
		await encoder.flush();
		if (failure) throw failure;
		if (signal.aborted) return null;
		muxer.finalize();
		return new Blob([target.buffer], { type: "video/mp4" });
	} catch (error) {
		if (signal.aborted) return null;
		throw error;
	} finally {
		signal.removeEventListener("abort", stop);
		stop();
		frame.width = 0;
	}
}

/** Words onto lines no wider than `maxWidth`. */
function shareWrap(ctx, text, maxWidth) {
	const lines = [];
	let line = "";
	for (const word of text.split(/\s+/)) {
		const next = line ? `${line} ${word}` : word;
		if (line && ctx.measureText(next).width > maxWidth) {
			lines.push(line);
			line = word;
		} else line = next;
	}
	if (line) lines.push(line);
	return lines;
}

/**
 * The background of story and picture: white with a soft yellow glow behind
 * the badge, the same for every team and theme.
 */
function shareBackdrop(ctx, w, h, glowY, glowR) {
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, w, h);
	const glow = ctx.createRadialGradient(w / 2, glowY, 0, w / 2, glowY, glowR);
	glow.addColorStop(0, "rgba(251,225,34,.22)");
	glow.addColorStop(1, "rgba(251,225,34,0)");
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, w, h);
}

/**
 * The badge's name on at most two lines, smaller if it needs to be, and
 * "erreicht am …" below it; `y` is the first line's baseline.
 */
function shareCaption(ctx, source, font, w, y, nameSize, maxWidth) {
	ctx.textAlign = "center";
	ctx.textBaseline = "alphabetic";
	let size = nameSize;
	let lines;
	for (;;) {
		ctx.font = `600 ${size}px ${font}`;
		lines = shareWrap(ctx, source.name, maxWidth);
		const fits =
			lines.length <= 2 &&
			lines.every((line) => ctx.measureText(line).width <= maxWidth);
		if (fits || size <= nameSize * 0.5) break;
		size *= 0.92;
	}
	ctx.fillStyle = "#1c1b13";
	for (const line of lines.slice(0, 2)) {
		ctx.fillText(line, w / 2, y, maxWidth);
		y += nameSize * 1.2;
	}
	ctx.fillStyle = "#6b6650";
	ctx.font = `400 ${nameSize * 0.55}px ${font}`;
	ctx.fillText(source.earned, w / 2, y, maxWidth);
}

/** The team's app icon and name, centred on `y` (research R3). */
function shareMark(ctx, app, icon, font, w, y, size) {
	ctx.font = `600 ${size * 0.55}px ${font}`;
	const textWidth = ctx.measureText(app).width;
	const total = (icon ? size * 1.3 : 0) + textWidth;
	let x = (w - total) / 2;
	if (icon) {
		ctx.drawImage(icon, x, y - size / 2, size, size);
		x += size * 1.3;
	}
	ctx.fillStyle = "#6b6650";
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	ctx.fillText(app, x, y);
}

/** "RynkePoints" → "rynkepoints", for file names. */
function shareSlug(text) {
	return (
		text
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "badge"
	);
}

/** The badge's place on a photo: its centre and width as fractions (R2). */
const SHARE_PLACE = { x: 0.78, y: 0.78, w: 0.38 };
/** The long side of a shared photo, at most (research R2). */
const SHARE_PHOTO_MAX = 1920;

function sharePlace(place) {
	const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
	return {
		x: clamp(place.x, 0, 1),
		y: clamp(place.y, 0, 1),
		w: clamp(place.w, 0.15, 0.9),
	};
}

/**
 * The rider's photo, upright and at most SHARE_PHOTO_MAX on its long side,
 * on a canvas; null if the browser can't read it (research R11). The decoded
 * bitmap is closed at once; only the canvas is kept.
 */
async function shareReadPhoto(file) {
	let bitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		// Older browsers know no "from-image"; they turn photos upright anyway.
		try {
			bitmap = await createImageBitmap(file);
		} catch {
			return null;
		}
	}
	const scale = Math.min(
		1,
		SHARE_PHOTO_MAX / Math.max(bitmap.width, bitmap.height),
	);
	const photo = shareCanvas(bitmap.width * scale, bitmap.height * scale);
	photo.getContext("2d").drawImage(bitmap, 0, 0, photo.width, photo.height);
	bitmap.close();
	return photo;
}

function shareCanFiles(file) {
	try {
		return Boolean(navigator.canShare?.({ files: [file] }));
	} catch {
		return false;
	}
}

function badgeShare(signal) {
	const sheet = document.querySelector("dialog.share-sheet");
	if (!sheet || typeof sheet.showModal !== "function") return;
	const on = { signal };
	const canvas = sheet.querySelector(".share-preview canvas");
	const ctx = canvas.getContext("2d");
	const preview = sheet.querySelector(".share-preview");
	const empty = sheet.querySelector(".share-photo-empty");
	const unreadable = sheet.querySelector(".share-photo-unreadable");
	const picker = sheet.querySelector(".share-file");
	const repick = sheet.querySelector(".share-repick");
	const hintTouch = sheet.querySelector(".share-hint-touch");
	const hintMouse = sheet.querySelector(".share-hint-mouse");
	const mouse = window.matchMedia("(hover: hover) and (pointer: fine)");
	const plain = sheet.querySelector(".share-plain [role=switch]");
	const shinyOption = sheet.querySelector(".share-shiny");
	const shiny = shinyOption.querySelector("[role=switch]");
	const video = sheet.querySelector(".share-preview video");
	const busy = sheet.querySelector(".share-busy");
	const still = window.matchMedia("(prefers-reduced-motion: reduce)");
	const status = sheet.querySelector(".share-status");
	const send = sheet.querySelector(".share-send");
	const save = sheet.querySelector(".share-save");
	const copy = sheet.querySelector(".share-copy");
	const actions = [send, save, copy];
	const font =
		getComputedStyle(document.documentElement)
			.getPropertyValue("--md-ref-typeface")
			.trim() || "sans-serif";
	const app = sheet.dataset.app ?? "";
	let icon = null;
	let iconLoad = null;
	const loadIcon = () => {
		iconLoad ??= shareLoadImage(sheet.dataset.icon)
			.then((image) => {
				icon = image;
			})
			.catch(() => {});
		return iconLoad;
	};

	const state = {
		source: null,
		assets: null,
		format: "story",
		file: null,
		/** The rider's photo on a canvas, and the badge's place on it. */
		photo: null,
		place: null,
		unreadable: false,
		/** Blob URLs handed to "Speichern", revoked at the latest on close. */
		urls: new Set(),
		/** Counts the files asked for, so a late one for old settings is dropped. */
		run: 0,
		/** The video being made, and the preview's URL of the one made. */
		encoding: null,
		videoUrl: null,
	};
	const checked = (toggle) => toggle.getAttribute("aria-checked") === "true";
	const sticker = () => state.format === "image" && checked(plain);
	const kind = () => (sticker() ? "sticker" : state.format);

	/** The output's size for the current format (contracts/files.md). */
	function size() {
		const { photo } = state;
		if (state.format === "story") return [1080, 1920];
		if (state.format === "photo" && photo) return [photo.width, photo.height];
		return [1080, 1080];
	}

	/** Where the badge goes on a w × h output: its top left and size. */
	function badgeBox(w, h) {
		if (state.format === "photo") {
			const place = state.place ?? SHARE_PLACE;
			const size = place.w * w;
			return { x: place.x * w - size / 2, y: place.y * h - size / 2, size };
		}
		if (state.format === "story")
			return { x: (w - 820) / 2, y: 390, size: 820 };
		if (sticker())
			return { x: (w * 0.14) / 2, y: (h - w * 0.86) / 2, size: w * 0.86 };
		return { x: (w - 600) / 2, y: 80, size: 600 };
	}

	/** The still picture on a w × h canvas; the video adds its sparkle to it. */
	function paint(c, w, h) {
		c.clearRect(0, 0, w, h);
		const { assets, source, photo } = state;
		if (!assets || !source) return false;
		const box = badgeBox(w, h);
		if (state.format === "photo") {
			// The photo with the badge, and nothing else (contracts/files.md).
			if (!photo) return false;
			c.drawImage(photo, 0, 0);
		} else if (state.format === "story") {
			// Nothing but the background outside 250…1670 px, where the
			// story apps put their own bars (FR-017).
			shareBackdrop(c, w, h, 800, 760);
			shareCaption(c, source, font, w, 1380, 76, 920);
			shareMark(c, app, icon, font, w, 1630, 64);
		} else if (!sticker()) {
			shareBackdrop(c, w, h, 380, 500);
			shareCaption(c, source, font, w, 790, 56, 960);
			shareMark(c, app, icon, font, w, 1010, 48);
		}
		shareDrawBadge(c, assets, box.x, box.y, box.size);
		return true;
	}

	function draw() {
		const [w, h] = size();
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		paint(ctx, w, h);
	}

	/** Stops a video being made and takes the made one out of the preview. */
	function stopVideo() {
		state.encoding?.abort();
		state.encoding = null;
		busy.hidden = true;
		if (state.videoUrl) {
			video.pause();
			video.removeAttribute("src");
			video.load();
			URL.revokeObjectURL(state.videoUrl);
			state.videoUrl = null;
		}
		video.hidden = true;
		canvas.hidden = false;
	}

	/** Makes the video for the current settings at w × h (FR-023 to FR-026). */
	async function makeVideo(run, w, h) {
		const controller = new AbortController();
		state.encoding = controller;
		busy.hidden = false;
		const frame = shareCanvas(w, h);
		try {
			if (!paint(frame.getContext("2d"), w, h)) return;
			const blob = await shareEncode(
				frame,
				state.assets,
				badgeBox(w, h),
				controller.signal,
			);
			if (run !== state.run || !blob || !state.source) return;
			state.file = new File(
				[blob],
				`${shareSlug(app)}-${state.source.id}-${kind()}.mp4`,
				{ type: "video/mp4" },
			);
			state.videoUrl = URL.createObjectURL(state.file);
			video.src = state.videoUrl;
			// Reduced motion: the rider starts it, if they want (FR-026).
			video.controls = still.matches;
			video.hidden = false;
			canvas.hidden = true;
			if (!still.matches) video.play().catch(() => {});
			send.hidden = !shareCanFiles(state.file);
			for (const button of [send, save]) button.disabled = false;
		} catch {
			// The browser said yes but can't after all: no "Glitzernd" at this
			// size any more, and the still picture instead (FR-024).
			shareVideoSizes.set(`${w}x${h}`, Promise.resolve(false));
			if (run === state.run) {
				prepare();
				status.textContent = sheet.dataset.failed ?? "";
			}
		} finally {
			frame.width = 0;
			if (state.encoding === controller) {
				state.encoding = null;
				busy.hidden = true;
			}
		}
	}

	/** Draws the preview and makes its file; the actions wait for it. */
	async function prepare() {
		const run = ++state.run;
		stopVideo();
		state.file = null;
		status.textContent = "";
		for (const button of actions) button.disabled = true;
		const onPhoto = state.format === "photo";
		const placing = onPhoto && Boolean(state.photo);
		sheet.querySelector(".share-plain").hidden = state.format !== "image";
		empty.hidden = !onPhoto || placing;
		unreadable.hidden = !state.unreadable;
		repick.hidden = !placing;
		hintTouch.hidden = !placing || mouse.matches;
		hintMouse.hidden = !placing || !mouse.matches;
		preview.dataset.format = state.format;
		draw();
		if (!state.assets || (onPhoto && !placing)) {
			shinyOption.hidden = true;
			return;
		}
		// H.264 needs even sides: an odd photo loses its last row or column.
		const [w, h] = size().map((side) => side - (side % 2));
		const sparkling = !sticker() && (await shareCanVideo(w, h));
		if (run !== state.run) return;
		shinyOption.hidden = !sparkling;
		copy.hidden = true;
		if (sparkling && checked(shiny)) return makeVideo(run, w, h);
		const blob = await new Promise((resolve) =>
			canvas.toBlob(resolve, "image/png"),
		);
		if (run !== state.run || !blob || !state.source) return;
		state.file = new File(
			[blob],
			`${shareSlug(app)}-${state.source.id}-${kind()}.png`,
			{ type: "image/png" },
		);
		send.hidden = !shareCanFiles(state.file);
		copy.hidden = !(window.ClipboardItem && navigator.clipboard?.write);
		for (const button of actions) button.disabled = false;
	}

	for (const radio of sheet.querySelectorAll("input[name=share-format]")) {
		radio.addEventListener(
			"change",
			() => {
				state.format = radio.value;
				prepare();
			},
			on,
		);
	}
	for (const toggle of [plain, shiny]) {
		toggle.addEventListener(
			"click",
			() => {
				toggle.setAttribute("aria-checked", String(!checked(toggle)));
				prepare();
			},
			on,
		);
	}

	send.addEventListener(
		"click",
		() => {
			if (!state.file || !state.source) return;
			navigator
				.share({ files: [state.file], text: state.source.shareText })
				.catch((error) => {
					// The rider closed the share sheet: nothing to say.
					if (error?.name === "AbortError") return;
					status.textContent = sheet.dataset.failed ?? "";
					save.focus();
				});
		},
		on,
	);
	save.addEventListener(
		"click",
		() => {
			if (!state.file) return;
			const link = document.createElement("a");
			const url = URL.createObjectURL(state.file);
			state.urls.add(url);
			link.href = url;
			link.download = state.file.name;
			link.click();
			setTimeout(() => {
				URL.revokeObjectURL(url);
				state.urls.delete(url);
			}, 10_000);
			status.textContent = sheet.dataset.saved ?? "";
		},
		on,
	);
	copy.addEventListener(
		"click",
		() => {
			if (!state.file) return;
			navigator.clipboard
				.write([new ClipboardItem({ "image/png": state.file })])
				.then(() => {
					status.textContent = sheet.dataset.copied ?? "";
				})
				.catch(() => {
					status.textContent = sheet.dataset.failed ?? "";
				});
		},
		on,
	);

	/** Lets the photo go: the canvas is emptied, so its memory is freed. */
	function dropPhoto() {
		if (state.photo) state.photo.width = 0;
		state.photo = null;
	}

	async function pickPhoto(file) {
		const source = state.source;
		const photo = await shareReadPhoto(file);
		if (state.source !== source || !source) {
			if (photo) photo.width = 0;
			return;
		}
		dropPhoto();
		state.photo = photo;
		state.unreadable = !photo;
		// A new photo keeps the badge's place and size (US2 scenario 6).
		if (photo) state.place ??= { ...SHARE_PLACE };
		prepare();
	}

	for (const button of [sheet.querySelector(".share-pick"), repick]) {
		button.addEventListener("click", () => picker.click(), on);
	}
	picker.addEventListener(
		"change",
		() => {
			const file = picker.files?.[0];
			picker.value = "";
			if (file) pickPhoto(file);
		},
		on,
	);

	/** The badge moved: the old file no longer fits, the new one comes later. */
	function moved(place) {
		state.place = sharePlace(place);
		state.run++;
		stopVideo();
		state.file = null;
		for (const button of actions) button.disabled = true;
		draw();
	}
	const placing = () =>
		state.format === "photo" && state.photo && state.assets && state.place;

	// One pointer drags the badge, two pinch it; it follows the pointer in
	// the photo's own pixels, however small the preview shows it.
	const pointers = new Map();
	let gesture = null;
	const startGesture = () => {
		const [a, b] = [...pointers.values()];
		gesture = {
			place: { ...state.place },
			a: { ...a },
			span: b ? Math.hypot(b.x - a.x, b.y - a.y) : 0,
		};
	};
	// The badge is dragged on the picture or, with "Glitzernd", on its video,
	// which gives way to the still picture until the badge is let go.
	const onPicture = (event) =>
		event.target === canvas || event.target === video;
	preview.addEventListener(
		"pointerdown",
		(event) => {
			if (!placing() || !onPicture(event)) return;
			event.preventDefault();
			preview.setPointerCapture?.(event.pointerId);
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			startGesture();
		},
		on,
	);
	preview.addEventListener(
		"pointermove",
		(event) => {
			if (!gesture || !pointers.has(event.pointerId)) return;
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			const box = canvas.getBoundingClientRect();
			const [a, b] = [...pointers.values()];
			if (b && gesture.span) {
				const span = Math.hypot(b.x - a.x, b.y - a.y);
				moved({ ...gesture.place, w: (gesture.place.w * span) / gesture.span });
			} else if (!b) {
				moved({
					...gesture.place,
					x: gesture.place.x + (a.x - gesture.a.x) / box.width,
					y: gesture.place.y + (a.y - gesture.a.y) / box.height,
				});
			}
		},
		on,
	);
	const release = (event) => {
		if (!pointers.delete(event.pointerId)) return;
		if (pointers.size) startGesture();
		else {
			gesture = null;
			// A tap that moved nothing keeps the file, or the video being made.
			if (placing() && !state.file && !state.encoding) prepare();
		}
	};
	preview.addEventListener("pointerup", release, on);
	preview.addEventListener("pointercancel", release, on);
	// The mouse wheel scales the badge; the file follows once it rests.
	let wheelRest = 0;
	preview.addEventListener(
		"wheel",
		(event) => {
			if (!placing() || !onPicture(event)) return;
			event.preventDefault();
			const lines = event.deltaMode === 1 ? 16 : 1;
			const place = state.place;
			moved({
				...place,
				w: place.w * Math.exp(-event.deltaY * lines * 0.0015),
			});
			clearTimeout(wheelRest);
			wheelRest = setTimeout(() => {
				if (placing()) prepare();
			}, 250);
		},
		{ signal, passive: false },
	);

	sheet
		.querySelector(".share-sheet-close")
		.addEventListener("click", () => sheet.close(), on);
	// A click on the backdrop lands on the dialog itself, outside its box.
	sheet.addEventListener(
		"click",
		(event) => {
			if (event.target !== sheet) return;
			const box = sheet.getBoundingClientRect();
			const inside =
				event.clientX >= box.left &&
				event.clientX <= box.right &&
				event.clientY >= box.top &&
				event.clientY <= box.bottom;
			if (!inside) sheet.close();
		},
		on,
	);
	sheet.addEventListener(
		"close",
		() => {
			state.run++;
			stopVideo();
			state.source = null;
			state.assets = null;
			state.file = null;
			// Nothing of the rider's photo stays behind (FR-022).
			dropPhoto();
			state.place = null;
			state.unreadable = false;
			picker.value = "";
			pointers.clear();
			gesture = null;
			clearTimeout(wheelRest);
			for (const url of state.urls) URL.revokeObjectURL(url);
			state.urls.clear();
		},
		on,
	);

	/** Opens the sheet for the badge whose large view is `large`, as a story. */
	async function open(large) {
		const texts = large.querySelectorAll(":scope > p");
		const source = {
			id: large.id.replace(/^badge-/, ""),
			name: large.querySelector("h4")?.textContent ?? "",
			earned: texts[texts.length - 1]?.textContent ?? "",
			shareText: large.querySelector(".badge-share")?.dataset.shareText ?? "",
		};
		state.source = source;
		state.assets = null;
		state.format = "story";
		for (const radio of sheet.querySelectorAll("input[name=share-format]")) {
			radio.checked = radio.value === "story";
		}
		plain.setAttribute("aria-checked", "false");
		shiny.setAttribute("aria-checked", "false");
		// "Glitzernd" is offered once the muxer is here (research R5).
		const muxer = window.Mp4Muxer ? null : shareLoadMuxer();
		if (large.matches(":popover-open")) large.hidePopover();
		if (!sheet.open) sheet.showModal();
		prepare();
		try {
			const [assets] = await Promise.all([shareBadgeAssets(large), loadIcon()]);
			if (state.source !== source) return;
			state.assets = assets;
			prepare();
			muxer?.then(() => {
				if (state.source === source && state.assets) prepare();
			});
		} catch {
			if (state.source === source) {
				status.textContent = sheet.dataset.failed ?? "";
			}
		}
	}

	for (const button of document.querySelectorAll(".badge-large .badge-share")) {
		button.addEventListener(
			"click",
			() => open(button.closest(".badge-large")),
			on,
		);
	}
	for (const button of document.querySelectorAll(".badge-share-mini")) {
		// The share button never sits under a preview the hover opened (FR-005).
		button.addEventListener(
			"pointerenter",
			() => {
				for (const large of document.querySelectorAll(
					".badge-large-hover:popover-open",
				)) {
					large.hidePopover();
				}
			},
			on,
		);
		button.addEventListener(
			"click",
			() => {
				const large = document.getElementById(`badge-${button.dataset.badge}`);
				if (large) open(large);
			},
			on,
		);
	}
}

function enhance(signal) {
	lazyRides(signal);
	installSettings(signal);
	showsSetting();
	waitForFirstData(signal);
	followFetching(signal);
	badgeHover();
	badgeShare(signal);
	triState();
	badgeSwitch(signal);
	notifications(signal).catch(() => {});
	progressCharts(signal);
	organiserRiders(signal);
	organiserGraphs(signal);
	usageGraphs(signal);
}

const registered = registerWorker();
swapViews();
pressFeedback();
pendingSubmit();
appPrompt();
themeMenu();
refreshOnReturn();
pageLoading();
pageSwitchShows();
swipeSections();
enhance(content.signal);
scrollToNewBadge();
