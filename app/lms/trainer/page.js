// app/lms/trainer/page.js
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch, useAuth } from '@/lib/auth';

const STATUS_STYLES = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ongoing:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const ATTEND_STYLES = {
  enrolled: 'bg-cortex-border text-cortex-muted',
  present:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  absent:   'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
const sessionDateStr = (s) => String(s.scheduled_date).slice(0, 10); // "YYYY-MM-DD"

// Build calendar grid for a given month (array of day numbers or null for empty cells)
function buildMonthGrid(year, month) {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const lastDay  = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  return cells;
}

export default function TrainerPage() {
  const { user } = useAuth();
  const [sessions,     setSessions]     = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [enrollments,  setEnrollments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState('attendance');
  const [attendSaving, setAttendSaving] = useState({});

  // Sidebar view mode: list or calendar
  const [viewMode,  setViewMode]  = useState('list');
  const [calMonth,  setCalMonth]  = useState(() => new Date());

  // Chat state
  const [messages,     setMessages]     = useState([]);
  const [chatInput,    setChatInput]    = useState('');
  const [chatLoading,  setChatLoading]  = useState(false);
  const [chatSending,  setChatSending]  = useState(false);
  const chatBottomRef = useRef(null);
  const chatPollRef   = useRef(null);

  const loadSessions = useCallback(async () => {
    const d = await apiFetch('/api/lms/trainer/sessions').then(r => r?.json());
    if (d) {
      setSessions(d);
      setSelected(prev => prev ? (d.find(s => s.id === prev.id) || prev) : null);
    }
    setLoading(false);
  }, []);

  const loadEnrollments = useCallback(async (id) => {
    const d = await apiFetch(`/api/lms/trainer/sessions/${id}/enrollments`).then(r => r?.json());
    if (d) setEnrollments(d);
  }, []);

  const loadMessages = useCallback(async (id) => {
    const d = await apiFetch(`/api/lms/sessions/${id}/messages`).then(r => r?.json());
    if (Array.isArray(d)) {
      setMessages(d);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (!selected) return;
    loadEnrollments(selected.id);
    setMessages([]);
    setChatInput('');
  }, [selected?.id]);

  useEffect(() => {
    if (activeTab === 'chat' && selected) {
      setChatLoading(true);
      loadMessages(selected.id).finally(() => setChatLoading(false));
      chatPollRef.current = setInterval(() => loadMessages(selected.id), 10_000);
    } else {
      clearInterval(chatPollRef.current);
    }
    return () => clearInterval(chatPollRef.current);
  }, [activeTab, selected?.id]);

  const markAttendance = async (userId, status) => {
    setAttendSaving(p => ({ ...p, [userId]: true }));
    await apiFetch(`/api/lms/trainer/sessions/${selected.id}/attendance`, {
      method: 'PUT', body: JSON.stringify({ attendances: [{ user_id: userId, status }] })
    });
    await loadEnrollments(selected.id);
    setAttendSaving(p => ({ ...p, [userId]: false }));
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || chatSending) return;
    setChatSending(true);
    await apiFetch(`/api/lms/sessions/${selected.id}/messages`, {
      method: 'POST', body: JSON.stringify({ message: chatInput.trim() })
    });
    setChatInput('');
    await loadMessages(selected.id);
    setChatSending(false);
  };

  if (loading) return (
    <div className="p-8 text-cortex-muted flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
      Loading sessions…
    </div>
  );

  // Attendance analytics
  const total    = enrollments.length;
  const acked    = enrollments.filter(e => e.acknowledged_at).length;
  const present  = enrollments.filter(e => e.attendance_status === 'present').length;
  const absent   = enrollments.filter(e => e.attendance_status === 'absent').length;
  const unmarked = total - present - absent;

  // Calendar helpers
  const calYear  = calMonth.getFullYear();
  const calMon   = calMonth.getMonth();
  const cells    = buildMonthGrid(calYear, calMon);
  const monthLabel = calMonth.toLocaleDateString('en-AE', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex h-full">
      {/* ── Session list sidebar ── */}
      <div className="w-72 flex-shrink-0 border-r border-cortex-border bg-cortex-surface flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-cortex-border">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="font-semibold text-cortex-text text-sm">My Sessions</h1>
              <p className="text-xs text-cortex-muted">{user?.display_name || user?.email}</p>
            </div>
            {/* View toggle */}
            <div className="flex gap-0.5 bg-cortex-bg border border-cortex-border rounded-lg p-0.5">
              <button onClick={() => setViewMode('list')} title="List view"
                className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-cortex-surface shadow-sm text-cortex-text' : 'text-cortex-muted hover:text-cortex-text'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
              <button onClick={() => setViewMode('calendar')} title="Calendar view"
                className={`p-1.5 rounded-md transition ${viewMode === 'calendar' ? 'bg-cortex-surface shadow-sm text-cortex-text' : 'text-cortex-muted hover:text-cortex-text'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── List view ── */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sessions.length === 0 && (
              <div className="text-cortex-muted text-sm text-center py-12">No sessions assigned yet</div>
            )}
            {sessions.map(s => (
              <button key={s.id} onClick={() => setSelected(s)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  selected?.id === s.id ? 'border-cortex-accent bg-cortex-accent/5' : 'border-cortex-border bg-cortex-bg hover:border-cortex-muted/50'
                }`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-cortex-text text-sm font-medium leading-tight line-clamp-2">{s.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[s.computed_status || s.status]}`}>
                    {s.computed_status || s.status}
                  </span>
                </div>
                <div className="text-cortex-muted text-xs">{fmt(s.scheduled_date)}</div>
                <div className="text-cortex-muted text-xs">{s.start_time} – {s.end_time}</div>
                {s.location && <div className="text-cortex-muted text-xs truncate">📍 {s.location}</div>}
                <div className="flex gap-3 mt-1 text-xs text-cortex-muted">
                  <span>👥 {s.enrolled_count || 0}</span>
                  {(s.present_count > 0 || s.absent_count > 0) && <>
                    <span className="text-green-600">✓ {s.present_count}</span>
                    <span className="text-red-500">✗ {s.absent_count}</span>
                  </>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Calendar view ── */}
        {viewMode === 'calendar' && (
          <div className="flex-1 overflow-y-auto p-3">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                className="text-cortex-muted hover:text-cortex-text transition px-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-xs font-semibold text-cortex-text">{monthLabel}</span>
              <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                className="text-cortex-muted hover:text-cortex-text transition px-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <div key={d} className="text-center text-[10px] text-cortex-muted font-medium py-0.5">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const dateStr = `${calYear}-${String(calMon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const daySessions = sessions.filter(s => sessionDateStr(s) === dateStr);
                const isToday    = dateStr === todayStr;
                const isSelected = daySessions.some(s => s.id === selected?.id);
                const hasSessions = daySessions.length > 0;
                return (
                  <button key={i}
                    onClick={() => hasSessions && setSelected(daySessions[0])}
                    disabled={!hasSessions}
                    className={`relative flex flex-col items-center justify-center h-8 rounded-lg text-xs transition
                      ${isSelected  ? 'bg-cortex-accent text-white font-bold' :
                        isToday     ? 'bg-cortex-accent/15 text-cortex-accent font-bold' :
                        hasSessions ? 'text-cortex-text font-semibold hover:bg-cortex-bg cursor-pointer' :
                                      'text-cortex-muted/60 cursor-default'}`}>
                    {day}
                    {hasSessions && !isSelected && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-cortex-accent" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sessions for selected day (if any) */}
            {(() => {
              const today = new Date();
              const daySessions = sessions.filter(s => {
                const d = sessionDateStr(s);
                if (selected && sessionDateStr(selected) === d) return true;
                return false;
              });
              if (!selected) return null;
              const daySess = sessions.filter(s => sessionDateStr(s) === sessionDateStr(selected));
              if (daySess.length <= 1) return null;
              return (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] text-cortex-muted font-semibold uppercase">Sessions this day</p>
                  {daySess.map(s => (
                    <button key={s.id} onClick={() => setSelected(s)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg border text-xs transition ${
                        selected?.id === s.id ? 'border-cortex-accent bg-cortex-accent/5 text-cortex-text' : 'border-cortex-border text-cortex-muted hover:text-cortex-text'
                      }`}>
                      {s.title}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-cortex-muted">
            <div className="text-center">
              <div className="text-5xl mb-3">📅</div>
              <div className="text-sm">Select a session to view details</div>
            </div>
          </div>
        ) : (
          <>
            {/* Session header */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-xl font-bold text-cortex-text">{selected.title}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[selected.computed_status || selected.status]}`}>
                  {selected.computed_status || selected.status}
                </span>
              </div>
              <div className="text-cortex-muted text-sm">
                {fmt(selected.scheduled_date)} · {selected.start_time} – {selected.end_time}
                {selected.location && <> · 📍 {selected.location}</>}
              </div>
              {selected.description && <div className="text-cortex-muted text-sm mt-2">{selected.description}</div>}

              {selected.google_meet_link && (
                <div className="flex gap-3 mt-3 flex-wrap">
                  <a href={selected.google_meet_link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:opacity-80 transition font-medium">
                    📹 Join Google Meet
                  </a>
                  {selected.google_calendar_link && (
                    <a href={selected.google_calendar_link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-cortex-border text-cortex-muted hover:bg-cortex-bg transition">
                      📅 View in Calendar
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-cortex-bg border border-cortex-border rounded-xl p-1 mb-5 w-fit">
              {[['attendance', '👥 Attendance'], ['chat', '💬 Session Chat']].map(([v, l]) => (
                <button key={v} onClick={() => setActiveTab(v)}
                  className={`px-4 py-1.5 rounded-lg text-sm transition ${activeTab === v ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── Attendance tab ── */}
            {activeTab === 'attendance' && (
              <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">

                {/* Analytics summary cards */}
                {total > 0 && (
                  <div className="grid grid-cols-5 divide-x divide-cortex-border border-b border-cortex-border bg-cortex-bg/30">
                    {[
                      { label: 'Enrolled',    value: total,    color: 'text-cortex-text'  },
                      { label: 'Acknowledged',value: acked,    color: 'text-cortex-accent'},
                      { label: 'Present',     value: present,  color: 'text-green-600'    },
                      { label: 'Absent',      value: absent,   color: 'text-red-500'      },
                      { label: 'Not Marked',  value: unmarked, color: 'text-cortex-muted' },
                    ].map(s => (
                      <div key={s.label} className="px-4 py-3 text-center">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] text-cortex-muted mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attendance rate bar */}
                {total > 0 && (
                  <div className="px-5 py-3 border-b border-cortex-border">
                    <div className="flex justify-between text-[11px] text-cortex-muted mb-1">
                      <span>Attendance Rate</span>
                      <span>{total > 0 ? Math.round((present / total) * 100) : 0}%</span>
                    </div>
                    <div className="h-1.5 bg-cortex-border rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: total > 0 ? `${(present / total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                )}

                <div className="px-5 py-2.5 border-b border-cortex-border">
                  <h3 className="font-semibold text-cortex-text text-sm">Learners ({total})</h3>
                </div>

                {total === 0 ? (
                  <div className="p-8 text-center text-cortex-muted text-sm">No learners enrolled</div>
                ) : (
                  <div className="divide-y divide-cortex-border">
                    {enrollments.map(e => (
                      <div key={e.user_id} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-8 h-8 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {(e.display_name || e.email)[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-cortex-text truncate">{e.display_name || e.email}</div>
                          <div className="text-xs text-cortex-muted flex gap-2 flex-wrap">
                            <span>{e.email}</span>
                            {e.learner_type_name && <span>· {e.learner_type_name}</span>}
                            {e.acknowledged_at && <span className="text-cortex-accent">· ✓ Ack'd</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ATTEND_STYLES[e.attendance_status]}`}>
                            {e.attendance_status}
                          </span>
                          {selected.status !== 'cancelled' && (
                            <>
                              <button
                                disabled={attendSaving[e.user_id] || e.attendance_status === 'present'}
                                onClick={() => markAttendance(e.user_id, 'present')}
                                title="Mark present"
                                className="text-xs px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 disabled:opacity-40 hover:opacity-80 transition">✓</button>
                              <button
                                disabled={attendSaving[e.user_id] || e.attendance_status === 'absent'}
                                onClick={() => markAttendance(e.user_id, 'absent')}
                                title="Mark absent"
                                className="text-xs px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-500 disabled:opacity-40 hover:opacity-80 transition">✗</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Chat tab ── */}
            {activeTab === 'chat' && (
              <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden flex flex-col" style={{ height: '420px' }}>
                <div className="px-5 py-3 border-b border-cortex-border flex-shrink-0">
                  <h3 className="font-semibold text-cortex-text text-sm">Session Chat</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatLoading ? (
                    <div className="flex items-center justify-center h-full text-cortex-muted text-sm">
                      <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin mr-2" />
                      Loading…
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-cortex-muted text-sm">No messages yet</div>
                  ) : (
                    messages.map(m => {
                      const isMe = m.user_id === user?.id;
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-cortex-accent text-white' : 'bg-cortex-bg border border-cortex-border text-cortex-text'}`}>
                            {!isMe && <div className="text-[11px] font-semibold mb-1 opacity-70">{m.display_name || m.email}</div>}
                            <div className="text-sm">{m.message}</div>
                            <div className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-cortex-muted'}`}>
                              {new Date(m.created_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <div className="flex-shrink-0 px-4 py-3 border-t border-cortex-border flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type a message…"
                    className="flex-1 bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                  <button onClick={sendMessage} disabled={!chatInput.trim() || chatSending}
                    className="px-4 py-2 bg-cortex-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                    Send
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
