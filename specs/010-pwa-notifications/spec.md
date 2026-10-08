# Feature Specification: Installable App and Notifications for New Rynke

**Feature Branch**: `010-pwa-notifications`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Supply the application as a PWA also, so it can be used
on a smartphone better. Ideally show a notification whenever new RynkePoints are
earned. It doesn't need to be usable offline."

## Clarifications

### Session 2026-10-07

- Q: Which changes raise a notification? → A: Every rise of a rider's Training Rynke
  or Team Rynke total caused by a ride, team-event attendance or an organiser
  correction. Recalculations after a rule change send none.
- Q: What may a notification show on the lock screen? → A: Only that there are new
  Rynke ("Neue Rynke – tippe zum Ansehen"): no amounts, totals, qualification or
  ride name. The rider sees the details in the app.
- Q: Should this feature also deliver issue #20 (every page phone friendly)? → A: No.
  Issue #20 stays a separate change; this feature only makes its own parts work on
  phones.
- Q: Should installing and notifications ship as separate releases? → A: No. Both
  ship together in one release, kept simple.
- Q: When a rider's sign-in on a device runs out, does that device keep getting
  notifications? → A: Yes, until the rider signs out there, turns them off, leaves,
  or the device is gone. Also, a sign-in lasts until 180 days (half a year) after
  the rider last used the app on that device, instead of 30 days after signing in.
- Q: Are notifications held back at night? → A: No. They are sent as soon as the
  new Rynke are stored, at any time; the phone's own Do Not Disturb handles the
  night.

### Session 2026-10-08 (issue #45)

- Q: May a notification say more than that there are new Rynke? → A: Yes: how many
  Training and Team Rynke the change earned, then what the rider still needs, like
  the rider page's list ("Neue Rynke: +3 Trainingsrynke. Dir fehlen noch 16
  Trainingsrynke und 2 Teamrynke."). Once nothing is missing it names only the new
  Rynke ("Neue Rynke: +3 Trainingsrynke."); it never says the rider is in. The push
  itself stays empty: the device fetches the text from RynkePoints, so the
  notification service still learns nothing. This supersedes the 2026-10-07 answer
  on the lock screen.
- Q: Does the import of a new rider's earlier season rides send a notification? →
  A: No, neither the import nor the one-time re-read sends any.

## User Scenarios & Testing *(mandatory)*

The **installed app** is RynkePoints added to a phone's home screen (or a computer's
app list) from the browser: it opens from its own icon, in its own window without the
browser's address bar, and shows the same pages as the website. It is not a separate
app from an app store, and it needs a connection to work, like the website.

A **notification** is a message the phone or computer shows outside the app (on the
lock screen, in the notification list) when the rider has earned new Rynke, even
while the app is closed. A rider turns notifications on per device; a **device** here
is one browser or installed app on one phone or computer.

**New Rynke** are an increase of the rider's stored Training Rynke or Team Rynke total
(feature 003, User Story 4) caused by a new or updated ride, recorded team-event
attendance or an organiser correction. A recalculation after a rule change (feature
003, User Story 5) doesn't count as new Rynke.

### User Story 1 - Install RynkePoints on the phone (Priority: P1)

A rider opens RynkePoints in their phone's browser and is offered to add it to the
home screen. From then on they open it from its icon like any other app: it starts on
their rider page, fills the screen without the browser's bars, and shows the
RynkePoints name and icon in the app switcher.

