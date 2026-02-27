// app/lms/settings/page.js
'use client';
import { useState, useRef } from 'react';
import { apiFetch, useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  // Display name state
  const [nameForm,    setNameForm]    = useState('');
  const [nameSaving,  setNameSaving]  = useState(false);
  const [nameError,   setNameError]   = useState('');
  const [nameSuccess, setNameSuccess] = useState(false);
  const [editingName, setEditingName] = useState(false);

  // Password change state
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwError,    setPwError]    = useState('');
  const [pwSuccess,  setPwSuccess]  = useState(false);
  const [showPw,     setShowPw]     = useState(false);
  const showPwTimer = useRef(null);
  const toggleShowPw = () => {
    const next = !showPw;
    setShowPw(next);
    clearTimeout(showPwTimer.current);
    if (next) showPwTimer.current = setTimeout(() => setShowPw(false), 7000);
  };

  const handleChangeName = async (e) => {
    e.preventDefault();
    setNameError(''); setNameSuccess(false);
    if (!nameForm.trim()) { setNameError('Display name cannot be empty.'); return; }
    setNameSaving(true);
    try {
      const r = await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: nameForm.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setNameSuccess(true);
      setEditingName(false);
      refreshUser(); // re-fetch JWT data so display name updates in sidebar
    } catch (err) { setNameError(err.message); }
    finally { setNameSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError('New passwords do not match.'); return; }
    if (newPw.length < 8)    { setPwError('New password must be at least 8 characters.'); return; }
    setPwSaving(true);
    try {
      const r = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setPwSuccess(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) { setPwError(err.message); }
    finally { setPwSaving(false); }
  };

  const strength = (pw) => {
    if (!pw) return null;
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: 'Weak',        color: 'bg-red-500',    w: '20%' };
    if (score <= 2) return { label: 'Fair',        color: 'bg-yellow-500', w: '40%' };
    if (score <= 3) return { label: 'Good',        color: 'bg-blue-500',   w: '60%' };
    if (score <= 4) return { label: 'Strong',      color: 'bg-green-500',  w: '80%' };
    return             { label: 'Very Strong',  color: 'bg-green-600',  w: '100%' };
  };

  const pwStr = strength(newPw);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-cortex-text mb-6">Account Settings</h1>

      {/* Profile info */}
      <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-cortex-text">Profile</h2>
          {!editingName && (
            <button onClick={() => { setNameForm(user?.display_name || ''); setEditingName(true); setNameSuccess(false); setNameError(''); }}
              className="text-xs px-3 py-1.5 border border-cortex-border text-cortex-muted rounded-lg hover:text-cortex-text hover:bg-cortex-bg transition">
              Edit Name
            </button>
          )}
        </div>

        {!editingName ? (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {(user?.display_name || user?.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-cortex-text">{user?.display_name || <span className="text-cortex-muted italic">No display name set</span>}</div>
              <div className="text-sm text-cortex-muted">{user?.email}</div>
              <div className="text-xs text-cortex-muted mt-0.5 capitalize">{user?.role}</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleChangeName} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Display Name *</label>
              <input value={nameForm} onChange={e => setNameForm(e.target.value)} required autoFocus
                className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                placeholder="Your full name" />
            </div>
            {nameError && <div className="text-red-500 text-sm">{nameError}</div>}
            {nameSuccess && <div className="text-green-600 dark:text-green-400 text-sm">✅ Name updated!</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={nameSaving}
                className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                {nameSaving ? 'Saving…' : 'Save Name'}
              </button>
              <button type="button" onClick={() => setEditingName(false)}
                className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                Cancel
              </button>
            </div>
          </form>
        )}
        {nameSuccess && !editingName && (
          <div className="mt-3 text-sm text-green-600 dark:text-green-400">✅ Display name updated!</div>
        )}
      </div>

      {/* Password change */}
      <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
        <h2 className="font-semibold text-cortex-text mb-1">Change Password</h2>
        <p className="text-xs text-cortex-muted mb-5">Use a strong password with at least 8 characters.</p>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Current Password *</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 pr-10 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                placeholder="Your current password"
              />
              <button type="button" onClick={toggleShowPw}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cortex-muted hover:text-cortex-text transition">
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-cortex-muted block mb-1.5">New Password *</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              placeholder="At least 8 characters"
            />
            {pwStr && (
              <div className="mt-2">
                <div className="h-1.5 bg-cortex-border rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pwStr.color}`} style={{width: pwStr.w}} />
                </div>
                <div className={`text-[11px] mt-1 ${pwStr.color.replace('bg-','text-')}`}>{pwStr.label}</div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Confirm New Password *</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              required
              autoComplete="new-password"
              className={`w-full bg-cortex-bg border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent ${
                confirmPw && confirmPw !== newPw ? 'border-red-400' : 'border-cortex-border'
              }`}
              placeholder="Re-enter new password"
            />
            {confirmPw && confirmPw !== newPw && (
              <p className="text-red-500 text-[11px] mt-1">Passwords do not match</p>
            )}
          </div>

          {pwError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-red-600 dark:text-red-400 text-sm">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-green-600 dark:text-green-400 text-sm">
              ✅ Password changed successfully!
            </div>
          )}

          <button type="submit"
            disabled={pwSaving || !currentPw || !newPw || !confirmPw || newPw !== confirmPw}
            className="w-full bg-cortex-accent text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
            {pwSaving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
