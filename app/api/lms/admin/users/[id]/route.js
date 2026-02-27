import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const {
    display_name, role, staff_id, is_active, can_upload_content,
    company_id, department_id, sub_department_id,
    learner_type_id, password,
  } = await request.json();

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const queryParams = [
      display_name ?? null,
      role ?? null,
      staff_id ?? null,
      is_active ?? null,
      can_upload_content ?? null,
      company_id ?? null,
      department_id ?? null,
      sub_department_id ?? null,
      params.id,
    ];

    let hashClause = '';
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      hashClause = ', password_hash = $10';
      queryParams.push(hash);
    }

    await client.query(`
      UPDATE auth_users SET
        display_name      = COALESCE($1, display_name),
        role              = COALESCE($2, role),
        staff_id          = $3,
        is_active         = COALESCE($4, is_active),
        can_upload_content= COALESCE($5, can_upload_content),
        company_id        = $6,
        department_id     = $7,
        sub_department_id = $8,
        updated_at        = NOW()
        ${hashClause}
      WHERE id = $9
    `, queryParams);

    // Upsert learner profile if learner_type_id provided
    if (learner_type_id !== undefined) {
      if (learner_type_id) {
        await client.query(`
          INSERT INTO lms_learner_profiles (user_id, learner_type_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id) DO UPDATE SET learner_type_id = $2, updated_at = NOW()
        `, [params.id, learner_type_id]);
      } else {
        // Clear learner type
        await client.query(`
          UPDATE lms_learner_profiles SET learner_type_id = NULL, updated_at = NOW()
          WHERE user_id = $1
        `, [params.id]);
      }
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

export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    await pool.query('DELETE FROM auth_users WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
