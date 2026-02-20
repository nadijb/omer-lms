import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError, user } = await requireRole(request, 'learner', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT * FROM lms_notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [user.id]);
    const unread = result.rows.filter(n => !n.is_read).length;
    return NextResponse.json({ notifications: result.rows, unread });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
