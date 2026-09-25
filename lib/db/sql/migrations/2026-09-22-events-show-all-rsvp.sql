-- Adds events.show_all_rsvp — the admin switch that decides what the
-- "기존 예약 확인" page shows. When it is on the page lists every RSVP name and
-- the search box filters that list in the browser; when it is off the page keeps
-- asking for a whole name or the last phone digits and looks each one up.
--
-- Idempotent: safe to run more than once, and on a database that already has
-- the column. Existing events keep the current behaviour (search only).

SET client_min_messages = warning;

ALTER TABLE events ADD COLUMN IF NOT EXISTS show_all_rsvp boolean NOT NULL DEFAULT false;

-- Check the result.
SELECT id, title, show_all_rsvp FROM events ORDER BY id;
