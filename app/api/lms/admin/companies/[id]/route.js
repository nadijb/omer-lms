import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { company_name, description, domain, is_active } = await request.json();
  const pool = getPool();
  try {
    const r = await pool.query(`
      UPDATE companies SET
        company_name = COALESCE($1, company_name),
        description  = $2,
        domain       = $3,
        is_active    = COALESCE($4, is_active),
        updated_at   = NOW()
      WHERE id = $5 RETURNING *
    `, [company_name || null, description ?? null, domain ?? null, is_active ?? null, params.id]);
    if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const check = await pool.query(
      `SELECT COUNT(*)::int AS user_count FROM auth_users WHERE company_id = $1`,
      [params.id]
    );
    const { user_count } = check.rows[0];
    if (user_count > 0)
      return NextResponse.json({ error: `Cannot delete: ${user_count} user(s) belong to this organization` }, { status: 409 });

    await pool.query('DELETE FROM companies WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
