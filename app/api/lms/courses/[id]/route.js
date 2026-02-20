import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { deleteVideoFile } from '@/lib/supabase-storage';

export async function PUT(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { title, description, is_active } = await request.json();
  const pool = getPool();
  try {
    const r = await pool.query(`
      UPDATE lms_courses SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        is_active   = COALESCE($3, is_active),
        updated_at  = NOW()
      WHERE id = $4 RETURNING *
    `, [title?.trim(), description, is_active, params.id]);
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    const videos = await pool.query(`
      SELECT l.video_url FROM lms_lessons l
      JOIN lms_sections s ON l.section_id = s.id
      WHERE s.course_id = $1 AND l.video_url IS NOT NULL
    `, [params.id]);
    videos.rows.forEach(r => deleteVideoFile(r.video_url));
    await pool.query('DELETE FROM lms_courses WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
