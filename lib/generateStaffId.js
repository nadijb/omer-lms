/**
 * Generates a unique staff ID in the format: {ORG}-{INITIALS}-{NNNN}
 *
 * Examples:
 *   iohealth.com + "John Smith"  → IOH-JS-0001
 *   cortex.com   + "Ahmad Ali"  → COR-AA-0003
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db  - pool or pool client
 * @param {string} email       - user's email address
 * @param {string} displayName - user's display name (optional)
 * @returns {Promise<string>}  - unique staff ID
 */
export async function generateStaffId(db, email, displayName) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const domain = normalizedEmail.split('@')[1] || '';
  const localPart = normalizedEmail.split('@')[0] || '';

  // ── ORG prefix: first 3 chars of domain root (before first dot) ──────────
  const domainRoot = domain.split('.')[0] || 'usr';
  const org = domainRoot.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');

  // ── INITIALS: from display_name words, or first 2 chars of local part ────
  let initials = '';
  if (displayName && displayName.trim()) {
    const words = displayName.trim().split(/\s+/);
    initials = words
      .filter(w => w.length > 0)
      .map(w => w[0].toUpperCase())
      .join('')
      .replace(/[^A-Z]/g, '')
      .slice(0, 3);
  }
  if (!initials) {
    initials = localPart.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'X') || 'XX';
  }

  const prefix = `${org}-${initials}-`;

  // ── Sequence: find MAX existing number for this prefix ───────────────────
  const existing = await db.query(
    `SELECT staff_id FROM auth_users
     WHERE staff_id LIKE $1
     ORDER BY staff_id DESC`,
    [`${prefix}%`]
  );

  let maxNum = 0;
  for (const row of existing.rows) {
    const tail = row.staff_id.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }

  const seq = String(maxNum + 1).padStart(4, '0');
  return `${prefix}${seq}`;
}
