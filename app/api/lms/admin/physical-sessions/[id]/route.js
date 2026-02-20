import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity, status } = await request.json();
  const pool = getPool();
  try {
    const result = await pool.query(`
      UPDATE lms_physical_sessions SET
        title          = COALESCE($1, title),
        description    = COALESCE($2, description),
        location       = COALESCE($3, location),
        trainer_id     = COALESCE($4, trainer_id),
        scheduled_date = COALESCE($5, scheduled_date),
        start_time     = COALESCE($6, start_time),
        end_time       = COALESCE($7, end_time),
        max_capacity   = COALESCE($8, max_capacity),
        status         = COALESCE($9, status),
        updated_at     = NOW()
      WHERE id = $10 RETURNING *
    `, [title?.trim(), description, location, trainer_id,
        scheduled_date, start_time, end_time, max_capacity, status,
        params.id]);
    if (!result.rows[0]) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    await pool.query('DELETE FROM lms_physical_sessions WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
