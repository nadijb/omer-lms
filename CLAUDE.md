Here is the database schema for the application


-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE test.ai_companion_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  messages jsonb DEFAULT '[]'::jsonb,
  summary text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT ai_companion_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE test.auth_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['admin'::character varying, 'support'::character varying, 'training'::character varying, 'learner'::character varying, 'trainer'::character varying]::text[])),
  display_name character varying,
  is_active boolean DEFAULT true,
  company_id integer,
  staff_id character varying,
  departments ARRAY DEFAULT '{}'::text[],
  specialties ARRAY DEFAULT '{}'::text[],
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT auth_users_pkey PRIMARY KEY (id),
  CONSTRAINT auth_users_company_id_fkey FOREIGN KEY (company_id) REFERENCES test.companies(id)
);
CREATE TABLE test.companies (
  id integer NOT NULL DEFAULT nextval('test.companies_id_seq'::regclass),
  company_code character varying NOT NULL UNIQUE,
  company_name character varying NOT NULL,
  description text,
  domain character varying,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);
CREATE TABLE test.google_calendar_tokens (
  id integer NOT NULL DEFAULT nextval('test.google_calendar_tokens_id_seq'::regclass),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  expiry bigint,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT google_calendar_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT google_calendar_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_calendar_attendees (
  id integer NOT NULL DEFAULT nextval('test.lms_calendar_attendees_id_seq'::regclass),
  event_id integer,
  user_id uuid,
  response_status character varying DEFAULT 'pending'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_calendar_attendees_pkey PRIMARY KEY (id),
  CONSTRAINT lms_calendar_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES test.lms_calendar_events(id),
  CONSTRAINT lms_calendar_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_calendar_events (
  id integer NOT NULL DEFAULT nextval('test.lms_calendar_events_id_seq'::regclass),
  title character varying NOT NULL,
  description text,
  event_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  location character varying,
  event_type character varying DEFAULT 'training'::character varying,
  google_calendar_event_id character varying,
  google_calendar_link text,
  created_by uuid,
  department character varying,
  specialty character varying,
  attendee_emails ARRAY,
  is_recurring boolean DEFAULT false,
  recurrence_rule text,
  status character varying DEFAULT 'scheduled'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_calendar_events_pkey PRIMARY KEY (id),
  CONSTRAINT lms_calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_courses (
  id integer NOT NULL DEFAULT nextval('test.lms_courses_id_seq'::regclass),
  title character varying NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_courses_pkey PRIMARY KEY (id),
  CONSTRAINT lms_courses_created_by_fkey FOREIGN KEY (created_by) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_departments (
  id integer NOT NULL DEFAULT nextval('test.lms_departments_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_departments_pkey PRIMARY KEY (id)
);
CREATE TABLE test.lms_event_logs (
  id bigint NOT NULL DEFAULT nextval('test.lms_event_logs_id_seq'::regclass),
  session_id uuid,
  user_id uuid,
  lesson_id integer,
  event_type character varying NOT NULL,
  event_payload jsonb DEFAULT '{}'::jsonb,
  client_ts timestamp with time zone NOT NULL,
  server_ts timestamp with time zone DEFAULT now(),
  CONSTRAINT lms_event_logs_pkey PRIMARY KEY (id),
  CONSTRAINT lms_event_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES test.lms_learning_sessions(id),
  CONSTRAINT lms_event_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES test.auth_users(id),
  CONSTRAINT lms_event_logs_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES test.lms_lessons(id)
);
CREATE TABLE test.lms_learner_profiles (
  id integer NOT NULL DEFAULT nextval('test.lms_learner_profiles_id_seq'::regclass),
  user_id uuid UNIQUE,
  learner_type_id integer,
  display_name character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_learner_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT lms_learner_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES test.auth_users(id),
  CONSTRAINT lms_learner_profiles_learner_type_id_fkey FOREIGN KEY (learner_type_id) REFERENCES test.lms_learner_types(id)
);
CREATE TABLE test.lms_learner_types (
  id integer NOT NULL DEFAULT nextval('test.lms_learner_types_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_learner_types_pkey PRIMARY KEY (id),
  CONSTRAINT lms_learner_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_learning_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  lesson_id integer,
  session_started_at timestamp without time zone DEFAULT now(),
  session_ended_at timestamp without time zone,
  total_active_seconds integer DEFAULT 0,
  total_idle_seconds integer DEFAULT 0,
  CONSTRAINT lms_learning_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT lms_learning_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES test.auth_users(id),
  CONSTRAINT lms_learning_sessions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES test.lms_lessons(id)
);
CREATE TABLE test.lms_lesson_assignments (
  id integer NOT NULL DEFAULT nextval('test.lms_lesson_assignments_id_seq'::regclass),
  learner_type_id integer,
  lesson_id integer,
  assigned_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_lesson_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT lms_lesson_assignments_learner_type_id_fkey FOREIGN KEY (learner_type_id) REFERENCES test.lms_learner_types(id),
  CONSTRAINT lms_lesson_assignments_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES test.lms_lessons(id),
  CONSTRAINT lms_lesson_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_lessons (
  id integer NOT NULL DEFAULT nextval('test.lms_lessons_id_seq'::regclass),
  section_id integer,
  title character varying NOT NULL,
  video_url text,
  manual_markdown text,
  duration_seconds integer,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_lessons_pkey PRIMARY KEY (id),
  CONSTRAINT lms_lessons_section_id_fkey FOREIGN KEY (section_id) REFERENCES test.lms_sections(id),
  CONSTRAINT lms_lessons_created_by_fkey FOREIGN KEY (created_by) REFERENCES test.auth_users(id),
  CONSTRAINT lms_lessons_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_notifications (
  id integer NOT NULL DEFAULT nextval('test.lms_notifications_id_seq'::regclass),
  user_id uuid,
  title character varying NOT NULL,
  body text,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  type character varying,
  reference_type character varying,
  reference_id integer,
  CONSTRAINT lms_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT lms_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_physical_enrollments (
  id integer NOT NULL DEFAULT nextval('test.lms_physical_enrollments_id_seq'::regclass),
  session_id integer,
  user_id uuid,
  attendance_status character varying DEFAULT 'enrolled'::character varying,
  acknowledged_at timestamp without time zone,
  marked_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  enrolled_by uuid,
  learner_type_id integer,
  marked_by uuid,
  CONSTRAINT lms_physical_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT lms_physical_enrollments_session_id_fkey FOREIGN KEY (session_id) REFERENCES test.lms_physical_sessions(id),
  CONSTRAINT lms_physical_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES test.auth_users(id),
  CONSTRAINT lms_physical_enrollments_enrolled_by_fkey FOREIGN KEY (enrolled_by) REFERENCES test.auth_users(id),
  CONSTRAINT lms_physical_enrollments_learner_type_id_fkey FOREIGN KEY (learner_type_id) REFERENCES test.lms_learner_types(id),
  CONSTRAINT lms_physical_enrollments_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_physical_sessions (
  id integer NOT NULL DEFAULT nextval('test.lms_physical_sessions_id_seq'::regclass),
  title character varying NOT NULL,
  description text,
  trainer_id uuid,
  scheduled_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  location character varying,
  max_capacity integer,
  status character varying DEFAULT 'scheduled'::character varying,
  created_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_physical_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT lms_physical_sessions_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES test.auth_users(id),
  CONSTRAINT lms_physical_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES test.auth_users(id)
);
CREATE TABLE test.lms_sections (
  id integer NOT NULL DEFAULT nextval('test.lms_sections_id_seq'::regclass),
  course_id integer,
  parent_section_id integer,
  title character varying NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_sections_pkey PRIMARY KEY (id),
  CONSTRAINT lms_sections_course_id_fkey FOREIGN KEY (course_id) REFERENCES test.lms_courses(id),
  CONSTRAINT lms_sections_parent_section_id_fkey FOREIGN KEY (parent_section_id) REFERENCES test.lms_sections(id)
);
CREATE TABLE test.lms_specialties (
  id integer NOT NULL DEFAULT nextval('test.lms_specialties_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_specialties_pkey PRIMARY KEY (id)
);
CREATE TABLE test.lms_user_lesson_progress (
  id integer NOT NULL DEFAULT nextval('test.lms_user_lesson_progress_id_seq'::regclass),
  user_id uuid,
  lesson_id integer,
  percent_watched numeric DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamp without time zone,
  total_watch_seconds integer DEFAULT 0,
  watch_count integer DEFAULT 0,
  last_position_seconds integer DEFAULT 0,
  last_activity_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_user_lesson_progress_pkey PRIMARY KEY (id),
  CONSTRAINT lms_user_lesson_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES test.auth_users(id),
  CONSTRAINT lms_user_lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES test.lms_lessons(id)
);
