import { getPool } from '@/lib/db';

// ── Token management ─────────────────────────────────────────────────────────

async function getValidAccessToken(userId) {
  const pool = getPool();
  const r = await pool.query(
    'SELECT * FROM google_calendar_tokens WHERE user_id = $1',
    [userId]
  );
  if (!r.rows[0]) return null;

  const { access_token, refresh_token, expiry } = r.rows[0];

  // Refresh if expiring within 5 minutes
  if (expiry && Date.now() >= expiry - 300_000) {
    if (!refresh_token) return null;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type:    'refresh_token',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Google token refresh failed:', data);
      return null;
    }
    const newExpiry = Date.now() + data.expires_in * 1000;
    await pool.query(
      `UPDATE google_calendar_tokens SET access_token=$1, expiry=$2, updated_at=NOW() WHERE user_id=$3`,
      [data.access_token, newExpiry, userId]
    );
    return data.access_token;
  }

  return access_token;
}

// Normalize date/time values from PostgreSQL.
// node-postgres converts `date` columns to JS Date objects (in local timezone).
// Using String() or toISOString() on them gives wrong results ("Tue Feb 24..." or shifted UTC date).
// We must use local-time getters to extract the correct calendar date.
function normalizeDateTime(date, time) {
  let d;
  if (date instanceof Date) {
    const y   = date.getFullYear();
    const m   = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    d = `${y}-${m}-${day}`;
  } else {
    // Already a string like "2026-02-24" or "2026-02-24T..."
    d = String(date).slice(0, 10);
  }
  const t = String(time).slice(0, 8); // "HH:MM:SS"
  return `${d}T${t}`;
}

// ── Google Calendar ───────────────────────────────────────────────────────────

export async function createCalendarEvent(userId, session) {
  const token = await getValidAccessToken(userId);
  if (!token) return null;

  const startDT = normalizeDateTime(session.scheduled_date, session.start_time);
  const endDT   = normalizeDateTime(session.scheduled_date, session.end_time);
  console.log('[Calendar] raw date:', session.scheduled_date, 'start:', session.start_time, 'end:', session.end_time);
  console.log('[Calendar] normalized → start:', startDT, 'end:', endDT);

  const body = {
    summary:     session.title,
    description: session.description || '',
    location:    session.location    || '',
    start: { dateTime: startDT, timeZone: 'Asia/Dubai' },
    end:   { dateTime: endDT,   timeZone: 'Asia/Dubai' },
    conferenceData: {
      createRequest: {
        requestId:             `lms-${session.id}-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  console.log('[Calendar] request body:', JSON.stringify(body));

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );

  const resBody = await res.json();
  if (!res.ok) {
    console.error('[Calendar] create failed status:', res.status, 'body:', JSON.stringify(resBody));
    return null;
  }

  console.log('[Calendar] created event id:', resBody.id, 'meet:', resBody.conferenceData?.entryPoints);
  const meetEntry = resBody.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video');
  return {
    event_id:      resBody.id,
    calendar_link: resBody.htmlLink,
    meet_link:     meetEntry?.uri || null,
  };
}

export async function updateCalendarEvent(userId, eventId, session) {
  const token = await getValidAccessToken(userId);
  if (!token) return;

  const body = {
    summary:     session.title,
    description: session.description || '',
    location:    session.location    || '',
    start: { dateTime: normalizeDateTime(session.scheduled_date, session.start_time), timeZone: 'Asia/Dubai' },
    end:   { dateTime: normalizeDateTime(session.scheduled_date, session.end_time),   timeZone: 'Asia/Dubai' },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );
  if (!res.ok) console.error('Google Calendar update failed:', JSON.stringify(await res.json()));
}

export async function deleteCalendarEvent(userId, eventId) {
  if (!eventId) return;
  const token = await getValidAccessToken(userId);
  if (!token) return;

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
}
