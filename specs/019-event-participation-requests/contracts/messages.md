# Contract: Catalog Messages

New and changed keys in `src/i18n/messages/de.ts` and `en.ts` (FR-050), the rider
addressed as "du". `team.place*` and `team.peloton.*` stay: Training still shows
the place card and the peloton (research R12).
Wording may be polished in implementation; the meaning may not change.

## Navigation and tour

| Key | English | German |
|---|---|---|
| `nav.events` | Events | Termine |
| `nav.organiser.open` | Orga, {n} open reports | Orga, {n} offene Meldungen |
| `tour.rider.team` *(changed)* | Team: how the whole team is doing and where you are in the ranking. | Team: wie das ganze Team dasteht und wo du in der Rangliste stehst. |

## Termine tab (`events.*`)

| Key | English | German |
|---|---|---|
| `events.heading` | Team events 📅 | Teamtermine 📅 |
| `events.until` | until {date} | bis {date} |
| `events.note.title` | Report it here yourself | Melde dich hier selbst an |
| `events.note.body` | We can't take your participation in team events from Spond or Strava yet. Let us know here which events you're coming to or were at. | Deine Teilnahme an Teamterminen können wir noch nicht aus Spond oder Strava übernehmen. Sag hier Bescheid, bei welchen Terminen du dabei bist oder warst. |
| `events.upcoming` | Coming up | Demnächst |
| `events.upcoming.hint` | "I'm in" only lets the organisers know. You get Rynke once the event is over and the organisers have added you. Until then you can change your mind any time. | „Bin dabei“ sagt der Orga nur Bescheid. Rynke gibt es erst, wenn der Termin vorbei ist und die Orga dich eingetragen hat. Bis dahin kannst du jederzeit wieder absagen. |
| `events.upcoming.none` | No team events planned yet. | Noch sind keine Teamtermine geplant. |
| `events.past` | Past | Vorbei |
| `events.past.all` | Show all | Alle zeigen |
| `events.amount.team` | +{n} Team | +{n} Team |
| `events.amount.training` | +{n} Training | +{n} Training |
| `events.join` | I'm in | Bin dabei |
| `events.joined` | I'm in | Bin dabei |
| `events.leave` | Not coming after all | Doch nicht dabei |
| `events.joined.label` | I'm in; tap to cancel | Bin dabei, antippen zum Absagen |
| `events.report` | I was there | Ich war dabei |
| `events.reported.label` | I was there, reported | Ich war dabei, gemeldet |
| `events.attended` | You were there | Du warst dabei |
| `events.error.event_over` | The event is over; you can't cancel any more. | Der Termin ist vorbei, absagen geht nicht mehr. |
| `events.error.already_attending` | You're already added to this event. | Du bist bei diesem Termin schon eingetragen. |

## Orga › Termine (`organiser.requests.*`, changed `organiser.events.*`)

| Key | English | German |
|---|---|---|
| `organiser.switch.events.open` | Events, {n} open reports | Termine, {n} offene Meldungen |
| `organiser.requests.heading` | {n} open reports ⏳ | {n} offene Meldungen ⏳ |
| `organiser.requests.heading.one` | 1 open report ⏳ | 1 offene Meldung ⏳ |
| `organiser.requests.intro` | Riders say they were there – at {n} events. | Rider sagen, sie waren dabei – bei {n} Terminen. |
| `organiser.requests.intro.one` | Riders say they were there – at one event. | Rider sagen, sie waren dabei – bei einem Termin. |
| `organiser.requests.open` | Open event | Termin öffnen |
| `organiser.requests.confirm` | Add | Eintragen |
| `organiser.requests.confirm.label` | Add {name} to {event} | {name} bei {event} eintragen |
| `organiser.requests.deny.label` | Decline {name}'s report for {event} | Meldung von {name} bei {event} ablehnen |
| `organiser.requests.confirmAll` | Add all {n} | Alle {n} eintragen |
| `organiser.requests.wants` | ⏳ Wants to be added: {event} | ⏳ Will eingetragen werden: {event} |
| `organiser.done.confirmed` | {names} added. | {names} eingetragen. |
| `organiser.done.denied` | Report from {names} declined. | Meldung von {names} abgelehnt. |
| `organiser.done.undone` | Undone. | Rückgängig gemacht. |
| `organiser.undo` | Undo | Rückgängig |
| `organiser.error.request_settled` | Someone else has already dealt with this report. | Diese Meldung hat schon jemand anders erledigt. |
| `organiser.error.undo_expired` | That can't be undone any more. | Das lässt sich nicht mehr rückgängig machen. |
| `organiser.events.attendees` *(changed)* | {count} people | {count} Personen |
| `organiser.events.attendees.you` | {count} people, including you | {count} Personen, inklusive dir |
| `organiser.events.intents` | {count} coming | {count} zugesagt |
| `organiser.events.open` | ⏳ {count} open | ⏳ {count} offen |
| `organiser.events.self` | I was there too | Ich war auch dabei |

## Event page (`organiser.attendance.*`)

| Key | English | German |
|---|---|---|
| `organiser.attendance.headingFuture` | Who's coming? | Wer kommt? |
| `organiser.attendance.count` | {count} attended | {count} dabei |
| `organiser.attendance.countFuture` | {count} coming | {count} zugesagt |
| `organiser.attendance.legend` | What the boxes show | Was die Kästchen zeigen |
| `organiser.attendance.legend.empty` | Empty – not there | Leer – nicht dabei |
| `organiser.attendance.legend.grey` | Grey – report, still open | Grau – Meldung, noch offen |
| `organiser.attendance.legend.greyFuture` | Grey – coming | Grau – zugesagt |
| `organiser.attendance.legend.checked` | Tick – there, earns Rynke | Haken – dabei, gibt Rynke |
| `organiser.attendance.confirmAll` | Add all {n} reports | Alle {n} Meldungen eintragen |
| `organiser.attendance.tag.open` | Report open | Meldung offen |
| `organiser.attendance.tag.yes` | will be added | wird eingetragen |
| `organiser.attendance.tag.no` | will be declined | wird abgelehnt |
| `organiser.attendance.tag.intent` | coming | zugesagt |
| `organiser.attendance.decide.open` | Leave open | Offen lassen |
| `organiser.attendance.decide.yes` | Was there | Dabei |
| `organiser.attendance.decide.no` | Wasn't there | Nicht dabei |
| `organiser.attendance.summary` | Reports: {yes} will be added, {no} declined, {open} open | Meldungen: {yes} werden eingetragen, {no} abgelehnt, {open} offen |
| `organiser.done.attendance` *(changed)* | Saved: {yes} added, {no} declined, {open} open. | Gespeichert: {yes} eingetragen, {no} abgelehnt, {open} offen. |

## Overview (`organiser.overview.*`)

| Key | English | German |
|---|---|---|
| `organiser.overview.group.requests` | Riders with an open report ⏳ | Rider mit offener Meldung ⏳ |
| `organiser.overview.column.requests` | Report | Meldung |
| `organiser.overview.column.rynke` | Rynke | Rynke |

The desktop rider table's Draußen and Termine columns are gone, and with them
`organiser.overview.column.outdoor` and `organiser.overview.column.events`
([pages.md](pages.md) "`/organiser/riders`").

## Consent and privacy (FR-052)

`landing.purpose`, `consent.*` and the privacy page's sentence on what organisers
see add: "…und bei welchen Teamterminen du gemeldet hast, dass du dabei bist oder
warst." (EN: "…and which team events you reported you're coming to or were at.").
No new consent version (research R11).
