'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Plus, RefreshCw, Trash2, Video } from 'lucide-react'
import QuestionBuilder from '@/components/webinar/QuestionBuilder'
import { draftsToQuestions, parseQuestions, toDraft, type DraftQuestion } from '@/lib/webinarQuestions'

const emptyForm = {
  title: '',
  description: '',
  starts_at: '',
  join_url: '',
  fee: '',
  status: 'draft',
}

// stored ISO timestamp -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local"> (local time)
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'rgba(107, 114, 128, 0.15)', color: 'var(--text-secondary)' },
  published: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' },
  closed: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' },
}

export default function AdminWebinarsPage() {
  const supabase = createClient()
  const [webinars, setWebinars] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<string, { paid: number; pending: number }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [drafts, setDrafts] = useState<DraftQuestion[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteCount, setDeleteCount] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const [{ data: webinarRows }, { data: regRows }] = await Promise.all([
      supabase.from('webinars').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('webinar_registrations').select('webinar_id, status'),
    ])
    setWebinars(webinarRows || [])

    const tally: Record<string, { paid: number; pending: number }> = {}
    ;(regRows || []).forEach((r: any) => {
      const t = (tally[r.webinar_id] ||= { paid: 0, pending: 0 })
      if (r.status === 'payment_pending') t.pending += 1
      else t.paid += 1 // 'paid' and 'free' both count as registered
    })
    setCounts(tally)
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDrafts([])
    setShowForm(true)
  }

  const openEdit = (w: any) => {
    setEditingId(w.id)
    setForm({
      title: w.title || '',
      description: w.description || '',
      starts_at: toDatetimeLocalValue(w.starts_at),
      join_url: w.join_url || '',
      fee: w.fee != null ? String(w.fee) : '',
      status: w.status,
    })
    setDrafts(parseQuestions(w.questions).map(toDraft))
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const built = draftsToQuestions(drafts)
    if (built.ok === false) {
      alert(built.message)
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      join_url: form.join_url.trim() || null,
      fee: form.fee ? Number(form.fee) : 0,
      status: form.status,
      questions: built.questions,
      updated_at: new Date().toISOString(),
    }
    const { error } = editingId
      ? await supabase.from('webinars').update(payload).eq('id', editingId)
      : await supabase.from('webinars').insert({ ...payload, created_by: currentUserId })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      await load()
    }
    setSaving(false)
  }

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('webinars').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) alert('Error: ' + error.message)
    else await load()
  }

  const handleOpenDeleteConfirm = async (w: any) => {
    setDeleteTarget(w)
    setDeleteCount(null)
    const { count } = await supabase.from('webinar_registrations').select('id', { count: 'exact', head: true }).eq('webinar_id', w.id)
    setDeleteCount(count ?? 0)
  }

  // Soft delete only — webinar_registrations.webinar_id is `on delete restrict` (0023), and
  // even without that, a real delete would erase payment/registration history. deleted_at
  // hides it from every list (public and admin) immediately; the row and its registrations
  // stay intact for audit — same pattern as Hackathons.
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('webinars').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      alert('Error: ' + error.message)
      return
    }
    setDeleteTarget(null)
    setDeleteCount(null)
    await load()
  }

  const syncPayments = async () => {
    setSyncing(true)
    const res = await postJson<{ checked: number; results: Record<string, number>; errors: number }>(
      '/api/admin/payments/reconcile',
      {}
    )
    setSyncing(false)
    if (!res.success || !res.data) {
      alert('Sync failed: ' + res.message)
      return
    }
    const settled = res.data.results.settled ?? 0
    alert(`Checked ${res.data.checked} unpaid order(s) with Razorpay — ${settled} newly confirmed.` + (res.data.errors ? ` ${res.data.errors} could not be checked.` : ''))
    await load()
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading webinars...</div>
  }

  const label = { display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' } as const

  return (
    <div className="premium-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Video size={28} /> Webinars
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Create webinars and set their fee. Published webinars appear on <code>/webinar</code>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={syncPayments} disabled={syncing} className="btn btn-secondary" title="Re-check unpaid Razorpay orders (Hackathon + Webinar) directly with Razorpay">
            <RefreshCw size={16} /> {syncing ? 'Syncing…' : 'Sync payments'}
          </button>
          <button onClick={() => (showForm ? setShowForm(false) : openCreate())} className="btn btn-primary">
            {showForm ? 'Cancel' : (<><Plus size={18} /> Create Webinar</>)}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="glass-card fade-in" style={{ marginBottom: '32px', borderLeft: '4px solid var(--primary)' }}>
          <h2 style={{ marginBottom: '20px', fontSize: '22px' }}>{editingId ? 'Edit Webinar' : 'New Webinar'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '18px' }}>
              <label style={label}>Title *</label>
              <input name="title" value={form.title} onChange={handleChange} required className="premium-input" placeholder="e.g. Cracking your first internship" />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={label}>Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="premium-input" />
            </div>
            <div className="responsive-grid-2" style={{ marginBottom: '18px' }}>
              <div>
                <label style={label}>Date &amp; time</label>
                <input type="datetime-local" name="starts_at" value={form.starts_at} onChange={handleChange} className="premium-input" />
              </div>
              <div>
                <label style={label}>Fee (₹) — 0 for a free webinar</label>
                <input type="number" min="0" step="1" name="fee" value={form.fee} onChange={handleChange} className="premium-input" placeholder="e.g. 249" />
              </div>
            </div>
            <div className="responsive-grid-2" style={{ marginBottom: '24px' }}>
              <div>
                <label style={label}>Meeting link (shown only after payment)</label>
                <input type="url" name="join_url" value={form.join_url} onChange={handleChange} className="premium-input" placeholder="https://meet.google.com/…" />
              </div>
              <div>
                <label style={label}>Status</label>
                <select name="status" value={form.status} onChange={handleChange} className="premium-input">
                  <option value="draft">Draft (hidden)</option>
                  <option value="published">Published (open for registration)</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <QuestionBuilder value={drafts} onChange={setDrafts} />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Webinar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
                Discard
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Webinar</th>
              <th>When</th>
              <th>Fee</th>
              <th>Registered</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {webinars.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No webinars yet.
                </td>
              </tr>
            ) : (
              webinars.map((w) => {
                const c = counts[w.id] || { paid: 0, pending: 0 }
                const s = STATUS_STYLE[w.status] || STATUS_STYLE.draft
                return (
                  <tr key={w.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.title}</div>
                    </td>
                    <td>{w.starts_at ? new Date(w.starts_at).toLocaleString() : '-'}</td>
                    <td>{Number(w.fee) > 0 ? `₹${w.fee}` : 'Free'}</td>
                    <td>
                      {c.paid}
                      {c.pending > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> (+{c.pending} unpaid)</span>}
                    </td>
                    <td>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color }}>
                        {String(w.status).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {w.status !== 'published' && (
                          <button onClick={() => setStatus(w.id, 'published')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--success)' }}>
                            Publish
                          </button>
                        )}
                        {w.status === 'published' && (
                          <button onClick={() => setStatus(w.id, 'closed')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--danger)' }}>
                            Close
                          </button>
                        )}
                        <button onClick={() => openEdit(w)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                          Edit
                        </button>
                        <button onClick={() => handleOpenDeleteConfirm(w)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--danger)', display: 'inline-flex', gap: '4px' }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Delete "{deleteTarget.title}"?</h3>
            {deleteCount === null ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Checking related data...</p>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                This webinar has <strong>{deleteCount}</strong> registration{deleteCount === 1 ? '' : 's'}. This is a soft delete —
                that data stays in the database for audit purposes, but this webinar will disappear from every dashboard immediately.
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteTarget(null); setDeleteCount(null) }} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                Cancel
              </button>
              <button onClick={handleConfirmDelete} disabled={deleting || deleteCount === null} className="btn btn-danger" style={{ padding: '8px 20px' }}>
                {deleting ? 'Deleting...' : 'Delete Webinar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
