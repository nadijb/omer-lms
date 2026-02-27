-- ============================================================
-- Migration: Remove 'training' role, merge into 'trainer'
-- Run this ONCE on the database.
-- ============================================================

-- Step 1: Update all existing 'training' users to 'trainer'
UPDATE test.auth_users
SET role = 'trainer', updated_at = NOW()
WHERE role = 'training';

-- Step 2: Drop the old role CHECK constraint
ALTER TABLE test.auth_users DROP CONSTRAINT IF EXISTS auth_users_role_check;

-- Step 3: Recreate constraint without 'training'
ALTER TABLE test.auth_users
  ADD CONSTRAINT auth_users_role_check
  CHECK (role::text = ANY (ARRAY[
    'admin'::character varying,
    'support'::character varying,
    'learner'::character varying,
    'trainer'::character varying
  ]::text[]));

-- Step 4 (optional): Add UNIQUE constraint on staff_id
-- NULLs are allowed — only non-NULL values must be unique
ALTER TABLE test.auth_users
  DROP CONSTRAINT IF EXISTS auth_users_staff_id_unique;

ALTER TABLE test.auth_users
  ADD CONSTRAINT auth_users_staff_id_unique UNIQUE (staff_id);
-- NOTE: If the above fails due to existing duplicate staff_ids,
-- find and resolve duplicates first:
--   SELECT staff_id, COUNT(*) FROM test.auth_users
--   WHERE staff_id IS NOT NULL
--   GROUP BY staff_id HAVING COUNT(*) > 1;

SELECT 'Migration complete. training → trainer done.' AS status;
