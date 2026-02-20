import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { deleteVideoFile } from '@/lib/supabase-storage';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { title, sort_order } = await request.json();
  try {
    const pool = getPool();
    const r = await pool.query(
      'UPDATE lms_sections SET title=COALESCE($1,title), sort_order=COALESCE($2,sort_order), updated_at=NOW() WHERE id=$3 RETURNING *',
      [title?.trim(), sort_order, params.id]
    );
    return NextResponse.json(r.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  try {
    const pool = getPool();
    const videos = await pool.query(
      'SELECT video_url FROM lms_lessons WHERE section_id = $1 AND video_url IS NOT NULL',
      [params.id]
    );
    videos.rows.forEach(r => deleteVideoFile(r.video_url));

    const childVideos = await pool.query(`
      SELECT l.video_url FROM lms_lessons l
      JOIN lms_sections s ON l.section_id = s.id
      WHERE s.parent_section_id = $1 AND l.video_url IS NOT NULL
    `, [params.id]);
    childVideos.rows.forEach(r => deleteVideoFile(r.video_url));

    await pool.query('DELETE FROM lms_sections WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
