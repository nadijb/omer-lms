-- ============================================================
-- Cortex LMS — Demo Seed Data
-- Populates realistic healthcare/hospital training data for
-- presentations and demos of the IoHealth LMS platform.
--
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.
--
-- Command:
--   psql $DATABASE_URL -f db_seed_demo.sql
-- Or paste into your Supabase SQL editor.
-- ============================================================

SET search_path = test;

-- ────────────────────────────────────────────────────────────
-- 1. PHYSICAL TRAINING SESSIONS
--    trainer_id / created_by resolved dynamically from auth_users
-- ────────────────────────────────────────────────────────────

INSERT INTO lms_physical_sessions
  (title, description, location, facility, session_mode, scheduled_date, start_time, end_time, status, trainer_id, created_by)
SELECT
  v.title, v.description, v.location, v.facility, v.session_mode,
  v.scheduled_date::date, v.start_time::time, v.end_time::time, v.status,
  (SELECT id FROM auth_users WHERE role IN ('trainer','admin') LIMIT 1),
  (SELECT id FROM auth_users WHERE role IN ('trainer','admin') LIMIT 1)
FROM (VALUES
  -- ── Past sessions ──────────────────────────────────────────────────────
  (
    'BLS Certification',
    'Basic Life Support certification for all clinical staff. Covers adult/paediatric CPR, AED use, and choking response.',
    'Room 101', 'Simulation Lab', 'in_person',
    (CURRENT_DATE - INTERVAL '30 days')::text, '09:00', '13:00', 'completed'
  ),
  (
    'Patient Safety Module — Falls Prevention',
    'Evidence-based strategies for preventing patient falls in ward and ICU environments.',
    'Training Centre', 'Main Hospital', 'in_person',
    (CURRENT_DATE - INTERVAL '21 days')::text, '10:00', '12:00', 'completed'
  ),
  (
    'EMR System Training — Episode Documentation',
    'Hands-on training on documenting clinical episodes, discharge summaries and referral letters in the EMR.',
    'IT Lab B', 'Clinic A', 'in_person',
    (CURRENT_DATE - INTERVAL '14 days')::text, '08:30', '11:30', 'completed'
  ),
  (
    'Infection Control & Hand Hygiene Refresher',
    'Annual refresher covering WHO five moments, PPE donning/doffing, and outbreak protocols.',
    'Conference Room 2', 'Main Hospital', 'in_person',
    (CURRENT_DATE - INTERVAL '7 days')::text, '14:00', '16:00', 'completed'
  ),
  (
    'Medication Safety and Administration',
    'Safe medication handling, high-alert drug protocols, and error reporting processes.',
    'Online (Teams)', NULL, 'online',
    (CURRENT_DATE - INTERVAL '3 days')::text, '11:00', '12:30', 'completed'
  ),
  -- ── Upcoming sessions ──────────────────────────────────────────────────
  (
    'Advanced Cardiac Life Support (ACLS) — Renewal',
    'ACLS renewal for ICU, ED, and anaesthesia staff. Brings participants up to the latest AHA guidelines.',
    'Simulation Bay 1', 'Simulation Lab', 'in_person',
    (CURRENT_DATE + INTERVAL '7 days')::text, '08:00', '16:00', 'scheduled'
  ),
  (
    'Manual Handling and Patient Mobility',
    'Practical techniques for safe patient transfers, use of hoist equipment and back-injury prevention.',
    'Physiotherapy Gym', 'Main Hospital', 'in_person',
    (CURRENT_DATE + INTERVAL '10 days')::text, '09:00', '11:00', 'scheduled'
  ),
  (
    'Clinical Documentation Standards',
    'Webinar covering legal and clinical expectations for nursing and medical notes in the EMR.',
    'Online (Teams)', NULL, 'online',
    (CURRENT_DATE + INTERVAL '14 days')::text, '13:00', '14:30', 'scheduled'
  ),
  (
    'Mental Health First Aid in the Workplace',
    'Equips staff to recognise and provide initial support to colleagues experiencing mental health challenges.',
    'Hall B', 'Conference Hall B', 'in_person',
    (CURRENT_DATE + INTERVAL '21 days')::text, '09:30', '12:30', 'scheduled'
  ),
  (
    'Sepsis Recognition and Early Management',
    'SBAR-based sepsis pathway training, NEWS2 scoring, and escalation protocols.',
    'Lecture Theatre', 'Clinic A', 'in_person',
    (CURRENT_DATE + INTERVAL '28 days')::text, '10:00', '12:00', 'scheduled'
  )
) AS v(title, description, location, facility, session_mode, scheduled_date, start_time, end_time, status)
WHERE NOT EXISTS (
  SELECT 1 FROM lms_physical_sessions ps WHERE ps.title = v.title
);


