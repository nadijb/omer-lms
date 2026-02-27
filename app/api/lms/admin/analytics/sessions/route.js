import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  const deptId    = searchParams.get('department_id');
  const limit     = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  const pool = getPool();
  try {
    const filters = ['1=1'];
    const vals    = [];

    if (companyId) {
      vals.push(companyId);
      filters.push(`EXISTS (
        SELECT 1 FROM lms_physical_enrollments pe2
        JOIN auth_users u2 ON pe2.user_id = u2.id
        WHERE pe2.session_id = ps.id AND u2.company_id = $${vals.length}
      )`);
    }
    if (deptId) {
      vals.push(deptId);
      filters.push(`EXISTS (
        SELECT 1 FROM lms_physical_enrollments pe2
        JOIN auth_users u2 ON pe2.user_id = u2.id
        WHERE pe2.session_id = ps.id
          AND (u2.department_id = $${vals.length} OR u2.sub_department_id = $${vals.length})
      )`);
    }

    vals.push(limit);
    const result = await pool.query(`
      SELECT
        ps.id,
        ps.title,
        ps.description,
        ps.scheduled_date,
        ps.start_time,
        ps.end_time,
        ps.location,
        ps.session_mode,
        ps.status,
        u.display_name                                                     AS trainer_name,
        COUNT(DISTINCT pe.id)::int                                         AS enrolled,
        COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'present')::int   AS present,
        COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'absent')::int    AS absent,
        COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'enrolled')::int  AS not_marked,
        COUNT(DISTINCT pe.id) FILTER (WHERE pe.acknowledged_at IS NOT NULL)::int     AS acknowledged,
        CASE WHEN COUNT(DISTINCT pe.id) > 0
          THEN ROUND(COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'present')::numeric
               / COUNT(DISTINCT pe.id)::numeric * 100)
          ELSE 0
        END                                                                AS attendance_pct
      FROM lms_physical_sessions ps
      LEFT JOIN auth_users u ON ps.trainer_id = u.id
      LEFT JOIN lms_physical_enrollments pe ON pe.session_id = ps.id
      WHERE ${filters.join(' AND ')}
      GROUP BY ps.id, ps.title, ps.description, ps.scheduled_date, ps.start_time,
               ps.end_time, ps.location, ps.session_mode, ps.status, u.display_name
      ORDER BY ps.scheduled_date DESC, ps.start_time DESC
      LIMIT $${vals.length}
    `, vals);

    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
