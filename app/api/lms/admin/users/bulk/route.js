import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// POST /api/lms/admin/users/bulk
// Body: { rows: [{email, display_name, password, role, staff_id,
//                 organization, department, sub_department, learner_type}],
//         default_password: string }
export async function POST(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { rows = [], default_password } = await request.json();
  if (!rows.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });

  const pool = getPool();

  // Pre-load lookup tables
  const [companies, departments, learnerTypes] = await Promise.all([
    pool.query('SELECT id, company_name FROM companies').then(r => r.rows),
    pool.query('SELECT id, name, parent_id, company_id FROM lms_departments').then(r => r.rows),
    pool.query('SELECT id, name FROM lms_learner_types WHERE is_active = true').then(r => r.rows),
  ]);

  const findCompany = (name) => companies.find(c => c.company_name.toLowerCase().trim() === name?.toLowerCase().trim());
  const findDept    = (name, companyId) => departments.find(d =>
    d.name.toLowerCase().trim() === name?.toLowerCase().trim() &&
    (!companyId || String(d.company_id) === String(companyId)) &&
    !d.parent_id
  );
  const findSubDept = (name, parentId) => departments.find(d =>
    d.name.toLowerCase().trim() === name?.toLowerCase().trim() &&
    String(d.parent_id) === String(parentId)
  );
  const findType = (name) => learnerTypes.find(t => t.name.toLowerCase().trim() === name?.toLowerCase().trim());

  const validRoles = ['admin', 'trainer', 'learner', 'support'];
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const email = row.email?.toString().toLowerCase().trim();
    const role  = (row.role?.toString().toLowerCase().trim()) || 'learner';
    const pwd   = row.password?.toString().trim() || default_password;

    // Validate required fields
    if (!email) { results.push({ row: rowNum, email: '—', success: false, error: 'Email is required' }); continue; }
    if (!pwd)   { results.push({ row: rowNum, email, success: false, error: 'Password is required (set a default password above)' }); continue; }
    if (!validRoles.includes(role)) { results.push({ row: rowNum, email, success: false, error: `Invalid role "${role}"` }); continue; }

    // Resolve org/dept
    let company_id = null, department_id = null, sub_department_id = null, learner_type_id = null;

    if (row.organization?.toString().trim()) {
      const co = findCompany(row.organization);
      if (!co) { results.push({ row: rowNum, email, success: false, error: `Organisation "${row.organization}" not found` }); continue; }
      company_id = co.id;
    }

    if (row.department?.toString().trim()) {
      const dept = findDept(row.department, company_id);
      if (!dept) { results.push({ row: rowNum, email, success: false, error: `Department "${row.department}" not found${company_id ? ' in that organisation' : ''}` }); continue; }
      department_id = dept.id;
    }

    if (row.sub_department?.toString().trim()) {
      if (!department_id) { results.push({ row: rowNum, email, success: false, error: 'Sub-department requires a parent department' }); continue; }
      const sub = findSubDept(row.sub_department, department_id);
      if (!sub) { results.push({ row: rowNum, email, success: false, error: `Sub-department "${row.sub_department}" not found under that department` }); continue; }
      sub_department_id = sub.id;
    }

    if (row.learner_type?.toString().trim() && role === 'learner') {
      const lt = findType(row.learner_type);
      if (!lt) { results.push({ row: rowNum, email, success: false, error: `Learner type "${row.learner_type}" not found` }); continue; }
      learner_type_id = lt.id;
    }

    // Insert user
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const hash = await bcrypt.hash(pwd, 10); // salt 10 for speed in bulk ops
      const r = await client.query(`
        INSERT INTO auth_users
          (email, password_hash, role, display_name, staff_id,
           company_id, department_id, sub_department_id,
           registration_status, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',true)
        RETURNING id
      `, [
        email, hash, role,
        row.display_name?.toString().trim() || null,
        row.staff_id?.toString().trim() || null,
        company_id, department_id, sub_department_id,
      ]);

      const userId = r.rows[0].id;
      if (role === 'learner' && learner_type_id) {
        await client.query(`
          INSERT INTO lms_learner_profiles (user_id, learner_type_id)
          VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET learner_type_id = $2
        `, [userId, learner_type_id]);
      }
      await client.query('COMMIT');
      results.push({ row: rowNum, email, success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      const msg = err.code === '23505' ? 'Email already exists' : err.message;
      results.push({ row: rowNum, email, success: false, error: msg });
    } finally {
      client.release();
    }
  }

  const succeeded = results.filter(r => r.success).length;
  return NextResponse.json({ results, succeeded, total: rows.length });
}
