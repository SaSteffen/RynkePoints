-- Devices on which a rider turned on notifications for new Rynke (feature
-- 010-pwa-notifications, FR-010 to FR-021). See
-- specs/010-pwa-notifications/data-model.md and research R7.
--
-- Pushes carry no data, so a device needs nothing but its endpoint: no
-- encryption keys, language or device details. Deleting a rider removes their
-- devices (FR-013). Only adds a table, so the previously deployed version keeps
-- working.

CREATE TABLE push_subscriptions (
	subscription_id INTEGER PRIMARY KEY,
	endpoint TEXT NOT NULL UNIQUE
		CHECK (endpoint LIKE 'https://%' AND length(endpoint) <= 1024),
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	created_at INTEGER NOT NULL
);

CREATE INDEX push_subscriptions_by_rider ON push_subscriptions (athlete_id);
