import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function POST(request) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { course_id, parent_section_id, title, sort_order } = await request.json();
  if (!course_id || !title?.trim()) {
    return NextResponse.json({ error: 'course_id and title required' }, { status: 400 });
  }

  const pool = getPool();
  try {
    const r = await pool.query(
      'INSERT INTO lms_sections (course_id, parent_section_id, title, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [course_id, parent_section_id || null, title.trim(), sort_order || 0]
    );
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
