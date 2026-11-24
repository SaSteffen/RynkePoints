-- Feature 049 (research R2): the daily median CPU time per owner, in
-- microseconds like cpu_p99_us. NULL: no median recorded (days before this
-- release, days Cloudflare no longer holds). Only adds, so the release before
-- keeps writing its named columns.
ALTER TABLE usage_cpu_daily ADD COLUMN cpu_p50_us INTEGER;
