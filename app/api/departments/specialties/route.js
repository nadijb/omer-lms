import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function POST(request) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { name, description } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const pool = getPool();
  try {
    const r = await pool.query(
      'INSERT INTO lms_specialties (name, description) VALUES ($1,$2) RETURNING *',
      [name.trim(), description || null]
    );
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'Specialty already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
