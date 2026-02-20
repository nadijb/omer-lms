import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function POST(request) {
  const { authError, user } = await requireRole(request, 'learner', 'admin', 'training');
  if (authError) return authError;

  const { lesson_id } = await request.json();
  if (!lesson_id) return NextResponse.json({ error: 'lesson_id required' }, { status: 400 });

  const pool = getPool();
  try {
    const result = await pool.query(
      'INSERT INTO lms_learning_sessions (user_id, lesson_id) VALUES ($1,$2) RETURNING id',
      [user.id, lesson_id]
    );
    return NextResponse.json({ session_id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
