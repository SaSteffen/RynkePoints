-- The Team page quotes a rider has already seen (issue #96), so the page picks
-- one they haven't seen yet until they've seen every quote that fits them; then
-- the round starts over. A row holds a quote's id (a hash of its text, see
-- `quoteId` in src/http/sections/team.ts), nothing about what the rider did or
-- when. Deleting a rider removes their rows. Only adds a table, so the
-- previously deployed version keeps working.

CREATE TABLE quote_seen (
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	-- 8 hex digits. One class per digit is a GLOB too long for D1.
	quote_id TEXT NOT NULL
		CHECK (length(quote_id) = 8 AND quote_id NOT GLOB '*[^0-9a-f]*'),
	PRIMARY KEY (athlete_id, quote_id)
);
