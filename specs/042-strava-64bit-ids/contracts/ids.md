# Contract: IDs at the boundaries

## Strava → app (responses)

`GET /athlete/activities`, `GET /activities/{id}`, `POST /oauth/token` (its `athlete`): for every
object with an `id`, the ID is `id_str` when it is a valid ID (data-model.md), else the exact
digits of `id`. A response whose ID is neither is malformed (as a missing ID is today). Club IDs
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

Answers and events as Strava: `id` a JSON number with the exact digits, `id_str` the same as text
on activities and athletes (also the athlete nested in an activity and the one in the token
answer), `object_id` and `owner_id` numbers only.
