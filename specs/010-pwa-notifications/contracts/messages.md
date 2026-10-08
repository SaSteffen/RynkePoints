# Contract: Catalog Keys

**Feature**: [../spec.md](../spec.md) | **Research**: R2, R3, R8, R11, R14

New keys in `src/i18n/messages/de.ts` and `en.ts` (FR-031). The wording is a
proposal; the tasks may polish it, but the key set and the rules below are
fixed. Tests assert the German text.

| Key | de | en |
|---|---|---|
| `install.button` | Als App installieren | Install as an app |
| `install.ios` | Als App auf dem iPhone: Tippe in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“. | As an app on your iPhone: in Safari, tap "Share" and then "Add to Home Screen". |
| `install.dismiss` | Ausblenden | Dismiss |
| `notifications.heading` | Benachrichtigungen | Notifications |
| `notifications.explain` | Auf Wunsch sagt dir dieses Gerät Bescheid, wenn du neue Rynke hast: wie viele und was dir noch fehlt. | If you like, this device lets you know when you have new Rynke: how many, and what you still need. |
| `notifications.on` | Benachrichtigungen sind auf diesem Gerät an. | Notifications are on for this device. |
| `notifications.off` | Benachrichtigungen sind auf diesem Gerät aus. | Notifications are off for this device. |
| `notifications.turnOn` | Benachrichtigungen einschalten | Turn on notifications |
| `notifications.turnOff` | Benachrichtigungen ausschalten | Turn off notifications |
| `notifications.blocked` | Benachrichtigungen bleiben aus, weil dein Gerät sie für RynkePoints blockiert. Du kannst sie in den Einstellungen des Browsers oder Geräts erlauben. | Notifications stay off because your device blocks them for RynkePoints. You can allow them in your browser's or device's settings. |
| `notifications.needsHomeScreen` | Auf dem iPhone gibt es Benachrichtigungen nur, wenn RynkePoints auf dem Home-Bildschirm liegt. Öffne es dann von dort. | On an iPhone, notifications only work once RynkePoints is on your home screen. Then open it from there. |
| `notifications.unsupported` | Dieser Browser kann keine Benachrichtigungen anzeigen. | This browser can't show notifications. |
| `notifications.failed` | Das hat nicht geklappt. Versuch es bitte noch einmal. | That didn't work. Please try again. |
| `push.body` | Neue Rynke – tippe zum Ansehen | New Rynke – tap to view |
| `push.body.rise` | Neue Rynke: {rise}. | New Rynke: {rise}. |
| `push.body.riseMissing` | Neue Rynke: {rise}. Dir fehlen noch {missing}. | New Rynke: {rise}. You still need {missing}. |
| `push.rise.training` | +{n} Trainingsrynke | +{n} Training Rynke |
| `push.rise.team` | +{n} Teamrynke | +{n} Team Rynke |
| `offline.title` | Keine Verbindung | No connection |
| `offline.body` | RynkePoints braucht eine Internetverbindung. Versuch es gleich noch einmal. | RynkePoints needs an internet connection. Please try again shortly. |
| `landing.notifications` | Benachrichtigungen sind freiwillig und gelten pro Gerät. Sie zeigen nur auf deinem Gerät, wie viele Rynke neu sind und was dir noch fehlt. Sie laufen über den Benachrichtigungsdienst des Geräte- oder Browserherstellers (z. B. Google, Apple, Mozilla, Microsoft). Wir speichern dafür nur die Adresse, die dieser Dienst deinem Gerät gibt, und löschen sie, wenn du die Benachrichtigungen ausschaltest, dich abmeldest oder gehst. | Notifications are optional and per device. Only on your device do they show how many Rynke are new and what you still need. They pass through the push service of your device's or browser's maker (e.g. Google, Apple, Mozilla, Microsoft). For this we store only the address that service gives your device, and delete it when you turn notifications off, sign out or leave. |

Rules:

- **Notification title**: the existing `app.name` ("RynkePoints" in every
  language, FR-032). There is no new key.
- **`push.body`**: must contain no placeholder. `catalogs.test.ts` asserts that
  it has no `{` in any language (SC-008).
- **Where the text appears**: `install.*` and `notifications.*` are rendered
  into the hidden markup of [client.md](client.md), never written by script.
  `push.body` and `app.name` reach the device only through
  `/notification-text`; `push.body.rise*` and `push.rise.*` only through the signed-in
  `/me/notification-text`.
- **Consent version**: `CONSENT_VERSION` stays 1. A comment in
  `src/consent.ts` names research R14 as the reason.
