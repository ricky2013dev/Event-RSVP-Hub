-- Adds events.rsvp_closed — the admin switch that closes RSVPs. When it is on
-- the RSVP pages show only a "RSVP closed" notice: no form, no lookup, no names
-- and no confirmation details, and the server refuses new RSVPs and every public
-- RSVP read.
--
-- Idempotent: safe to run more than once, and on a database that already has
-- the column. Existing events stay open.

SET client_min_messages = warning;

ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_closed boolean NOT NULL DEFAULT false;

-- Check the result.
SELECT id, title, rsvp_closed FROM events ORDER BY id;
