-- How many evaluations stored the rider's Rynke (review L-18). A batch that
-- stores one counts it, and fails as a whole if the count is no longer the one
-- read with the rider's state: then another change stored meanwhile, and the
-- evaluation is worked out again from the new state. Add only.
ALTER TABLE riders ADD COLUMN evaluations INTEGER NOT NULL DEFAULT 0;
