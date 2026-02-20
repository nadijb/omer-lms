import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { display_name, is_active, learner_type_id, password } = await request.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let hashClause = '';
    const queryParams = [display_name, is_active, params.id];
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      hashClause = ', password_hash = $4';
      queryParams.push(hash);
    }
    await client.query(`
      UPDATE auth_users
      SET display_name = COALESCE($1, display_name),
          is_active = COALESCE($2, is_active),
          updated_at = NOW()
          ${hashClause}
      WHERE id = $3 AND role = 'learner'
    `, queryParams);
    if (learner_type_id) {
      await client.query(
        'UPDATE lms_learner_profiles SET learner_type_id = $1, updated_at = NOW() WHERE user_id = $2',
        [learner_type_id, params.id]
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
