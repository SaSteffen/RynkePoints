-- The app never writes to Strava (constitution 3.0.0, Principle III), so whether
-- a rider once granted write access is no longer kept. The release before this
-- one stopped reading and writing the column; dropping it in the same release
-- would have broken the version still running while CI deploys.
ALTER TABLE riders DROP COLUMN scope_write;
