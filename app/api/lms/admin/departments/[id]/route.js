import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { name, description, parent_id, company_id, is_active } = await request.json();
  const pool = getPool();
  try {
    const result = await pool.query(`
      UPDATE lms_departments SET
        name        = COALESCE($1, name),
        description = $2,
        parent_id   = $3,
        company_id  = $4,
        is_active   = COALESCE($5, is_active),
        updated_at  = NOW()
      WHERE id = $6 RETURNING *
    `, [name?.trim() || null, description ?? null, parent_id || null, company_id || null,
        is_active ?? null, params.id]);
    if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'Name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    // Check for users or sub-departments
    const check = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM auth_users WHERE department_id = $1 OR sub_department_id = $1)::int AS user_count,
        (SELECT COUNT(*) FROM lms_departments WHERE parent_id = $1)::int AS child_count
    `, [params.id]);
    const { user_count, child_count } = check.rows[0];
    if (user_count > 0) return NextResponse.json({ error: `Cannot delete: ${user_count} user(s) assigned to this department` }, { status: 409 });
    if (child_count > 0) return NextResponse.json({ error: `Cannot delete: ${child_count} sub-department(s) exist. Delete them first.` }, { status: 409 });

    await pool.query('DELETE FROM lms_departments WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
