import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/server-auth';
import { uploadToSupabase, deleteVideoFile } from '@/lib/supabase-storage';

export async function GET(request, { params }) {
  const { authError } = await requireAuth(request);
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query('SELECT * FROM lms_lessons WHERE id = $1', [params.id]);
    if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const formData = await request.formData();
  const title = formData.get('title');
  const manual_markdown = formData.get('manual_markdown');
  const sort_order = formData.get('sort_order');
  const is_active = formData.get('is_active');
  const duration_seconds = formData.get('duration_seconds');
  const videoFile = formData.get('video');

  const pool = getPool();
  let videoClause = '';
  const queryParams = [title?.trim(), manual_markdown, sort_order, is_active, duration_seconds, user.id, params.id];

  if (videoFile && videoFile instanceof File && videoFile.size > 0) {
    try {
      const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [params.id]);
      await deleteVideoFile(old.rows[0]?.video_url);
      const newUrl = await uploadToSupabase(videoFile);
      videoClause = `, video_url = $8`;
      queryParams.push(newUrl);
    } catch (err) {
      return NextResponse.json({ error: `Upload failed: ${err.message}` }, { status: 500 });
    }
  }

  try {
    const r = await pool.query(`
      UPDATE lms_lessons SET
        title            = COALESCE($1, title),
        manual_markdown  = COALESCE($2, manual_markdown),
        sort_order       = COALESCE($3, sort_order),
        is_active        = COALESCE($4, is_active),
        duration_seconds = COALESCE($5, duration_seconds),
        updated_by       = $6,
        updated_at       = NOW()
        ${videoClause}
      WHERE id = $7 RETURNING *
    `, queryParams);
    if (!r.rows[0]) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
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
    const r = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [params.id]);
    deleteVideoFile(r.rows[0]?.video_url);
    await pool.query('DELETE FROM lms_lessons WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
