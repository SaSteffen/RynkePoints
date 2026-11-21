-- Sign out everywhere (issue #314): the session cookie carries the rider's
-- epoch, and a cookie whose epoch differs counts as signed out. Raising it
-- ends every session of the rider. Existing riders start at 0, which is what
-- a cookie from before this release counts as, so the deploy signs nobody
-- out. Add only.
ALTER TABLE riders ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 0;
