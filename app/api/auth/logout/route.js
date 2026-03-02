import { NextResponse } from 'next/server';
import { clearAuthCookie, requireAuth } from '@/lib/server-auth';
import { getPool } from '@/lib/db';

export async function POST(request) {
  const pool = getPool();

  // Attempt to get the current user so we can clear their AI companion session
  try {
    const { user } = await requireAuth(request);
    if (user) {
      const userId = user.id || user.sub;
      await pool.query(
        'DELETE FROM ai_companion_sessions WHERE user_id = $1',
        [String(userId)]
      );
    }
  } catch {
    // If we can't get the user or delete the session, proceed with logout anyway
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}
