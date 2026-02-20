import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request) {
  const { authError, user } = await requireRole(request, 'learner', 'admin', 'training');
  if (authError) return authError;

  const { ids } = await request.json();
  const pool = getPool();
  try {
    if (ids?.length) {
      await pool.query(
        `UPDATE lms_notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2::int[])`,
        [user.id, ids]
      );
    } else {
      await pool.query(
        `UPDATE lms_notifications SET is_read = true WHERE user_id = $1`,
        [user.id]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
