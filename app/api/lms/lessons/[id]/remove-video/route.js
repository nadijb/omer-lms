import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { deleteVideoFile } from '@/lib/supabase-storage';

export async function PATCH(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [params.id]);
    deleteVideoFile(old.rows[0]?.video_url);
    await pool.query(
      'UPDATE lms_lessons SET video_url = NULL, updated_at = NOW(), updated_by = $1 WHERE id = $2',
      [user.id, params.id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
