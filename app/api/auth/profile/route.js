import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function PATCH(request) {
  const { authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { display_name } = await request.json();
  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
  }

  const pool = getPool();
  try {
    await pool.query(
      'UPDATE auth_users SET display_name = $1, updated_at = NOW() WHERE id = $2',
      [display_name.trim(), user.id]
    );
    return NextResponse.json({ ok: true, display_name: display_name.trim() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