-- ────────────────────────────────────────────────────────────
-- 2. SAMPLE ENROLLMENTS
--    Links the first available learner to completed sessions
-- ────────────────────────────────────────────────────────────

-- Helper: enrol a learner into each past session with varied attendance
INSERT INTO lms_physical_enrollments
  (session_id, user_id, attendance_status, enrolled_by)
SELECT
  ps.id,
  (SELECT id FROM auth_users WHERE role = 'learner' LIMIT 1),
  enr.status,
  (SELECT id FROM auth_users WHERE role IN ('trainer','admin') LIMIT 1)
FROM (VALUES
  ('BLS Certification',                         'present'),
  ('Patient Safety Module — Falls Prevention',  'present'),
  ('EMR System Training — Episode Documentation','absent'),
  ('Infection Control & Hand Hygiene Refresher','present'),
  ('Medication Safety and Administration',       'enrolled')
) AS enr(session_title, status)
JOIN lms_physical_sessions ps ON ps.title = enr.session_title
WHERE (SELECT id FROM auth_users WHERE role = 'learner' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lms_physical_enrollments pe
    WHERE pe.session_id = ps.id
      AND pe.user_id = (SELECT id FROM auth_users WHERE role = 'learner' LIMIT 1)
  );

-- Mark attendance timestamp for present rows
UPDATE lms_physical_enrollments
SET marked_at = NOW() - INTERVAL '1 hour',
    marked_by = (SELECT id FROM auth_users WHERE role IN ('trainer','admin') LIMIT 1)
WHERE attendance_status = 'present'
  AND marked_at IS NULL;


-- ────────────────────────────────────────────────────────────
-- 3. SAMPLE FEEDBACK
--    Posted by the first learner on completed sessions
-- ────────────────────────────────────────────────────────────

INSERT INTO lms_feedback
  (user_id, reference_type, reference_id, rating, comment)
SELECT
  (SELECT id FROM auth_users WHERE role = 'learner' LIMIT 1),
  'session',
  (SELECT id FROM lms_physical_sessions WHERE title = fb.session_title LIMIT 1),
  fb.rating,
  fb.comment
FROM (VALUES
  (
    'BLS Certification',
    5,
    'Excellent session — the simulation scenarios felt very realistic. Confident I can apply CPR correctly now.'
  ),
  (
    'Patient Safety Module — Falls Prevention',
    4,
    'Very informative. Would benefit from more ward-specific case studies, but overall well-structured.'
  ),
  (
    'EMR System Training — Episode Documentation',
    3,
    'Content was useful but the pace was too fast. More time on discharge summaries would help.'
  ),
  (
    'Infection Control & Hand Hygiene Refresher',
    5,
    'Clear, concise, and the trainer answered all questions thoroughly. Good refresher before the flu season.'
  )
) AS fb(session_title, rating, comment)
WHERE (SELECT id FROM auth_users WHERE role = 'learner' LIMIT 1) IS NOT NULL
  AND (SELECT id FROM lms_physical_sessions WHERE title = fb.session_title LIMIT 1) IS NOT NULL
ON CONFLICT (user_id, reference_type, reference_id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- Done.
-- Verify with:
--   SELECT title, scheduled_date, status FROM lms_physical_sessions ORDER BY scheduled_date;
--   SELECT * FROM lms_feedback ORDER BY created_at;
-- ────────────────────────────────────────────────────────────
