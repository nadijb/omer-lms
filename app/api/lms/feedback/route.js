import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

// GET /api/lms/feedback?reference_type=session&reference_id=9
// Returns the current user's feedback for a specific reference
export async function GET(request) {
  const { authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const reference_type = searchParams.get('reference_type');
  const reference_id   = searchParams.get('reference_id');

  if (!reference_type || !reference_id)
    return NextResponse.json({ error: 'reference_type and reference_id required' }, { status: 400 });

  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM lms_feedback WHERE user_id = $1 AND reference_type = $2 AND reference_id = $3`,
    [user.id, reference_type, Number(reference_id)]
  );
  return NextResponse.json(result.rows[0] || null);
}

// POST /api/lms/feedback
// Body: { reference_type, reference_id, rating, comment }
export async function POST(request) {
  const { authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { reference_type, reference_id, rating, comment } = await request.json();

  if (!reference_type || !reference_id || !rating)
    return NextResponse.json({ error: 'reference_type, reference_id, and rating are required' }, { status: 400 });
  if (![1,2,3,4,5].includes(Number(rating)))
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });

  const pool = getPool();
  try {
    const result = await pool.query(
      `INSERT INTO lms_feedback (user_id, reference_type, reference_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, reference_type, reference_id)
       DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
       RETURNING *`,
      [user.id, reference_type, Number(reference_id), Number(rating), comment || null]
    );
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
