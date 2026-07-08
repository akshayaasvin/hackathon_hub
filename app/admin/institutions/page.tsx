'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil } from 'lucide-react'

interface CollegeRow {
  id: string
  name: string
  district: string | null
  created_at: string
}

const emptyForm = { name: '', district: '' }

export default function AdminInstitutionsPage() {
  const [colleges, setColleges] = useState<CollegeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('colleges').select('*').order('name', { ascending: true })
    setColleges(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setError('')
    setShowModal(true)
  }

  const openEdit = (college: CollegeRow) => {
    setEditingId(college.id)
    setFormData({ name: college.name, district: college.district || '' })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('College name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = { name: formData.name.trim(), district: formData.district.trim() || null }
      const { error: dbError } = editingId
        ? await supabase.from('colleges').update(payload).eq('id', editingId)
        : await supabase.from('colleges').insert(payload)

      if (dbError) {
        setError(dbError.message.includes('duplicate') ? 'A college with this name already exists.' : dbError.message)
        return
      }
      setShowModal(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const filtered = colleges.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.district || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Institutions...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Institutions</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            The reference list of colleges offered on the student registration dropdown. Students can always pick
            "Other (not listed)" and type a custom name instead.
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Institution
        </button>
      </div>

      <div style={{ marginBottom: '32px', position: 'relative', maxWidth: '480px' }}>
        <input
          placeholder="Search by name or district..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="premium-input"
          style={{ paddingLeft: '44px' }}
        />
        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <Search size={18} />
        </div>
      </div>

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>District</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No institutions found.</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                  <td>{c.district || '-'}</td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => openEdit(c)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Pencil size={14} /> <span>Edit</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <h2 style={{ fontSize: '22px', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>
              {editingId ? 'Edit Institution' : 'Add Institution'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>College Name</label>
                <input
                  className="premium-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>District / Location</label>
                <input
                  className="premium-input"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                />
              </div>
              {error && <div style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ padding: '8px 20px' }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '8px 24px' }}>
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Institution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
