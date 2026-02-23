// app/register/page.js
'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', display_name: '', password: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, display_name: form.display_name, password: form.password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-cortex-bg flex items-center justify-center p-4">
        <div className="bg-cortex-surface border border-cortex-border rounded-2xl p-8 w-full max-w-md text-center shadow-xl">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-cortex-text mb-2">Request Submitted!</h1>
          <p className="text-cortex-muted text-sm">
            Your registration request has been submitted. An administrator will review your request and activate your account.
          </p>
          <p className="text-cortex-muted text-sm mt-3">
            You'll be notified once your account is approved.
          </p>
          <Link href="/login"
            className="mt-6 inline-block text-sm text-cortex-accent hover:underline">
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cortex-bg flex items-center justify-center p-4">
      <div className="bg-cortex-surface border border-cortex-border rounded-2xl p-8 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-cortex-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-cortex-text text-sm">Cortex LMS</div>
            <div className="text-cortex-muted text-[10px] uppercase tracking-wider">Request Access</div>
          </div>
        </div>

        <h1 className="text-xl font-bold text-cortex-text mb-1">Create an Account</h1>
        <p className="text-cortex-muted text-sm mb-6">Submit your request and an admin will approve your access.</p>

        {/* Google Sign-Up */}
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 w-full bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-lg py-2.5 transition mb-4 text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          Continue with Google
        </a>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-cortex-border" />
          <span className="text-cortex-muted text-xs">or register with email</span>
          <div className="flex-1 h-px bg-cortex-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-cortex-muted block mb-1.5">Full Name *</label>
            <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} required
              className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              placeholder="Your full name" />
          </div>
          <div>
            <label className="text-xs font-medium text-cortex-muted block mb-1.5">Email Address *</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required
              className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-cortex-muted block mb-1.5">Password *</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required
              className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              placeholder="Min. 6 characters" />
          </div>
          <div>
            <label className="text-xs font-medium text-cortex-muted block mb-1.5">Confirm Password *</label>
            <input type="password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required
              className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              placeholder="Repeat password" />
          </div>

          {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={submitting}
            className="w-full bg-cortex-accent text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition mt-2">
            {submitting ? 'Submitting…' : 'Request Access'}
          </button>
        </form>

        <p className="text-center text-sm text-cortex-muted mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-cortex-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
