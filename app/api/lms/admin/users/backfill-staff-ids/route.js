import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { generateStaffId } from '@/lib/generateStaffId';

// POST /api/lms/admin/users/backfill-staff-ids
// Fixes all users where staff_id IS NULL or staff_id = email (invalid state).
export async function POST(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Fetch all users with missing or invalid staff_id
    const { rows } = await client.query(`
      SELECT id, email, display_name, staff_id
      FROM auth_users
      WHERE staff_id IS NULL
         OR LOWER(staff_id) = LOWER(email)
      ORDER BY created_at ASC
    `);

    if (rows.length === 0) {
      return NextResponse.json({ updated: 0, message: 'All staff IDs are already valid.' });
    }

    let updated = 0;
    const errors = [];

    for (const user of rows) {
      try {
        const newId = await generateStaffId(client, user.email, user.display_name);
        await client.query(
          'UPDATE auth_users SET staff_id = $1 WHERE id = $2',
          [newId, user.id]
        );
        updated++;
      } catch (err) {
        errors.push({ email: user.email, error: err.message });
      }
    }

    return NextResponse.json({
      updated,
      total: rows.length,
      errors: errors.length ? errors : undefined,
      message: `Updated ${updated} of ${rows.length} users.`,
    });
  } finally {
    client.release();
  }
}
