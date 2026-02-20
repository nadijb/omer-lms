import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError, user } = await requireRole(request, 'trainer', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query(
      'SELECT id, email, display_name, staff_id, departments, specialties FROM auth_users WHERE id = $1',
      [user.id]
    );
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
