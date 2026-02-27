import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  const deptId    = searchParams.get('department_id');

  const pool = getPool();
  try {
    const filters = [];
    const vals    = [];
    if (companyId) { vals.push(companyId); filters.push(`u.company_id = $${vals.length}`); }
    if (deptId)    { vals.push(deptId);    filters.push(`(u.department_id = $${vals.length} OR u.sub_department_id = $${vals.length})`); }
    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

    const [users, sessions, lessons, progress] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                              AS total_users,
          COUNT(*) FILTER (WHERE role = 'learner')                             AS learners,
          COUNT(*) FILTER (WHERE role IN ('trainer','training'))               AS trainers,
          COUNT(*) FILTER (WHERE is_active = true)                             AS active_users
        FROM auth_users u ${where}
      `, vals),

      pool.query(`
        SELECT
          COUNT(*)                                                              AS total_sessions,
          COUNT(*) FILTER (WHERE ps.status = 'completed' OR (ps.scheduled_date < CURRENT_DATE))  AS completed_sessions,
          COUNT(*) FILTER (WHERE ps.scheduled_date >= CURRENT_DATE AND ps.status != 'cancelled')  AS upcoming_sessions,
          COUNT(*) FILTER (WHERE ps.session_mode = 'online')                   AS online_sessions,
          COUNT(*) FILTER (WHERE ps.session_mode = 'in_person' OR ps.session_mode IS NULL) AS inperson_sessions,
          COALESCE(AVG(
            CASE WHEN pe_total.cnt > 0 THEN
              pe_present.cnt::float / pe_total.cnt * 100
            END
          ), 0)::int                                                            AS avg_attendance_pct
        FROM lms_physical_sessions ps
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt FROM lms_physical_enrollments WHERE session_id = ps.id
        ) pe_total ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt FROM lms_physical_enrollments
          WHERE session_id = ps.id AND attendance_status = 'present'
        ) pe_present ON true
      `),

      pool.query(`
        SELECT
          COUNT(DISTINCT l.id) AS total_lessons,
          COUNT(DISTINCT c.id) AS total_courses
        FROM lms_lessons l
        LEFT JOIN lms_sections s ON l.section_id = s.id
        LEFT JOIN lms_courses  c ON s.course_id  = c.id
        WHERE l.is_active = true
      `),

      pool.query(`
        SELECT
          COUNT(*)                                        AS progress_records,
          COUNT(*) FILTER (WHERE completed = true)        AS completions,
          COALESCE(SUM(total_watch_seconds), 0)           AS total_watch_seconds
        FROM lms_user_lesson_progress ulp
        JOIN auth_users u ON ulp.user_id = u.id
        ${where}
      `, vals),
    ]);

    return NextResponse.json({
      users:    users.rows[0],
      sessions: sessions.rows[0],
      content:  lessons.rows[0],
      progress: progress.rows[0],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
