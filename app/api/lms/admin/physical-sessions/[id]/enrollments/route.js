import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request, { params }) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT
        pe.*,
        u.email, u.display_name,
        lt.name AS learner_type_name
      FROM lms_physical_enrollments pe
      JOIN auth_users u ON pe.user_id = u.id
      LEFT JOIN lms_learner_types lt ON pe.learner_type_id = lt.id
      WHERE pe.session_id = $1
      ORDER BY u.display_name
    `, [params.id]);
    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
