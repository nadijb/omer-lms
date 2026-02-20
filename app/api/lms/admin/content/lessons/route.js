import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { uploadToSupabase } from '@/lib/supabase-storage';

export async function POST(request) {
  const { authError, user } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const contentType = request.headers.get('content-type') || '';
  let section_id, title, manual_markdown, sort_order, duration_seconds, video_url;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    section_id       = formData.get('section_id');
    title            = formData.get('title');
    manual_markdown  = formData.get('manual_markdown');
    sort_order       = formData.get('sort_order');
    duration_seconds = formData.get('duration_seconds');
    const videoFile  = formData.get('video');
    if (videoFile instanceof File && videoFile.size > 0) {
      try { video_url = await uploadToSupabase(videoFile); }
      catch (e) { return NextResponse.json({ error: `Upload failed: ${e.message}` }, { status: 500 }); }
    }
  } else {
    const body = await request.json();
    ({ section_id, title, manual_markdown, sort_order, duration_seconds, video_url } = body);
  }

  if (!section_id || !title?.trim())
    return NextResponse.json({ error: 'section_id and title required' }, { status: 400 });

  try {
    const pool = getPool();
    const r = await pool.query(`
      INSERT INTO lms_lessons (section_id, title, video_url, manual_markdown, sort_order, duration_seconds, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *
    `, [section_id, title.trim(), video_url || null, manual_markdown || null, sort_order || 0, duration_seconds || null, user.id]);
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
