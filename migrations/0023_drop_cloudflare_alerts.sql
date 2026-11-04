-- Feature 025 FR-039: `admin_alerts` replaced this column in 0022, and the release
-- before this one stopped using it. Apply only after that release is live.
ALTER TABLE riders DROP COLUMN cloudflare_alerts;
