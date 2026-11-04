-- Feature 025 FR-039: one switch for all of an administrator's usage alerts, so
-- its name no longer says Cloudflare. Keeps what they set. `cloudflare_alerts`
-- stays for the version still running while this applies, and a later release
-- drops it.
ALTER TABLE riders ADD COLUMN admin_alerts INTEGER NOT NULL DEFAULT 1
	CHECK (admin_alerts IN (0, 1));
UPDATE riders SET admin_alerts = cloudflare_alerts;
