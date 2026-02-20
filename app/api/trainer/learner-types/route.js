import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'trainer', 'admin', 'training');
  if (authError) return authError;

  try {
    const pool = getPool();
    const r = await pool.query(`
      SELECT lt.*, COUNT(lp.user_id)::int AS learner_count
      FROM lms_learner_types lt
      LEFT JOIN lms_learner_profiles lp ON lp.learner_type_id = lt.id
      WHERE lt.is_active = true
      GROUP BY lt.id ORDER BY lt.name
    `);
    return NextResponse.json(r.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
