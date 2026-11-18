-- Grants a team has let go of but not yet withdrawn at Strava (feature 041
-- FR-009, research R14). Add only. A row is settled as soon as the team knows
-- whether another team holds the person: dropped if one does with a working
-- connection, revoked and dropped if none does. The token stays encrypted and
-- is read for nothing but the revoke. No foreign key: the rider row is gone,
-- or never existed (a refusal at sign-in).
CREATE TABLE pending_revocations (
	athlete_id INTEGER PRIMARY KEY,
	refresh_token_enc TEXT NOT NULL,
	since INTEGER NOT NULL
);
