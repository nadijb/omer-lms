import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request, { params }) {
  const { authError, user } = await requireRole(request, 'learner', 'admin', 'training');
  if (authError) return authError;

  const { total_active_seconds, total_idle_seconds } = await request.json();
  const pool = getPool();
  try {
    await pool.query(`
      UPDATE lms_learning_sessions
      SET session_ended_at     = NOW(),
          total_active_seconds = COALESCE($1, total_active_seconds),
          total_idle_seconds   = COALESCE($2, total_idle_seconds)
      WHERE id = $3 AND user_id = $4
    `, [total_active_seconds, total_idle_seconds, params.id, user.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
