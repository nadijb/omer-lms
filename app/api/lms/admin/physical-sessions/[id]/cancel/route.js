import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request, { params }) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    await pool.query(
      `UPDATE lms_physical_sessions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [params.id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