**Why this priority**: Riders mostly look at their Rynke on the phone (issue
[#20](https://github.com/SaSteffen/RynkePoints/issues/20)); an icon on the home screen
saves typing the address and signing in through the browser every time. On iPhones
it is also the precondition for notifications (Story 2).

**Independent Test**: Open the deployed site on an Android phone and an iPhone, add
it to the home screen as the page explains, open it from the icon, and check that it
starts on the rider page in its own window, signed in after the first sign-in, in
German and in English.

**Acceptance Scenarios**:

1. **Given** a visitor on a phone whose browser can install web apps, **When** they
   open any RynkePoints page, **Then** they can add RynkePoints to the home screen,
   either through the browser's own offer or a button on the page.
2. **Given** a visitor on an iPhone, whose browser doesn't offer installing by
   itself, **When** they open the rider page or the public page, **Then** they find a
   short explanation of how to add RynkePoints to the home screen.
3. **Given** RynkePoints is installed, **When** the rider opens it from the icon,
   **Then** it shows their rider page if they are signed in, or the public page with
   "Connect with Strava" if not, without the browser's address bar.
4. **Given** a rider who isn't signed in in the installed app, **When** they sign in
   with Strava from there, **Then** they come back to the installed app signed in,
   not to a separate browser window.
5. **Given** RynkePoints is already installed or opened from the icon, **When** the
   rider looks at the page, **Then** no install offer or explanation is shown.
6. **Given** the installed app and no connection, **When** the rider opens it,
   **Then** it shows a short notice that a connection is needed, in the rider's
   language, and no rider data.

---

### User Story 2 - Get a notification for new Rynke (Priority: P2)

A rider uploads a ride to Strava after their evening loop. A few minutes later their
phone shows "RynkePoints: Neue Rynke – tippe zum Ansehen". They tap it and the
installed app opens on their rider page with the new totals.

**Why this priority**: This is the "ideally" of the request: it brings riders back to
the app when something changed, without them checking. It builds on Story 1, because
iPhones only deliver such notifications to installed apps.

**Independent Test**: In the local app with the fake Strava (feature 006), turn
notifications on in a browser, send a synthetic ride that earns Rynke, and check that
the browser shows one notification in the page's language, without any figures, and
that tapping it opens the rider page.

**Acceptance Scenarios**:

1. **Given** a rider with notifications on for a device, **When** a new ride of
   theirs earns 7 Training Rynke, **Then** that device shows one notification that
   there are new Rynke, without the amount, within the time of SC-001.
2. **Given** a rider with notifications on, **When** a ride arrives that earns no
   Rynke (e.g. too slow, or a walk), **Then** no notification is shown.
3. **Given** a rider whose 78 km phone recording already counted, **When** the 80 km
   bike computer recording of the same ride replaces it (feature 003, overlap),
   **Then** at most one notification is shown for the net change (+1), not a second
   one as if 8 Rynke were new.
4. **Given** Strava delivers the same ride twice, **When** both deliveries are
   processed, **Then** the rider gets one notification, not two (Principle II).
5. **Given** a 9 km ride that earns no distance Rynke but takes the season's
   elevation total past the next 1000 m, **When** it is evaluated, **Then** the rider
   gets a notification, because their total rose (elevation Rynke belong to the
   total, feature 003, FR-004a).
6. **Given** an organiser records the rider's attendance at a team training or adds
   a positive correction, **When** the rider's total rises, **Then** the rider gets a
   notification like for a ride.
7. **Given** a notification on the lock screen, **When** anyone looks at it,
   **Then** it shows how many Rynke are new and what the rider still needs, or only
   the new Rynke once nothing is missing; never the qualification or a ride name
   (FR-015).
8. **Given** a rider with notifications on for their phone and their computer,
   **When** they earn new Rynke, **Then** both devices show the notification.
9. **Given** a notification on the lock screen, **When** the rider taps it, **Then**
   the installed app (or the browser, if not installed) opens on the rider page, which
   asks them to sign in first if their sign-in has ended.
10. **Given** a rider earns Rynke several times before looking at the phone, **When**
    they look, **Then** they see one RynkePoints notification, not a stack of them
    (FR-017).

---

### User Story 3 - Turn notifications on and off (Priority: P2)

On their rider page a rider sees whether notifications are on for the device they are
using. They tap "Benachrichtigungen einschalten", the phone asks for permission, and
the page confirms they are on. Later they turn them off there again, on this device
only.

**Why this priority**: Needed together with Story 2: browsers only allow
notifications after the rider agrees, and riders must be able to stop them at any
time.

**Independent Test**: In the local app, turn notifications on, check the page shows
them as on, earn Rynke and get a notification; turn them off, earn Rynke again and
get none. Repeat with the browser's permission denied and check the page explains it.

**Acceptance Scenarios**:

1. **Given** a signed-in rider on a device where notifications are possible and off,
   **When** they open the rider page, **Then** they see that notifications are off
   for this device and a button to turn them on; the browser doesn't ask by itself.
2. **Given** the rider presses the button, **When** they allow notifications in the
   browser's question, **Then** the page shows them as on for this device.
3. **Given** the rider presses the button, **When** they decline in the browser's
   question, **Then** the page says notifications stay off and how to allow them in
   the device's settings, and nothing is stored.
4. **Given** notifications are on for this device, **When** the rider turns them off
   on the rider page, **Then** this device gets no more notifications and the rider's
   other devices are unaffected.
5. **Given** an iPhone browser tab, not the installed app, **When** the rider opens
   the rider page, **Then** the page says notifications need RynkePoints on the home
   screen and points to the explanation of Story 1, instead of offering a button
   that cannot work.
6. **Given** a browser that can't show notifications at all, **When** the rider
   opens the rider page, **Then** no button is offered and the rest of the page works
   as before.
7. **Given** a rider signs out on a device, **When** they earn new Rynke, **Then**
   that device gets no notification.
8. **Given** a rider leaves (disconnects, revokes access on Strava, or leaves the
   club), **When** their data is deleted, **Then** every notification registration
   of theirs is deleted with it and no device gets another notification.

### Edge Cases

- **Rynke go down** (ride deleted, ride no longer counts, negative correction): no
  notification. The rider page shows the new totals as before.
- **Ride replaced by a shorter overlapping recording**: the net change is negative or
  zero, so no notification.
- **Rule change recalculates every balance**: no notification, also when a rider's
  total rises by it (FR-016). The rider page shows the new totals and the rules
  version as before (feature 005, FR-050, FR-051).
- **Ride evaluated during a recalculation**: a new ride, attendance or correction
  processed while a recalculation runs notifies as usual, but only for its own
  change, not for what the new rules added.
- **Past-season import or the one-time re-read** (feature 001; feature 008, FR-006):
  rides stored when a rider first connects or re-read later are not "new"; neither
  sends any notification (FR-016).
- **Ride evaluated while the qualification deadline has passed**: it earns nothing
  (feature 003), so no notification.
- **Rider qualifies**: the notification is the same as for any new Rynke; the rider
  page shows that they qualify (feature 005, FR-011).
- **Notification service unreachable or the device unreachable**: the Rynke are
  stored as always; the notification is retried for a limited time and then dropped.
  Notifications never delay or block the evaluation (FR-018).
- **Device registration no longer valid** (app uninstalled, browser data cleared,
  permission withdrawn in the device's settings): the system learns it from the
  notification service, deletes the registration and stops sending to it.
- **Rider withdrew permission in the device's settings but the page still says on**:
  the next visit to the rider page on that device shows notifications as off.
- **Rider signed in on a shared or borrowed phone**: notifications go only to devices
  where the rider turned them on themselves; signing out there stops them (Story 3,
  scenario 7).
- **Two riders on one device, one after the other**: the device receives
  notifications only for the rider who turned them on last on it while signed in.
- **Sign-in ended (180 days without use, FR-007) while notifications are on**:
  notifications keep coming until the rider signs out there, turns them off or
  leaves (FR-013); tapping one asks the rider to sign in again.
- **New Rynke at night** (late upload, evening attendance, the daily retry of
  failed work): the notification is sent straight away like any other (FR-015);
  the system keeps no quiet hours.
- **Language**: a notification is written in the language the device last showed
  RynkePoints in; if that is unknown, German.
- **Organiser views and the leaderboard**: no notifications about other riders; a
  notification only ever reports the rider's own Rynke to that rider.
- **Many riders earn Rynke at once** (e.g. organiser records attendance for a whole
  team training): every rider gets their notification; no rider gets one for someone
  else.
- **Installed app and website at the same time**: both are the same site; a rider can
  use either, and signing in on one may not sign them in on the other (the phone may
  keep them apart).

## Requirements *(mandatory)*

### Functional Requirements

**Installing**

- **FR-001**: RynkePoints MUST be installable from the browser on current Android
  phones, iPhones and desktop browsers that support installing web apps, under the
  name "RynkePoints" with its own icon.
- **FR-002**: The installed app MUST open in its own window without the browser's
  address bar and MUST start on the rider page (feature 001, FR-025), which asks
  visitors who aren't signed in to connect or sign in, as today.
- **FR-003**: Every page reachable in the installed app, including signing in with
  Strava and coming back from Strava's approval screen, MUST stay in the installed
  app. Links leaving RynkePoints (Strava activity links of feature 008, the rules
  handout if hosted elsewhere, Strava's own pages) MAY open in the browser.
- **FR-004**: Where the browser offers installing, the page MAY show its own install
  button; where it doesn't (iPhone), the public page and the rider page MUST show a
  short explanation of how to add RynkePoints to the home screen. Neither MUST be
  shown inside the installed app, and the rider MUST be able to dismiss them.
- **FR-005**: The installed app MUST NOT work offline: it MUST NOT keep rider data,
  pages with rider data or Rynke on the device for use without a connection. Without
  a connection it MUST show only a short notice that a connection is needed, in the
  rider's language.
- **FR-006**: Installing MUST NOT change what a page shows or who may see it
  (feature 004); the installed app is the same site.
- **FR-007**: A sign-in MUST last until 180 days after the rider last opened a
  RynkePoints page on that device while signed in, on the website and in the
  installed app alike; every such visit extends it to 180 days from then. After 180
  days without use it MUST end, so the rider signs in with Strava again. This
  replaces the fixed 30 days feature 001 chose (its research R9); signing out or
  leaving still ends it at once.

**Turning notifications on and off**

- **FR-010**: Notifications MUST be off until the rider turns them on for a device
  themselves, from their rider page. The system MUST NOT ask for the browser's
  permission when a page loads, only after the rider pressed the button.
- **FR-011**: The rider page MUST show, for the device in use, whether notifications
  are on, off, blocked in the device's settings (with a hint how to allow them), not
  available until RynkePoints is on the home screen (iPhone, FR-004), or not
  supported, and MUST offer turning them on or off where possible.
- **FR-012**: A rider MUST be able to turn notifications off for the device in use at
  any time; this MUST take effect for the next notification and leave their other
  devices unchanged.
- **FR-013**: Signing out on a device MUST end notifications to that device; a
  sign-in that ends by itself (FR-007) MUST NOT. Leaving
  (feature 004, FR-015; feature 001, FR-022, FR-023) MUST delete every notification
  registration of the rider together with the rest of their data.
- **FR-014**: A device registration MUST hold only what is needed to deliver the
  rider's notifications to that device and the language to write them in; it MUST
  NOT be used for anything else (no tracking, no analytics, no messages other than
  this feature's notifications).

**Sending notifications**

- **FR-015**: Whenever a rider's stored Training Rynke or Team Rynke total rises
  because of a new or updated ride, recorded team-event attendance or an organiser
  correction, the system MUST send one notification to every device the rider has
  notifications on for, as soon as the new results are stored and at any time of
  day. The notification MUST say how many Training and Team Rynke the change
  earned and what the rider still needs, as the rider page lists it (e.g. "Neue
  Rynke: +3 Trainingsrynke. Dir fehlen noch 16 Trainingsrynke und 2 Teamrynke."),
  only the new Rynke when nothing is missing (e.g. "Neue Rynke: +3
  Trainingsrynke."), and only that there are new Rynke when the device can't fetch
  the text (e.g. "Neue Rynke – tippe zum Ansehen"). It MUST NOT contain whether the rider qualifies, ride names or any
  other rider data. The push itself MUST carry no rider data: the device fetches
  the text from RynkePoints with the rider's sign-in, so nothing passes through the
  notification service (issue #45).
- **FR-016**: Changes that lower or don't change a total MUST NOT send a
  notification. A recalculation after a rule change (feature 003, User Story 5) MUST
  NOT send one either, even where it raises a total. The past-season import when a rider
  connects and the one-time re-read (feature 008, FR-006) MUST NOT send any
  notification.
- **FR-017**: A rider MUST NOT get more than one notification for one processed
  change, also when Strava delivers it more than once or it is processed again
  (Principle II). A newer notification of RynkePoints MUST replace an unread older one
  on the device rather than pile up next to it.
- **FR-018**: Sending notifications MUST happen after the rider's results are stored
  and outside of acknowledging Strava's notifications: it MUST NOT delay the webhook
  acknowledgement (Principle II), delay or fail the evaluation, or change any stored
  result. A failed notification MUST NOT be retried indefinitely.
- **FR-019**: Tapping a notification MUST open the rider page, in the installed app
  if RynkePoints is installed on that device.
- **FR-020**: A notification MUST only ever be sent to devices of the rider whose
  Rynke changed, and MUST contain nothing about other riders.
- **FR-021**: Notification registrations the notification service reports as gone
  MUST be deleted.

**Privacy, consent and language**

- **FR-030**: The privacy text (feature 004, FR-023) MUST say that notifications are
  optional, that a notification only says there are new Rynke (FR-015), that it
  passes through the notification service of the device's maker (e.g. Google,
  Apple, Mozilla) to reach the device, and what is stored per device and when it is
  deleted. The consent version MUST NOT be
  raised for this and connected riders MUST NOT be asked again (constitution
  Principle I): no new Strava permission or request is needed, and nobody but the
  rider sees anything new; turning notifications on is the rider's separate,
  optional choice per device.
- **FR-031**: All new text (install button and explanation, notification settings,
  the offline notice, the notification text) MUST come from the message
  catalogs, in every language (feature 001, FR-028). Notifications MUST be written in
  the language the device last showed RynkePoints in (feature 001, FR-029,
  FR-029a), German if unknown. Remembering it per device MUST NOT store the language
  in the rider record.
- **FR-032**: The installed app's name, short name and description shown by the
  phone MUST be "RynkePoints" in every language; any other text the phone shows
  about the app comes from the catalogs where the platform allows it.

**Phones**

- **FR-040**: The install explanation and the notification settings MUST work on a
  phone 360 pixels wide without zooming or scrolling sideways, with controls easy to
  tap (about 44 × 44 pixels), as feature 005 FR-070 and FR-072 and issue #20 require.
- **FR-041**: Pages shown in the installed app MUST leave room for the phone's status
  bar and notch, so no content or control is hidden behind them.

**Tests**

- **FR-050**: Which changes send a notification and which don't, one notification
  per change also on replays, deletion of registrations on sign-out, leaving and on
  "gone" reports, the notification text in German and English, and that the
  notification service is never contacted for real, MUST be covered by automated
  tests with synthetic riders (constitution Principles I, V). The local app (feature
  006) MUST let a developer see notifications in their own browser without real
  Strava data.

### Key Entities *(include if feature involves data)*

- **Notification registration**: one device on which a rider turned notifications
  on. Holds what the notification service needs to reach the device, the language to
  write in, and when it was turned on. Belongs to one rider; deleted when the rider
  turns notifications off there, signs out there, leaves, or the service reports the
  device gone. Not shown to anyone.
- **Sent notification** (if planning needs it): the record that a processed change
  has been notified, so a replay doesn't notify twice (FR-017). Holds no more than
  the rider, which change, and when; deleted with the rider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Under normal conditions, a rider with notifications on sees the
  notification within 5 minutes of uploading a ride that earns Rynke to Strava (the
  time feature 001 SC-002 allows for the ride to appear, plus delivery).
- **SC-002**: A rider can install RynkePoints on an Android phone and on an iPhone
  and open it from the icon on their rider page, following only what the page says,
  in under 1 minute.
- **SC-003**: Turning notifications on takes the rider at most two taps after opening
  the rider page (the button and the device's permission question).
- **SC-004**: In all tested replays and duplicate deliveries, a rider gets exactly one
  notification per change that raised a total, and none for changes that didn't.
- **SC-005**: After a rider turns notifications off on a device, signs out there, or
  leaves, that device gets 0 further notifications; after leaving, 0 notification
  registrations of theirs remain.
- **SC-006**: Strava's notifications are still acknowledged within 2 seconds in 100%
  of cases (feature 001, SC-003), with notifications turned on for every rider.
- **SC-007**: Without a connection, the installed app shows 0 rider data and the
  connection notice instead.
- **SC-008**: 0 pushes carry rider data, and 0 notifications contain the
  qualification, a ride name or any rider data beyond the new Rynke and what is
  still missing, in all
  cases tested.

## Assumptions

- Riders use phones whose browsers can install web apps and show notifications from
  them: current Android with Chrome or another browser that supports it, and iPhones
  with an iOS version that delivers notifications to web apps on the home screen
  (iOS 16.4 or later). Older devices can still use the website as today.
- iPhones deliver notifications only to RynkePoints added to the home screen, not to
  a Safari tab; Android and desktop browsers deliver them to the browser as well.
  Notifications are therefore offered in the browser too where the device allows it
  (FR-011), not only in the installed app.
- Notifications reach devices through the notification service of the browser's or
  phone's maker, which the app cannot avoid; what passes through it is protected so
  only the device can read it, the push carries no rider data (FR-015), and the privacy
  text names it (FR-030). This is not
  growth of the consent under constitution Principle I: it needs no Strava permission
  or request and shows nothing to anyone but the rider.
- Sending notifications fits Cloudflare's free tier at the team's size (at most the
  Strava capacity of riders, a few notifications per rider per day) and needs no new
  paid service (Principle IV). It needs one new production secret, which the user
  sets by hand like the others.
- Notifications are tied to the device registration, not to the sign-in: the
  system sends them from its own processing, which never needs the rider's sign-in
  (it already evaluates rides with the rider's stored Strava access). The sign-in
  only decides whether tapping a notification shows the rider page straight away.
- The longer sign-in (FR-007) needs no new consent: it is the same necessary
  sign-in cookie the privacy text already names; if that text states a duration,
  it changes with it.
- The rest of the site's phone layout (issue #20) is a separate change and not a
  precondition; this feature only requires that its own parts work on phones (FR-040,
  FR-041). Until #20 is done, other pages may look rough in the installed app.
- Installing (Story 1) and notifications (Stories 2–3) ship together in one
  release; the priorities order the work, not separate releases.
- No app store listing, no native app, and no offline use are part of this feature.
- Notifications with details (amounts, qualification, ride names), notifications
  for rule-change recalculations, notifications to organisers (e.g. about failed
  work or new riders) and reminders (e.g. "no ride this week") are out of scope.
- The icon is a simple RynkePoints mark made for this feature; it must not use or
  resemble Strava's logo (Strava Brand Guidelines).
