import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(DISTINCT u.id)::int AS user_count
      FROM companies c
      LEFT JOIN auth_users u ON u.company_id = c.id
      GROUP BY c.id
      ORDER BY c.company_name
    `);
    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { company_code, company_name, description, domain } = await request.json();
  if (!company_code?.trim() || !company_name?.trim())
    return NextResponse.json({ error: 'company_code and company_name are required' }, { status: 400 });

  const pool = getPool();
  try {
    const result = await pool.query(`
      INSERT INTO companies (company_code, company_name, description, domain)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [company_code.trim().toUpperCase(), company_name.trim(), description || null, domain || null]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'Company code already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
