import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// POST /api/lms/admin/departments/bulk
// Body: { rows: [{name, organization, parent_department, description}] }
export async function POST(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { rows = [] } = await request.json();
  if (!rows.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });

  const pool = getPool();

  // Pre-load companies and existing departments
  const [companies, existingDepts] = await Promise.all([
    pool.query('SELECT id, company_name FROM companies').then(r => r.rows),
    pool.query('SELECT id, name, parent_id, company_id FROM lms_departments').then(r => r.rows),
  ]);

  const findCompany = (name) => companies.find(c => c.company_name.toLowerCase().trim() === name?.toLowerCase().trim());

  const results = [];

  // Process rows in two passes:
  // Pass 1: top-level departments (no parent_department)
  // Pass 2: sub-departments (has parent_department) — may depend on Pass 1 results
  const newlyCreated = []; // track newly created depts this batch

  const findParent = (name, companyId) => {
    const all = [...existingDepts, ...newlyCreated];
    return all.find(d =>
      d.name.toLowerCase().trim() === name?.toLowerCase().trim() &&
      !d.parent_id &&
      (!companyId || String(d.company_id) === String(companyId))
    );
  };

  const topLevel = rows.map((r, i) => ({ ...r, _origIndex: i })).filter(r => !r.parent_department?.toString().trim());
  const subLevel = rows.map((r, i) => ({ ...r, _origIndex: i })).filter(r =>  r.parent_department?.toString().trim());

  const processRow = async (row) => {
    const name = row.name?.toString().trim();
    if (!name) return { row: row._origIndex + 1, name: '—', success: false, error: 'Name is required' };

    let company_id = null;
    if (row.organization?.toString().trim()) {
      const co = findCompany(row.organization);
      if (!co) return { row: row._origIndex + 1, name, success: false, error: `Organisation "${row.organization}" not found` };
      company_id = co.id;
    }

    let parent_id = null;
    if (row.parent_department?.toString().trim()) {
      const parent = findParent(row.parent_department, company_id);
      if (!parent) return { row: row._origIndex + 1, name, success: false, error: `Parent department "${row.parent_department}" not found${company_id ? ' in that organisation' : ''}` };
      parent_id = parent.id;
    }

    try {
      const r = await pool.query(`
        INSERT INTO lms_departments (name, description, company_id, parent_id)
        VALUES ($1, $2, $3, $4) RETURNING id, name, parent_id, company_id
      `, [name, row.description?.toString().trim() || null, company_id, parent_id]);
      newlyCreated.push(r.rows[0]);
      return { row: row._origIndex + 1, name, success: true };
    } catch (err) {
      const msg = err.code === '23505' ? `Department "${name}" already exists` : err.message;
      return { row: row._origIndex + 1, name, success: false, error: msg };
    }
  };

  // Process top-level first
  for (const row of topLevel) {
    results[row._origIndex] = await processRow(row);
  }
  // Then sub-departments (can reference newly created parents)
  for (const row of subLevel) {
    results[row._origIndex] = await processRow(row);
  }

  const succeeded = results.filter(r => r?.success).length;
  return NextResponse.json({ results, succeeded, total: rows.length });
}
