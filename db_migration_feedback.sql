-- ============================================================
-- Cortex LMS — Feedback System Migration
-- Run this in your Supabase/PostgreSQL SQL editor
-- ============================================================

-- 1. lms_feedback table: stores 5-star ratings from users
--    for sessions (reference_type='session') or courses (reference_type='course')
CREATE TABLE IF NOT EXISTS test.lms_feedback (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES test.auth_users(id) ON DELETE CASCADE,
  reference_type  VARCHAR NOT NULL,   -- 'session' | 'course'
  reference_id    INTEGER NOT NULL,
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, reference_type, reference_id)
);

-- 2. Index for fast lookups by reference
CREATE INDEX IF NOT EXISTS idx_lms_feedback_reference
  ON test.lms_feedback (reference_type, reference_id);

-- 3. Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_lms_feedback_user
  ON test.lms_feedback (user_id);
