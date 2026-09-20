-- Event RSVP — full schema, mirrors lib/db/src/schema/*.ts
--
-- Safe to run on an empty database (creates everything) or on an existing one
-- (adds only what is missing). Every statement is idempotent, so re-running is a no-op.
-- Generated from the Drizzle schema; keep in sync when you change a table.

-- Quiet the "already exists, skipping" notices on a re-run.
SET client_min_messages = warning;

-- gen_random_uuid() is built in on Postgres 13+; the extension covers older servers.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- events — one row per event (the app uses id = 1 and seeds it on first read)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
  id                  serial PRIMARY KEY,
  title               text NOT NULL,
  subtitle            text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  date                text NOT NULL,
  start_time          text NOT NULL,
  end_time            text NOT NULL,
  timezone            text NOT NULL,
  venue               text NOT NULL DEFAULT '',
  address             text NOT NULL DEFAULT '',
  dress_code          text NOT NULL DEFAULT '',
  host_name           text NOT NULL DEFAULT '',
  capacity            integer NOT NULL DEFAULT 0,
  image_url           text NOT NULL DEFAULT '',
  featured_note       text NOT NULL DEFAULT '',
  theme               text NOT NULL DEFAULT 'rose',
  card_style          text NOT NULL DEFAULT 'classic',
  theme_color         text NOT NULL DEFAULT '#d6848d',
  theme_accent        text NOT NULL DEFAULT '#c9a24a',
  is_family_type      boolean NOT NULL DEFAULT true,
  belong_team_label   text NOT NULL DEFAULT '소속 팀',
  belong_dept_label   text NOT NULL DEFAULT '소속 부서',
  belong_dept_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  table_count         integer NOT NULL DEFAULT 20,
  message_label       text NOT NULL DEFAULT '축하 메시지',
  message_placeholder text NOT NULL DEFAULT '따뜻한 한마디를 남겨주세요.',
  show_summary        boolean NOT NULL DEFAULT true,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Catch up an events table created before these columns existed.
ALTER TABLE events ADD COLUMN IF NOT EXISTS subtitle            text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS description         text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue               text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS address             text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS dress_code          text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS host_name           text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity            integer NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url           text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS featured_note       text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS theme               text NOT NULL DEFAULT 'rose';
ALTER TABLE events ADD COLUMN IF NOT EXISTS card_style          text NOT NULL DEFAULT 'classic';
ALTER TABLE events ADD COLUMN IF NOT EXISTS theme_color         text NOT NULL DEFAULT '#d6848d';
ALTER TABLE events ADD COLUMN IF NOT EXISTS theme_accent        text NOT NULL DEFAULT '#c9a24a';
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_family_type      boolean NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS belong_team_label   text NOT NULL DEFAULT '소속 팀';
ALTER TABLE events ADD COLUMN IF NOT EXISTS belong_dept_label   text NOT NULL DEFAULT '소속 부서';
ALTER TABLE events ADD COLUMN IF NOT EXISTS belong_dept_options jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS table_count         integer NOT NULL DEFAULT 20;
ALTER TABLE events ADD COLUMN IF NOT EXISTS message_label       text NOT NULL DEFAULT '축하 메시지';
ALTER TABLE events ADD COLUMN IF NOT EXISTS message_placeholder text NOT NULL DEFAULT '따뜻한 한마디를 남겨주세요.';
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_summary        boolean NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- rsvps — one row per family
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rsvps (
  id              serial PRIMARY KEY,
  event_id        integer NOT NULL DEFAULT 1,
  name            text NOT NULL,
  father_name     text NOT NULL DEFAULT '',
  mother_name     text NOT NULL DEFAULT '',
  phone_number    text,
  belong_team     text,
  belong_dept     text,
  children        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Legacy columns from the email-based form; kept so older rows still load.
  email           text,
  attendance      text NOT NULL DEFAULT 'attending',
  guest_count     integer NOT NULL DEFAULT 0,
  adult_count     integer NOT NULL DEFAULT 0,
  child_count     integer NOT NULL DEFAULT 0,
  meal_preference text NOT NULL DEFAULT 'noPreference',
  dietary_notes   text,
  message         text,
  table_number    integer,
  confirm_token   text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Catch up an rsvps table created before these columns existed.
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS event_id        integer NOT NULL DEFAULT 1;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS father_name     text NOT NULL DEFAULT '';
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS mother_name     text NOT NULL DEFAULT '';
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS phone_number    text;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS belong_team     text;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS belong_dept     text;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS children        jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS email           text;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS attendance      text NOT NULL DEFAULT 'attending';
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS guest_count     integer NOT NULL DEFAULT 0;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS adult_count     integer NOT NULL DEFAULT 0;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS child_count     integer NOT NULL DEFAULT 0;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS meal_preference text NOT NULL DEFAULT 'noPreference';
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS dietary_notes   text;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS message         text;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS table_number    integer;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS confirm_token   text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now();
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

-- Backfill tokens on any row that predates the column (or was inserted with NULL/'').
UPDATE rsvps
   SET confirm_token = replace(gen_random_uuid()::text, '-', '')
 WHERE confirm_token IS NULL OR confirm_token = '';

-- Each family's private confirmation link must be unique.
DO $$
BEGIN
  ALTER TABLE rsvps ADD CONSTRAINT rsvps_confirm_token_unique UNIQUE (confirm_token);
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN NULL;
END
$$;
