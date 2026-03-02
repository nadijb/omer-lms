import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/admin/analytics/completion
// Returns:
// {
//   byCourse: [{ course_id, course_title, total_lessons, completions, completion_pct }],
//   byLearnerType: [{ learner_type_id, learner_type_name, total_assigned, completed, completion_pct }],
//   avgWatchTimeByCourse: [{ course_title, avg_watch_seconds }]
// }
export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  const deptId    = searchParams.get('department_id');
  const dateFrom  = searchParams.get('date_from');
  const dateTo    = searchParams.get('date_to');

  const pool = getPool();
  try {
    // ── byCourse ──────────────────────────────────────────────────────────────
    const courseFilters = ['1=1'];
    const courseVals    = [];

    if (companyId) {
      courseVals.push(companyId);
      courseFilters.push(`(u.company_id = $${courseVals.length} OR u.id IS NULL)`);
    }
    if (deptId) {
      courseVals.push(deptId);
      courseFilters.push(`(u.department_id = $${courseVals.length} OR u.sub_department_id = $${courseVals.length} OR u.id IS NULL)`);
    }
    if (dateFrom) {
      courseVals.push(dateFrom);
      courseFilters.push(`(ulp.last_activity_at >= $${courseVals.length} OR ulp.id IS NULL)`);
    }
    if (dateTo) {
      courseVals.push(dateTo);
      courseFilters.push(`(ulp.last_activity_at <= $${courseVals.length} OR ulp.id IS NULL)`);
    }

    const byCourseResult = await pool.query(`
      SELECT
        c.id                                                                       AS course_id,
        c.title                                                                    AS course_title,
        COUNT(DISTINCT l.id)::int                                                  AS total_lessons,
        COUNT(DISTINCT ulp.id) FILTER (WHERE ulp.completed = true)::int           AS completions,
        CASE
          WHEN COUNT(DISTINCT l.id) > 0
          THEN ROUND(
            COUNT(DISTINCT ulp.id) FILTER (WHERE ulp.completed = true)::numeric
            / COUNT(DISTINCT l.id)::numeric * 100
          )
          ELSE 0
        END                                                                        AS completion_pct
      FROM lms_courses c
      LEFT JOIN lms_sections s              ON s.course_id  = c.id
      LEFT JOIN lms_lessons l               ON l.section_id = s.id AND l.is_active = true
      LEFT JOIN lms_user_lesson_progress ulp ON ulp.lesson_id = l.id
      LEFT JOIN auth_users u                ON u.id = ulp.user_id
      WHERE ${courseFilters.join(' AND ')}
      GROUP BY c.id, c.title
      ORDER BY completion_pct DESC, c.title
    `, courseVals);

    // ── byLearnerType ──────────────────────────────────────────────────────────
    const ltFilters = ['lt.is_active = true'];
    const ltVals    = [];

    if (companyId) {
      ltVals.push(companyId);
      ltFilters.push(`(u.company_id = $${ltVals.length} OR lp.user_id IS NULL)`);
    }
    if (deptId) {
      ltVals.push(deptId);
      ltFilters.push(`(u.department_id = $${ltVals.length} OR u.sub_department_id = $${ltVals.length} OR lp.user_id IS NULL)`);
    }

    const byLearnerTypeResult = await pool.query(`
      SELECT
        lt.id                                                                      AS learner_type_id,
        lt.name                                                                    AS learner_type_name,
        COUNT(DISTINCT CONCAT(lp.user_id::text, '-', la.lesson_id::text))::int    AS total_assigned,
        COUNT(DISTINCT ulp.id) FILTER (WHERE ulp.completed = true)::int           AS completed,
        CASE
          WHEN COUNT(DISTINCT CONCAT(lp.user_id::text, '-', la.lesson_id::text)) > 0
          THEN ROUND(
            COUNT(DISTINCT ulp.id) FILTER (WHERE ulp.completed = true)::numeric
            / COUNT(DISTINCT CONCAT(lp.user_id::text, '-', la.lesson_id::text))::numeric * 100
          )
          ELSE 0
        END                                                                        AS completion_pct
      FROM lms_learner_types lt
      LEFT JOIN lms_lesson_assignments la   ON la.learner_type_id = lt.id
      LEFT JOIN lms_learner_profiles lp     ON lp.learner_type_id = lt.id
      LEFT JOIN auth_users u                ON u.id = lp.user_id
      LEFT JOIN lms_user_lesson_progress ulp
        ON ulp.user_id = lp.user_id AND ulp.lesson_id = la.lesson_id
      WHERE ${ltFilters.join(' AND ')}
      GROUP BY lt.id, lt.name
      ORDER BY lt.name
    `, ltVals);

    // ── avgWatchTimeByCourse ───────────────────────────────────────────────────
    const watchFilters = ['1=1'];
    const watchVals    = [];

    if (companyId) {
      watchVals.push(companyId);
      watchFilters.push(`(u.company_id = $${watchVals.length} OR u.id IS NULL)`);
    }
    if (deptId) {
      watchVals.push(deptId);
      watchFilters.push(`(u.department_id = $${watchVals.length} OR u.sub_department_id = $${watchVals.length} OR u.id IS NULL)`);
    }
    if (dateFrom) {
      watchVals.push(dateFrom);
      watchFilters.push(`(ulp.last_activity_at >= $${watchVals.length} OR ulp.id IS NULL)`);
    }
    if (dateTo) {
      watchVals.push(dateTo);
      watchFilters.push(`(ulp.last_activity_at <= $${watchVals.length} OR ulp.id IS NULL)`);
    }

    const avgWatchResult = await pool.query(`
      SELECT
        c.title                                                AS course_title,
        COALESCE(ROUND(AVG(ulp.total_watch_seconds)), 0)::int AS avg_watch_seconds
      FROM lms_courses c
      LEFT JOIN lms_sections s               ON s.course_id  = c.id
      LEFT JOIN lms_lessons l                ON l.section_id = s.id AND l.is_active = true
      LEFT JOIN lms_user_lesson_progress ulp ON ulp.lesson_id = l.id
      LEFT JOIN auth_users u                 ON u.id = ulp.user_id
      WHERE ${watchFilters.join(' AND ')}
      GROUP BY c.id, c.title
      ORDER BY avg_watch_seconds DESC
    `, watchVals);

    return NextResponse.json({
      byCourse:             byCourseResult.rows,
      byLearnerType:        byLearnerTypeResult.rows,
      avgWatchTimeByCourse: avgWatchResult.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
