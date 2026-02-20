import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function POST(request) {
  const { authError, user } = await requireRole(request, 'learner', 'admin', 'training');
  if (authError) return authError;

  const { session_id, lesson_id, events } = await request.json();
  if (!Array.isArray(events) || !events.length) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const pool = getPool();
  try {
    // Build a proper parameterized bulk insert
    const rows = [];
    const queryParams = [];
    events.forEach((e, i) => {
      const base = i * 5;
      rows.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, NOW())`);
      queryParams.push(session_id, user.id, lesson_id, e.event_type, JSON.stringify(e.payload || {}));
    });

    await pool.query(
      `INSERT INTO lms_event_logs (session_id, user_id, lesson_id, event_type, event_payload, client_ts) VALUES ${rows.join(',')}`,
      queryParams
    );

    // Increment active seconds from video heartbeats
    const heartbeats = events.filter(e => e.event_type === 'video_progress_heartbeat');
    if (heartbeats.length > 0 && session_id) {
      await pool.query(
        `UPDATE lms_learning_sessions SET total_active_seconds = total_active_seconds + $1 WHERE id = $2`,
        [heartbeats.length * 5, session_id]
      );
    }

    return NextResponse.json({ ok: true, count: events.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
