-- Guests apart in every team figure (feature 041 FR-007) without a scan of all
-- riders: the check `NOT IN (SELECT athlete_id FROM riders WHERE guest = 1)`
-- reads only the guests' rows. Add only.
CREATE INDEX riders_guest ON riders (athlete_id) WHERE guest = 1;
