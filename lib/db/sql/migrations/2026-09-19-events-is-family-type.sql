-- Adds events.is_family_type — the admin switch that decides whether the RSVP
-- form asks for a family (아빠 · 엄마 이름 and 자녀) or for a single attendee.
-- When it is off the form shows one "이름" box, stored in rsvps.father_name,
-- and the 자녀 section disappears.
--
-- Idempotent: safe to run more than once, and on a database that already has
-- the column. Existing events keep the current behaviour (family form).

SET client_min_messages = warning;

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_family_type boolean NOT NULL DEFAULT true;

-- Check the result.
SELECT id, title, is_family_type FROM events ORDER BY id;
