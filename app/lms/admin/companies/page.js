// app/lms/admin/companies/page.js
'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

const EMPTY_FORM = { company_code: '', company_name: '', description: '', domain: '' };

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // 'add' | 'edit'
  const [target,    setTarget]    = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await apiFetch('/api/lms/admin/companies').then(r => r?.json());
    if (d) setCompanies(d);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError('');
    setModal('add');
  };

  const openEdit = (c) => {
    setTarget(c);
    setForm({
      company_name: c.company_name,
      description:  c.description || '',
      domain:       c.domain || '',
    });
    setDeleteConfirm(false);
    setError('');
    setModal('edit');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const r = await apiFetch('/api/lms/admin/companies', { method: 'POST', body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setModal(null); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const r = await apiFetch(`/api/lms/admin/companies/${target.id}`, { method: 'PUT', body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setModal(null); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true); setError('');
    try {
      const r = await apiFetch(`/api/lms/admin/companies/${target.id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setModal(null); await load();
    } catch (err) { setError(err.message); setSaving(false); }
  };

  const handleToggleActive = async (c) => {
    await apiFetch(`/api/lms/admin/companies/${c.id}`, {
      method: 'PUT', body: JSON.stringify({ is_active: !c.is_active })
    });
    await load();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-cortex-text">Organisations</h1>
          <p className="text-cortex-muted text-sm mt-0.5">Manage companies and organisations in the system</p>
        </div>
        <button onClick={openAdd}
          className="bg-cortex-accent text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition font-medium">
          + Add Organisation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Orgs',   value: companies.length,                            color: 'text-cortex-text' },
          { label: 'Active',       value: companies.filter(c => c.is_active).length,   color: 'text-green-600' },
          { label: 'Total Users',  value: companies.reduce((a, c) => a + (c.user_count || 0), 0), color: 'text-cortex-accent' },
        ].map(m => (
          <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-cortex-muted py-8">
          <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : companies.length === 0 ? (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
          <div className="text-4xl mb-3">🏢</div>
          <div className="text-sm mb-3">No organisations yet</div>
          <button onClick={openAdd} className="bg-cortex-accent text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition">
            Add First Organisation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map(c => (
            <div key={c.id} className={`bg-cortex-surface border rounded-xl px-5 py-4 flex items-center gap-4 transition ${c.is_active ? 'border-cortex-border' : 'border-cortex-border opacity-60'}`}>
              {/* Logo placeholder */}
              <div className="w-10 h-10 rounded-xl bg-cortex-accent/15 text-cortex-accent flex items-center justify-center text-base font-bold flex-shrink-0">
                {c.company_name[0].toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-cortex-text">{c.company_name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-cortex-border text-cortex-muted font-mono">
                    {c.company_code}
                  </span>
                  {!c.is_active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cortex-border text-cortex-muted">Inactive</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  {c.description && <span className="text-xs text-cortex-muted truncate max-w-xs">{c.description}</span>}
                  {c.domain && <span className="text-xs text-cortex-muted">🌐 {c.domain}</span>}
                </div>
              </div>

              {/* User count */}
              <div className="text-center flex-shrink-0">
                <div className="text-lg font-bold text-cortex-text">{c.user_count || 0}</div>
                <div className="text-[10px] text-cortex-muted">users</div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => handleToggleActive(c)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${c.is_active ? 'border-cortex-border text-cortex-muted hover:bg-cortex-bg' : 'border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                  {c.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => openEdit(c)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg transition">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Modal ── */}
      {modal === 'add' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border flex items-center justify-between">
              <h2 className="font-semibold text-cortex-text">Add Organisation</h2>
              <button onClick={() => setModal(null)} className="text-cortex-muted hover:text-cortex-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Company Code *</label>
                  <input value={form.company_code} onChange={e => setForm(p => ({ ...p, company_code: e.target.value.toUpperCase() }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent font-mono uppercase"
                    placeholder="ACME" maxLength={20} />
                  <p className="text-[10px] text-cortex-muted mt-1">Short unique identifier</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Organisation Name *</label>
                  <input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="Acme Corporation" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Domain</label>
                <input value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder="acme.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent resize-none"
                  placeholder="Optional description" />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Creating…' : 'Create Organisation'}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {modal === 'edit' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-cortex-text">Edit Organisation</h2>
                <p className="text-xs text-cortex-muted mt-0.5 font-mono">{target?.company_code}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-cortex-muted hover:text-cortex-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Organisation Name *</label>
                <input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Domain</label>
                <input value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder="acme.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent resize-none" />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                  Cancel
                </button>
              </div>
              {/* Delete */}
              <div className="border-t border-cortex-border pt-3">
                {!deleteConfirm ? (
                  <button type="button" onClick={() => setDeleteConfirm(true)}
                    className="text-xs text-cortex-danger hover:underline">
                    Delete this organisation
                  </button>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">Delete {target?.company_name}?</p>
                    <p className="text-xs text-red-500 mb-3">Cannot delete if users are assigned to this org.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleDelete} disabled={saving}
                        className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                        {saving ? '…' : 'Delete'}
                      </button>
                      <button type="button" onClick={() => setDeleteConfirm(false)}
                        className="flex-1 border border-cortex-border text-cortex-muted py-1.5 rounded-lg text-xs hover:bg-cortex-bg">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
