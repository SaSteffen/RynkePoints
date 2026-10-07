// RynkePoints page script (feature 010 contracts/client.md, research R16). It
// only wires up what a server-rendered page can't do itself: the service worker
// and the install prompt. It holds no text: every word shown comes from the
// page's markup, rendered from the catalogs and hidden until this shows it.

function registerWorker() {
	if (!("serviceWorker" in navigator)) return;
	const lang = encodeURIComponent(document.documentElement.lang);
	navigator.serviceWorker
		.register(`/sw.js?lang=${lang}`, { scope: "/" })
		.catch(() => {});
}

/** The hint on `/` and `/me` (FR-004, research R11). */
function installHint() {
	const hint = document.getElementById("install");
	const DISMISSED = "rp-install-dismissed";
	const standalone =
		matchMedia("(display-mode: standalone)").matches ||
		navigator.standalone === true;
	if (!hint || standalone || localStorage.getItem(DISMISSED)) return;

	const prompt = hint.querySelector('[data-install="prompt"]');
	let deferred = null;
	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferred = event;
		prompt.hidden = false;
		hint.hidden = false;
	});
	prompt.querySelector("button").addEventListener("click", () => {
		hint.hidden = true;
		deferred?.prompt();
		deferred = null;
	});

	// Only Safari on iOS defines it, and false means "not on the home screen".
	if (navigator.standalone === false) {
		hint.querySelector('[data-install="ios"]').hidden = false;
		hint.hidden = false;
	}

	window.addEventListener("appinstalled", () => {
		hint.hidden = true;
	});
	hint
		.querySelector('[data-install="dismiss"]')
		.addEventListener("click", () => {
			localStorage.setItem(DISMISSED, "1");
			hint.hidden = true;
		});
}

registerWorker();
installHint();
