// app/lms/admin/analytics/page.js
'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

const EVENT_LABELS = {
  video_play:                { icon: '▶️', label: 'Video Play' },
  video_pause:               { icon: '⏸', label: 'Video Pause' },
  video_seek:                { icon: '⏩', label: 'Video Seek' },
  video_progress_heartbeat:  { icon: '💓', label: 'Watch Progress' },
  manual_view_heartbeat:     { icon: '📖', label: 'Reading' },
  idle_start:                { icon: '😴', label: 'Idle Start' },
  idle_end:                  { icon: '⚡', label: 'Idle End' },
  lesson_complete:           { icon: '🏆', label: 'Completed' },
  page_view:                 { icon: '👁', label: 'Page View' },
};

const fmtSecs = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function AnalyticsPage() {
  return <Suspense><AnalyticsInner /></Suspense>;
}

function AnalyticsInner() {
  const searchParams   = useSearchParams();
  const preselectedUser = searchParams.get('user');

  // Filter state
  const [companies,    setCompanies]    = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [filterOrg,    setFilterOrg]    = useState('');
  const [filterDept,   setFilterDept]   = useState('');

  // Tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'sessions' | 'learners' | 'feedback'

  // Overview
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Session analytics
  const [sessions,        setSessions]        = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  // Feedback analytics
  const [feedback,        setFeedback]        = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackType,    setFeedbackType]    = useState('session'); // 'session' | 'course'
  const [expandedFb,      setExpandedFb]      = useState(null);

  // Learner analytics
  const [learners,      setLearners]      = useState([]);
  const [selectedUser,  setSelectedUser]  = useState(null);
  const [userDetail,    setUserDetail]    = useState(null);
  const [selectedLS,    setSelectedLS]    = useState(null); // learning session
  const [timeline,      setTimeline]      = useState(null);
  const [playhead,      setPlayhead]      = useState(0);
  const [playing,       setPlaying]       = useState(false);
  const intervalRef = useRef(null);

  // ── Load filter options ───────────────────────────────────────────────────
  useEffect(() => {
    apiFetch('/api/lms/admin/companies').then(r => r?.json()).then(d => { if (d) setCompanies(d); });
    apiFetch('/api/lms/admin/departments').then(r => r?.json()).then(d => { if (d) setDepartments(d); });
    apiFetch('/api/lms/admin/progress/users').then(r => r?.json()).then(d => {
      if (d) {
        setLearners(d);
        if (preselectedUser) {
          const found = d.find(l => l.id === preselectedUser);
          if (found) loadUser(found);
        }
      }
    });
  }, []);

  const filterQuery = () => {
    const p = new URLSearchParams();
    if (filterOrg)  p.set('company_id', filterOrg);
    if (filterDept) p.set('department_id', filterDept);
    return p.toString() ? '?' + p.toString() : '';
  };

  // ── Load overview ─────────────────────────────────────────────────────────
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    const d = await apiFetch(`/api/lms/admin/analytics/overview${filterQuery()}`).then(r => r?.json());
    if (d) setOverview(d);
    setOverviewLoading(false);
  }, [filterOrg, filterDept]);

  // ── Load sessions ─────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    const d = await apiFetch(`/api/lms/admin/analytics/sessions${filterQuery()}`).then(r => r?.json());
    if (d) setSessions(d);
    setSessionsLoading(false);
  }, [filterOrg, filterDept]);

  // ── Load feedback ─────────────────────────────────────────────────────────
  const loadFeedback = useCallback(async (type) => {
    setFeedbackLoading(true);
    const q = new URLSearchParams({ reference_type: type || feedbackType });
    if (filterOrg)  q.set('company_id', filterOrg);
    if (filterDept) q.set('department_id', filterDept);
    const d = await apiFetch(`/api/lms/admin/analytics/feedback?${q}`).then(r => r?.json());
    if (Array.isArray(d)) setFeedback(d);
    setFeedbackLoading(false);
  }, [filterOrg, filterDept, feedbackType]);

  useEffect(() => {
    loadOverview();
    if (activeTab === 'sessions') loadSessions();
    if (activeTab === 'feedback') loadFeedback();
  }, [filterOrg, filterDept]);

  useEffect(() => {
    if (activeTab === 'sessions' && sessions.length === 0) loadSessions();
    if (activeTab === 'overview') loadOverview();
    if (activeTab === 'feedback') loadFeedback();
  }, [activeTab]);

  // ── Load learner detail ────────────────────────────────────────────────────
  const loadUser = async (user) => {
    setSelectedUser(user); setSelectedLS(null); setTimeline(null);
    const d = await apiFetch(`/api/lms/admin/progress/users/${user.id}`).then(r => r?.json());
    if (d) setUserDetail(d);
  };

  const loadTimeline = async (session) => {
    setSelectedLS(session);
    const d = await apiFetch(`/api/lms/admin/sessions/${session.id}/timeline`).then(r => r?.json());
    if (d) { setTimeline(d); setPlayhead(0); setPlaying(false); }
  };

  useEffect(() => {
    if (playing && timeline) {
      intervalRef.current = setInterval(() => {
        setPlayhead(p => {
          if (p >= timeline.events.length - 1) { setPlaying(false); return p; }
          return p + 1;
        });
      }, 600);
    } else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [playing, timeline]);

  // ── Dept options (filtered by org) ────────────────────────────────────────
  const deptOptions = departments.filter(d => !d.parent_id && (!filterOrg || String(d.company_id) === filterOrg));
  const subDeptOptions = filterDept
    ? departments.filter(d => String(d.parent_id) === filterDept)
    : [];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-cortex-border bg-cortex-surface gap-4 flex-wrap">
        <h1 className="text-lg font-bold text-cortex-text">Analytics</h1>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterOrg} onChange={e => { setFilterOrg(e.target.value); setFilterDept(''); }}
            className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
            <option value="">All Organizations</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
            <option value="">All Departments</option>
            {deptOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            {subDeptOptions.map(d => <option key={d.id} value={d.id}>↳ {d.name}</option>)}
          </select>

          {/* Tabs */}
          <div className="flex border border-cortex-border rounded-lg overflow-hidden text-sm ml-2">
            {[['overview','📊 Overview'],['sessions','🗓 Sessions'],['learners','👤 Learners'],['feedback','⭐ Feedback']].map(([v,l]) => (
              <button key={v} onClick={() => setActiveTab(v)}
                className={`px-3 py-1.5 transition ${activeTab===v ? 'bg-cortex-accent text-white' : 'text-cortex-muted hover:bg-cortex-bg'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {overviewLoading && <div className="text-center text-cortex-muted py-12">Loading overview…</div>}
            {overview && (
              <>
                {/* KPI grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Users',        value: overview.users.total_users,      color: 'text-cortex-text',    sub: `${overview.users.learners} learners · ${overview.users.trainers} trainers` },
                    { label: 'Training Sessions',  value: overview.sessions.total_sessions, color: 'text-cortex-accent',  sub: `${overview.sessions.upcoming_sessions} upcoming` },
                    { label: 'Avg Attendance',     value: `${overview.sessions.avg_attendance_pct}%`, color: 'text-green-600 dark:text-green-400', sub: 'across all sessions' },
                    { label: 'Total Watch Time',   value: fmtSecs(Number(overview.progress.total_watch_seconds) || 0), color: 'text-blue-600 dark:text-blue-400', sub: `${overview.progress.completions} completions` },
                  ].map(m => (
                    <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                      <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
                      <div className="text-sm font-medium text-cortex-text mt-1">{m.label}</div>
                      <div className="text-xs text-cortex-muted mt-0.5">{m.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Second row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Online Sessions',   value: overview.sessions.online_sessions,   color: 'text-blue-500' },
                    { label: 'In-Person Sessions',value: overview.sessions.inperson_sessions, color: 'text-cortex-accent' },
                    { label: 'Completed Sessions',value: overview.sessions.completed_sessions, color: 'text-green-600' },
                    { label: 'Total Lessons',     value: overview.content.total_lessons,       color: 'text-cortex-text' },
                  ].map(m => (
                    <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-4">
                      <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                      <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* User breakdown */}
                <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                  <h3 className="font-semibold text-cortex-text mb-4">User Activity Breakdown</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Active Users',        value: overview.users.active_users },
                      { label: 'Lesson Completions',  value: overview.progress.completions },
                      { label: 'Progress Records',    value: overview.progress.progress_records },
                    ].map(m => (
                      <div key={m.label} className="text-center bg-cortex-bg border border-cortex-border rounded-xl p-4">
                        <div className="text-2xl font-bold text-cortex-text">{m.value}</div>
                        <div className="text-xs text-cortex-muted mt-1">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SESSIONS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            {sessionsLoading && <div className="text-center text-cortex-muted py-12">Loading sessions…</div>}
            {!sessionsLoading && sessions.length === 0 && (
              <div className="text-center text-cortex-muted py-12">No sessions found for the selected filters.</div>
            )}
            {sessions.map(s => {
              const isSelected = selectedSession?.id === s.id;
              return (
                <div key={s.id} className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
                  {/* Session row */}
                  <button
                    onClick={() => setSelectedSession(isSelected ? null : s)}
                    className="w-full text-left px-5 py-4 hover:bg-cortex-bg/50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-cortex-text">{s.title}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            s.session_mode === 'online'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-cortex-border text-cortex-muted'
                          }`}>
                            {s.session_mode === 'online' ? '💻 Online' : '🏢 In Person'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            s.status === 'completed' ? 'bg-green-100 text-green-700' :
                            s.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                            'bg-cortex-accent/15 text-cortex-accent'
                          }`}>{s.status}</span>
                        </div>
                        <div className="text-xs text-cortex-muted">
                          📅 {new Date(s.scheduled_date + 'T00:00:00').toLocaleDateString('en-AE', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                          &nbsp;·&nbsp;{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}
                          {s.trainer_name && <>&nbsp;·&nbsp;👤 {s.trainer_name}</>}
                          {s.location && <>&nbsp;·&nbsp;📍 {s.location}</>}
                        </div>
                      </div>

                      {/* Attendance mini-stats */}
                      <div className="flex items-center gap-6 flex-shrink-0">
                        <div className="text-center">
                          <div className="text-lg font-bold text-cortex-text">{s.enrolled}</div>
                          <div className="text-[10px] text-cortex-muted">Enrolled</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{s.present}</div>
                          <div className="text-[10px] text-cortex-muted">Present</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-red-500">{s.absent}</div>
                          <div className="text-[10px] text-cortex-muted">Absent</div>
                        </div>
                        <div className="text-center min-w-[60px]">
                          {/* Attendance ring */}
                          <div className="relative w-12 h-12 mx-auto">
                            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3"
                                className="text-cortex-border" />
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3"
                                strokeDasharray={`${s.attendance_pct} ${100 - s.attendance_pct}`}
                                strokeLinecap="round"
                                className={s.attendance_pct >= 75 ? 'text-green-500' : s.attendance_pct >= 50 ? 'text-yellow-500' : 'text-red-500'} />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[11px] font-bold text-cortex-text">{s.attendance_pct}%</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-cortex-muted mt-0.5">Attendance</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`text-cortex-muted transition-transform ${isSelected ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="border-t border-cortex-border bg-cortex-bg/30 px-5 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                        {[
                          { label: 'Enrolled',      value: s.enrolled,     color: 'text-cortex-text' },
                          { label: 'Present',       value: s.present,      color: 'text-green-600' },
                          { label: 'Absent',        value: s.absent,       color: 'text-red-500' },
                          { label: 'Not Marked',    value: s.not_marked,   color: 'text-yellow-600' },
                          { label: 'Acknowledged',  value: s.acknowledged, color: 'text-cortex-accent' },
                        ].map(m => (
                          <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-3 text-center">
                            <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                            <div className="text-[10px] text-cortex-muted">{m.label}</div>
                          </div>
                        ))}
                      </div>
                      {s.description && (
                        <div className="text-sm text-cortex-muted bg-cortex-surface border border-cortex-border rounded-xl p-3">
                          <span className="font-medium text-cortex-text text-xs block mb-1">Description</span>
                          {s.description}
                        </div>
                      )}
                      {/* No-show rate */}
                      {s.enrolled > 0 && (
                        <div className="mt-3 text-sm text-cortex-muted">
                          <span className="text-cortex-text font-medium">Absentee rate: </span>
                          {s.enrolled > 0 ? Math.round(s.absent / s.enrolled * 100) : 0}%
                          {s.not_marked > 0 && <> · <span className="text-yellow-600">{s.not_marked} attendance(s) not yet marked</span></>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── LEARNERS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'learners' && (
          <div className="flex gap-5">
            {/* Learner list */}
            <div className="w-52 flex-shrink-0">
              <div className="bg-cortex-surface border border-cortex-border rounded-xl p-2 sticky top-0">
                <div className="text-[10px] text-cortex-muted px-2 mb-2 font-semibold uppercase tracking-wider">Learners ({learners.length})</div>
                <div className="max-h-[70vh] overflow-y-auto space-y-0.5">
                  {learners.map(l => (
                    <button key={l.id} onClick={() => loadUser(l)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${selectedUser?.id===l.id ? 'bg-cortex-accent text-white' : 'text-cortex-text hover:bg-cortex-bg'}`}>
                      <div className="truncate font-medium">{l.display_name || l.email}</div>
                      <div className="text-[11px] opacity-60 truncate">{l.learner_type || 'No type'}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Detail */}
            <div className="flex-1 space-y-4 min-w-0">
              {!selectedUser ? (
                <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
                  Select a learner to view their activity
                </div>
              ) : !userDetail ? (
                <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
                  Loading…
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h2 className="font-bold text-cortex-text mb-4">
                      {userDetail.user?.display_name || userDetail.user?.email} — Progress Summary
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                      {[
                        { label: 'Lessons Completed', value: userDetail.progress.filter(p=>p.completed).length,     color: 'text-green-600' },
                        { label: 'In Progress',       value: userDetail.progress.filter(p=>!p.completed && p.percent_watched > 0).length, color: 'text-yellow-600' },
                        { label: 'Total Watch Time',  value: fmtSecs(userDetail.progress.reduce((a,p)=>a+(p.total_watch_seconds||0),0)), color: 'text-cortex-accent' },
                        { label: 'Learning Sessions', value: userDetail.sessions.length,                            color: 'text-cortex-text' },
                      ].map(m => (
                        <div key={m.label} className="bg-cortex-bg border border-cortex-border rounded-xl p-3 text-center">
                          <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                          <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Per-lesson bars */}
                    <div className="space-y-2.5">
                      {userDetail.progress.map(p => (
                        <div key={p.lesson_id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-cortex-text truncate mr-2">{p.lesson_title}</span>
                            <span className="text-cortex-muted flex-shrink-0 flex items-center gap-2">
                              {fmtSecs(p.total_watch_seconds || 0)} watched
                              · {p.watch_count}x
                              · {p.percent_watched}%
                              {p.completed && <span className="text-green-500 font-bold">✓</span>}
                            </span>
                          </div>
                          <div className="h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${p.completed ? 'bg-green-500' : 'bg-cortex-accent'}`}
                              style={{ width: `${p.percent_watched}%` }} />
                          </div>
                        </div>
                      ))}
                      {userDetail.progress.length === 0 && (
                        <div className="text-cortex-muted text-sm">No lesson activity yet</div>
                      )}
                    </div>
                  </div>

                  {/* Learning sessions */}
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h3 className="font-semibold text-cortex-text mb-3">Learning Sessions ({userDetail.sessions.length})</h3>
                    <div className="space-y-1.5">
                      {userDetail.sessions.map(s => (
                        <button key={s.id} onClick={() => loadTimeline(s)}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition ${selectedLS?.id===s.id ? 'bg-cortex-accent text-white' : 'bg-cortex-bg text-cortex-text hover:bg-cortex-border'}`}>
                          <div className="flex justify-between items-center">
                            <span>{new Date(s.session_started_at).toLocaleString('en-AE')}</span>
                            <span className="text-xs opacity-70">{fmtSecs(s.total_active_seconds || 0)} active</span>
                          </div>
                        </button>
                      ))}
                      {!userDetail.sessions.length && <div className="text-cortex-muted text-sm">No sessions yet</div>}
                    </div>
                  </div>

                  {/* Timeline replay */}
                  {timeline && (
                    <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-cortex-text">Session Timeline Replay</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-cortex-muted text-sm">{playhead+1} / {timeline.events.length}</span>
                          <button onClick={() => { setPlayhead(0); setPlaying(false); }}
                            className="border border-cortex-border px-2.5 py-1 rounded-lg text-xs text-cortex-text hover:bg-cortex-bg transition">
                            ↩ Reset
                          </button>
                          <button onClick={() => setPlaying(p=>!p)}
                            className="bg-cortex-accent text-white px-2.5 py-1 rounded-lg text-xs hover:opacity-90 transition">
                            {playing ? '⏸ Pause' : '▶ Play'}
                          </button>
                        </div>
                      </div>

                      <input type="range" min={0} max={timeline.events.length-1} value={playhead}
                        onChange={e => setPlayhead(Number(e.target.value))}
                        className="w-full mb-4 accent-cortex-accent" />

                      {timeline.events[playhead] && (() => {
                        const ev   = timeline.events[playhead];
                        const meta = EVENT_LABELS[ev.event_type] || { icon:'•', label: ev.event_type };
                        return (
                          <div className="bg-cortex-bg rounded-xl p-3 mb-4 border border-cortex-border">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{meta.icon}</span>
                              <span className="text-cortex-text font-semibold text-sm">{meta.label}</span>
                              <span className="text-cortex-muted text-xs ml-auto">{new Date(ev.client_ts).toLocaleTimeString()}</span>
                            </div>
                            {Object.keys(ev.event_payload || {}).length > 0 && (
                              <pre className="text-xs text-cortex-muted mt-2 overflow-x-auto bg-cortex-surface rounded p-2">
                                {JSON.stringify(ev.event_payload, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })()}

                      <div className="space-y-0.5 max-h-52 overflow-y-auto">
                        {timeline.events.slice(0, playhead+1).map((ev, i) => {
                          const meta = EVENT_LABELS[ev.event_type] || { icon:'•' };
                          return (
                            <div key={i} className={`flex items-center gap-2 text-xs py-1 px-2 rounded-lg ${i===playhead ? 'bg-cortex-accent/20 text-cortex-text font-semibold' : 'text-cortex-muted'}`}>
                              <span>{meta.icon}</span>
                              <span>{ev.event_type}</span>
                              <span className="ml-auto opacity-60">{new Date(ev.client_ts).toLocaleTimeString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {/* ── FEEDBACK TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {/* Sub-tabs: session vs course */}
            <div className="flex gap-1 bg-cortex-bg border border-cortex-border rounded-xl p-1 w-fit">
              {[['session', '🗓 Sessions'], ['course', '📚 Courses']].map(([v, l]) => (
                <button key={v} onClick={() => { setFeedbackType(v); loadFeedback(v); }}
                  className={`px-4 py-1.5 rounded-lg text-sm transition ${feedbackType === v ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
                  {l}
                </button>
              ))}
            </div>

            {feedbackLoading && <div className="text-center text-cortex-muted py-12">Loading feedback…</div>}
            {!feedbackLoading && feedback.length === 0 && (
              <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
                <div className="text-4xl mb-3">⭐</div>
                <div className="text-sm">No feedback collected yet for {feedbackType === 'session' ? 'training sessions' : 'courses'}.</div>
              </div>
            )}

            {feedback.map(fb => {
              const key = feedbackType === 'session' ? fb.session_id : fb.course_id;
              const title = feedbackType === 'session' ? fb.session_title : fb.course_title;
              const isExpanded = expandedFb === key;
              const avg = Number(fb.avg_rating) || 0;
              const total = fb.response_count;

              return (
                <div key={key} className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedFb(isExpanded ? null : key)}
                    className="w-full text-left px-5 py-4 hover:bg-cortex-bg/50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-cortex-text truncate">{title}</div>
                        {feedbackType === 'session' && fb.scheduled_date && (
                          <div className="text-xs text-cortex-muted mt-0.5">
                            📅 {new Date(fb.scheduled_date + 'T00:00:00').toLocaleDateString('en-AE', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-6 flex-shrink-0">
                        {/* Star display */}
                        <div className="flex flex-col items-center">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(star => (
                              <svg key={star} width="14" height="14" viewBox="0 0 24 24" fill={avg >= star ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="1.5">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            ))}
                          </div>
                          <div className="text-xs text-amber-500 font-semibold mt-0.5">{avg.toFixed(1)} / 5</div>
                        </div>

                        {/* Response count */}
                        <div className="text-center">
                          <div className="text-lg font-bold text-cortex-text">{total}</div>
                          <div className="text-[10px] text-cortex-muted">responses</div>
                        </div>

                        {/* Rating distribution mini bars */}
                        <div className="flex flex-col gap-0.5 w-24">
                          {[5,4,3,2,1].map(star => {
                            const count = fb[`${['','one','two','three','four','five'][star]}_star`] || 0;
                            const pct = total > 0 ? Math.round(count / total * 100) : 0;
                            return (
                              <div key={star} className="flex items-center gap-1">
                                <span className="text-[10px] text-cortex-muted w-2">{star}</span>
                                <div className="flex-1 h-1.5 bg-cortex-border rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`text-cortex-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded: comments list */}
                  {isExpanded && fb.comments && fb.comments.length > 0 && (
                    <div className="border-t border-cortex-border bg-cortex-bg/30 px-5 py-4">
                      <div className="text-xs font-semibold text-cortex-muted mb-3 uppercase tracking-wider">Written Comments</div>
                      <div className="space-y-3">
                        {fb.comments.map((c, i) => (
                          <div key={i} className="bg-cortex-surface border border-cortex-border rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-cortex-accent/20 text-cortex-accent text-xs flex items-center justify-center font-bold">
                                  {(c.user || '?')[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-cortex-text">{c.user || 'Anonymous'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map(star => (
                                    <svg key={star} width="12" height="12" viewBox="0 0 24 24" fill={c.rating >= star ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="1.5">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                  ))}
                                </div>
                                <span className="text-[10px] text-cortex-muted">
                                  {new Date(c.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-cortex-text">{c.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isExpanded && (!fb.comments || fb.comments.length === 0) && (
                    <div className="border-t border-cortex-border px-5 py-4 text-sm text-cortex-muted">
                      No written comments — ratings only.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
