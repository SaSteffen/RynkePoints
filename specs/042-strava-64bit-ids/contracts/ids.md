# Contract: IDs at the boundaries

## Strava → app (responses)

`GET /athlete/activities`, `GET /activities/{id}`, `POST /oauth/token` (its `athlete`): for every
object with an `id`, the ID is the exact digits of `id` and must be a valid ID (data-model.md);
`id_str` is ignored. A response whose ID isn't valid is malformed (as a missing ID is today). Club IDs
(`GET /athlete/clubs`) are unchanged numbers.

## Strava → gateway → app (webhook events)

Body unchanged and forwarded as received. `object_id` and `owner_id` are read from their exact
digits and must be valid IDs, else the event is refused (400) as today. `subscription_id` stays a
safe-integer check.

## App ↔ gateway (`held`)

`{"athleteId": <digits>}`: a JSON number with the exact digits, as before. Both sides read it
exactly and also accept a JSON string with a valid ID.

## Queue and work tables

`athleteId`, `activityId` are JSON strings. A positive safe-integer JSON number is accepted and
converted (messages from the previous version). `subscriptionId`, `page`, `after`, `stamp`,
`previous` are unchanged numbers.

## Fake Strava

Answers and events as Strava: `id`, `object_id` and `owner_id` JSON numbers with the exact
digits. No `id_str`, so no part of the app can come to depend on it.
