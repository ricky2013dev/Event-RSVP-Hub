-- Adds events.language — the language the guest pages are shown in ('ko' or
-- 'en'). Guests no longer pick it with the flag switch; only the admin sets it.
--
-- Idempotent: safe to run more than once, and on a database that already has
-- the column. Existing events stay in Korean.

SET client_min_messages = warning;

ALTER TABLE events ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ko';

-- Check the result.
SELECT id, title, language FROM events ORDER BY id;
