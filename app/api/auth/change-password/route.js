import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function POST(request) {
  const { authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { current_password, new_password } = await request.json();
  if (!current_password || !new_password)
    return NextResponse.json({ error: 'current_password and new_password are required' }, { status: 400 });
  if (new_password.length < 8)
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });

  const pool = getPool();
  try {
    const result = await pool.query('SELECT password_hash FROM auth_users WHERE id = $1', [user.id]);
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const valid = await bcrypt.compare(current_password, row.password_hash);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE auth_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, user.id]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
