-- Adds events.child_groups — the groups a guest picks one of for each child on the
-- RSVP form, replacing the child's age. Each group has a name and the ages shown
-- beside it. The admin renames, re-ages, adds and removes them from the 접수 settings.
--
-- Children saved before this keep their age and simply have no group.
--
-- Idempotent: safe to run more than once. Existing events get the default groups.

SET client_min_messages = warning;

ALTER TABLE events ADD COLUMN IF NOT EXISTS child_groups jsonb NOT NULL DEFAULT '[{"name":"그룹 1","minAge":0,"maxAge":3},{"name":"그룹 2","minAge":4,"maxAge":6},{"name":"그룹 3","minAge":7,"maxAge":10},{"name":"그룹 4","minAge":11,"maxAge":18}]'::jsonb;

-- Check the result.
SELECT id, title, child_groups FROM events ORDER BY id;
