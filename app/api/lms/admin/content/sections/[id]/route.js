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

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Collect all section IDs: this section + its direct children
    const sectionsRes = await client.query(
      'SELECT id FROM lms_sections WHERE id = $1 OR parent_section_id = $1',
      [params.id]
    );
    const sectionIds = sectionsRes.rows.map(r => r.id);

    // Collect all lessons in those sections
    const lessonsRes = await client.query(
      'SELECT id, video_url FROM lms_lessons WHERE section_id = ANY($1::int[])',
      [sectionIds]
    );
    const lessonIds  = lessonsRes.rows.map(r => r.id);
    const videoUrls  = lessonsRes.rows.map(r => r.video_url).filter(Boolean);

    if (lessonIds.length > 0) {
      await client.query('DELETE FROM lms_event_logs WHERE lesson_id = ANY($1::int[])', [lessonIds]);
      await client.query('DELETE FROM lms_learning_sessions WHERE lesson_id = ANY($1::int[])', [lessonIds]);
      await client.query('DELETE FROM lms_lesson_assignments WHERE lesson_id = ANY($1::int[])', [lessonIds]);
      await client.query('DELETE FROM lms_user_lesson_progress WHERE lesson_id = ANY($1::int[])', [lessonIds]);
      await client.query('DELETE FROM lms_lessons WHERE id = ANY($1::int[])', [lessonIds]);
    }

    // Delete child sections first (FK self-reference), then the parent
    await client.query('DELETE FROM lms_sections WHERE parent_section_id = $1', [params.id]);
    await client.query('DELETE FROM lms_sections WHERE id = $1', [params.id]);

    await client.query('COMMIT');
    videoUrls.forEach(url => deleteVideoFile(url));
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally { client.release(); }
}
