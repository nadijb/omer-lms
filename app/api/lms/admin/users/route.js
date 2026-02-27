import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query(`
      SELECT
        u.id, u.email, u.display_name, u.role, u.staff_id,
        u.is_active, u.can_upload_content, u.registration_status, u.created_at,
        u.company_id,    c.company_name,
        u.department_id,     d.name  AS department_name,
        u.sub_department_id, sd.name AS sub_department_name,
        lp.learner_type_id, lt.name AS learner_type_name
      FROM auth_users u
      LEFT JOIN companies          c  ON c.id  = u.company_id
      LEFT JOIN lms_departments    d  ON d.id  = u.department_id
      LEFT JOIN lms_departments    sd ON sd.id = u.sub_department_id
      LEFT JOIN lms_learner_profiles lp ON lp.user_id = u.id
      LEFT JOIN lms_learner_types    lt ON lt.id = lp.learner_type_id
      ORDER BY u.created_at DESC
    `);
    return NextResponse.json(r.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const {
    email, password, display_name, role, staff_id,
    company_id, department_id, sub_department_id, learner_type_id,
  } = await request.json();

  if (!email || !password || !role)
    return NextResponse.json({ error: 'email, password, role required' }, { status: 400 });

  const validRoles = ['admin', 'trainer', 'support', 'learner'];
  if (!validRoles.includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hash = await bcrypt.hash(password, 12);
    const normalizedEmail = email.toLowerCase().trim();

    // Auto-generate staff_id from email local part if not provided
    let resolvedStaffId = staff_id?.trim() || null;
    if (!resolvedStaffId) {
      const localPart = normalizedEmail.split('@')[0];
      // Try the local part first; if it collides, append the domain prefix
      const domain = normalizedEmail.split('@')[1]?.split('.')[0] || '';
      const existing = await client.query(
        'SELECT 1 FROM auth_users WHERE staff_id = $1',
        [localPart]
      );
      resolvedStaffId = existing.rowCount === 0 ? localPart : `${localPart}.${domain}`;
    }

    const r = await client.query(`
      INSERT INTO auth_users
        (email, password_hash, role, display_name, staff_id,
         company_id, department_id, sub_department_id,
         registration_status, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',true)
      RETURNING id, email, display_name, role, staff_id, is_active, registration_status,
                company_id, department_id, sub_department_id
    `, [
      normalizedEmail, hash, role,
      display_name || null, resolvedStaffId,
      company_id || null, department_id || null, sub_department_id || null,
    ]);

    const newUser = r.rows[0];

    // Create learner profile if role is learner
    if (role === 'learner' && learner_type_id) {
      await client.query(`
        INSERT INTO lms_learner_profiles (user_id, learner_type_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET learner_type_id = $2
      `, [newUser.id, learner_type_id]);
    }

    await client.query('COMMIT');
    return NextResponse.json(newUser, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
