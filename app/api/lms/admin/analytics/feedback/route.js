import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/admin/analytics/feedback
// Returns aggregated feedback per session and per course
export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const reference_type = searchParams.get('reference_type') || 'session'; // 'session' | 'course'
  const companyId = searchParams.get('company_id');
  const deptId    = searchParams.get('department_id');

  const pool = getPool();
  try {
    if (reference_type === 'session') {
      const filters = ['f.reference_type = $1'];
      const vals    = ['session'];

      if (companyId) {
        vals.push(companyId);
        filters.push(`EXISTS (
          SELECT 1 FROM auth_users u2
          WHERE u2.id = f.user_id AND u2.company_id = $${vals.length}
        )`);
      }
      if (deptId) {
        vals.push(deptId);
        filters.push(`EXISTS (
          SELECT 1 FROM auth_users u2
          WHERE u2.id = f.user_id
            AND (u2.department_id = $${vals.length} OR u2.sub_department_id = $${vals.length})
        )`);
      }

      const result = await pool.query(`
        SELECT
          f.reference_id                            AS session_id,
          ps.title                                  AS session_title,
          ps.scheduled_date,
          COUNT(f.id)::int                          AS response_count,
          ROUND(AVG(f.rating)::numeric, 1)          AS avg_rating,
          COUNT(f.id) FILTER (WHERE f.rating = 5)::int AS five_star,
          COUNT(f.id) FILTER (WHERE f.rating = 4)::int AS four_star,
          COUNT(f.id) FILTER (WHERE f.rating = 3)::int AS three_star,
          COUNT(f.id) FILTER (WHERE f.rating = 2)::int AS two_star,
          COUNT(f.id) FILTER (WHERE f.rating = 1)::int AS one_star,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'user', u.display_name,
              'rating', f.rating,
              'comment', f.comment,
              'created_at', f.created_at
            ) ORDER BY f.created_at DESC
          ) FILTER (WHERE f.comment IS NOT NULL AND f.comment != '') AS comments
        FROM lms_feedback f
        JOIN lms_physical_sessions ps ON ps.id = f.reference_id
        JOIN auth_users u ON u.id = f.user_id
        WHERE ${filters.join(' AND ')}
        GROUP BY f.reference_id, ps.title, ps.scheduled_date
        ORDER BY ps.scheduled_date DESC
      `, vals);
      return NextResponse.json(result.rows);
    }

    if (reference_type === 'course') {
      const result = await pool.query(`
        SELECT
          f.reference_id                            AS course_id,
          c.title                                   AS course_title,
          COUNT(f.id)::int                          AS response_count,
          ROUND(AVG(f.rating)::numeric, 1)          AS avg_rating,
          COUNT(f.id) FILTER (WHERE f.rating = 5)::int AS five_star,
          COUNT(f.id) FILTER (WHERE f.rating = 4)::int AS four_star,
          COUNT(f.id) FILTER (WHERE f.rating = 3)::int AS three_star,
          COUNT(f.id) FILTER (WHERE f.rating = 2)::int AS two_star,
          COUNT(f.id) FILTER (WHERE f.rating = 1)::int AS one_star,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'user', u.display_name,
              'rating', f.rating,
              'comment', f.comment,
              'created_at', f.created_at
            ) ORDER BY f.created_at DESC
          ) FILTER (WHERE f.comment IS NOT NULL AND f.comment != '') AS comments
        FROM lms_feedback f
        JOIN lms_courses c ON c.id = f.reference_id
        JOIN auth_users u ON u.id = f.user_id
        WHERE f.reference_type = 'course'
        GROUP BY f.reference_id, c.title
        ORDER BY avg_rating DESC
      `);
      return NextResponse.json(result.rows);
    }

    return NextResponse.json({ error: 'Invalid reference_type' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
