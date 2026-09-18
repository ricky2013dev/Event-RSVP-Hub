-- Adds events.show_summary — the admin switch that shows or hides the running
-- attendance totals ("지금까지 알려주신 참석 현황") on the public invitation.
--
-- Idempotent: safe to run more than once, and on a database that already has
-- the column. Existing events keep the current behaviour (totals visible).

SET client_min_messages = warning;

ALTER TABLE events ADD COLUMN IF NOT EXISTS show_summary boolean NOT NULL DEFAULT true;

-- Check the result.
SELECT id, title, show_summary FROM events ORDER BY id;
