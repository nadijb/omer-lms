import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/admin/departments
// Returns all departments/sub-departments grouped by company
export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT
        d.id, d.name, d.description, d.is_active, d.parent_id, d.company_id,
        c.company_name,
        COUNT(DISTINCT u.id)::int AS user_count
      FROM lms_departments d
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN auth_users u ON (u.department_id = d.id OR u.sub_department_id = d.id)
      GROUP BY d.id, d.name, d.description, d.is_active, d.parent_id, d.company_id, c.company_name
      ORDER BY d.company_id NULLS LAST, d.parent_id NULLS FIRST, d.name
    `);
    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/lms/admin/departments
export async function POST(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { name, description, parent_id, company_id } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const pool = getPool();
  try {
    const result = await pool.query(`
      INSERT INTO lms_departments (name, description, parent_id, company_id)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [name.trim(), description || null, parent_id || null, company_id || null]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'A department with this name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
