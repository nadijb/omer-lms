import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'trainer', 'admin', 'training');
  if (authError) return authError;

  try {
    const pool = getPool();
    const r = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.staff_id, lt.name AS learner_type
      FROM auth_users u
      JOIN lms_learner_profiles lp ON lp.user_id = u.id
      JOIN lms_learner_types lt    ON lt.id = lp.learner_type_id
      WHERE u.role = 'learner' AND u.is_active = true
      ORDER BY u.display_name
    `);
    return NextResponse.json(r.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
