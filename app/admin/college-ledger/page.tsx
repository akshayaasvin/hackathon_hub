'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { College, CollegePaymentImport, CollegePaymentImportRow } from '@/types'

interface LedgerRow extends College {
  studentsPaid: number
  amountCollected: number
}

interface ImportPreview {
  import: CollegePaymentImport
  rows: CollegePaymentImportRow[]
}

async function uploadImport(formData: FormData): Promise<{ success: boolean; message: string; data?: ImportPreview }> {
  let res: Response
  try {
    res = await fetch('/api/admin/college-imports/upload', { method: 'POST', body: formData })
  } catch {
    return { success: false, message: 'Network error. Check your connection and try again.' }
  }
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!json) return { success: false, message: `Server error (${res.status}). Please try again.` }
  return json
}

export default function AdminCollegeLedgerPage() {
  const [colleges, setColleges] = useState<College[]>([])
  const [hackathons, setHackathons] = useState<{ id: string; name: string }[]>([])
  const [importRows, setImportRows] = useState<{ import_id: string; college_id: string; amount: number | null }[]>([])
  const [recentImports, setRecentImports] = useState<CollegePaymentImport[]>([])
  const [loading, setLoading] = useState(true)

  const [uploadCollegeId, setUploadCollegeId] = useState('')
  const [uploadHackathonId, setUploadHackathonId] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [committing, setCommitting] = useState(false)

  const [commissionEdits, setCommissionEdits] = useState<Record<string, string>>({})
  const [savingCommission, setSavingCommission] = useState<string | null>(null)
  const [settling, setSettling] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const [collegesRes, hackathonsRes, importsRes] = await Promise.all([
      supabase.from('colleges').select('*').order('name', { ascending: true }),
      supabase.from('hackathons').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase
        .from('college_payment_imports')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(30),
    ])

    const colleges = collegesRes.data || []
    setColleges(colleges)
    setHackathons(hackathonsRes.data || [])
    setRecentImports(importsRes.data || [])

    const committedImportIds = (importsRes.data || []).filter((i) => i.status === 'committed').map((i) => i.id)
    if (committedImportIds.length > 0) {
      const { data: rows } = await supabase
        .from('college_payment_import_rows')
        .select('import_id, amount, match_status')
        .in('import_id', committedImportIds)
        .eq('match_status', 'matched')
      const importById = new Map((importsRes.data || []).map((i) => [i.id, i]))
      setImportRows(
        (rows || []).map((r) => ({
          import_id: r.import_id,
          college_id: importById.get(r.import_id)?.college_id || '',
          amount: r.amount,
        }))
      )
    } else {
      setImportRows([])
    }

    setLoading(false)
  }

  const ledgerRows: LedgerRow[] = useMemo(() => {
    return colleges.map((college) => {
      const rowsForCollege = importRows.filter((r) => r.college_id === college.id)
      return {
        ...college,
        studentsPaid: rowsForCollege.length,
        amountCollected: rowsForCollege.reduce((sum, r) => sum + (r.amount || 0), 0),
      }
    })
  }, [colleges, importRows])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadCollegeId || !uploadHackathonId || !uploadFile) {
      alert('Pick a college, a hackathon, and a CSV file first.')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('college_id', uploadCollegeId)
      formData.append('hackathon_id', uploadHackathonId)
      formData.append('file', uploadFile)
      const result = await uploadImport(formData)
      if (!result.success || !result.data) {
        alert('Error: ' + result.message)
        return
      }
      setPreview(result.data)
    } finally {
      setUploading(false)
    }
  }

  const handleCommit = async () => {
    if (!preview) return
    setCommitting(true)
    try {
      const result = await postJson(`/api/admin/college-imports/${preview.import.id}/commit`, {})
      if (!result.success) {
        alert('Error: ' + result.message)
        return
      }
      setPreview(null)
      setUploadFile(null)
      await load()
    } finally {
      setCommitting(false)
    }
  }

  const handleSaveCommission = async (collegeId: string) => {
    const value = Number(commissionEdits[collegeId])
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      alert('Commission % must be between 0 and 100.')
      return
    }
    setSavingCommission(collegeId)
    try {
      const result = await postJson(`/api/admin/colleges/${collegeId}/commission`, { commission_percent: value })
      if (!result.success) {
        alert('Error: ' + result.message)
        return
      }
      await load()
    } finally {
      setSavingCommission(null)
    }
  }

  const handleMarkSettled = async (row: LedgerRow) => {
    const netDue = (row.amountCollected * row.commission_percent) / 100
    if (!confirm(`Mark ${row.name} as settled for ₹${netDue.toFixed(2)}?`)) return
    setSettling(row.id)
    try {
      const result = await postJson(`/api/admin/colleges/${row.id}/settle`, { amount: netDue })
      if (!result.success) {
        alert('Error: ' + result.message)
        return
      }
      await load()
    } finally {
      setSettling(null)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading College Ledger...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>College Ledger</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manual reconciliation for offline, college-collected payments. Import a CSV of the students a college
          already collected fees from — only the exact students listed get marked paid.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Upload size={18} color="var(--primary)" /> Import Offline Payments
        </h2>
        <form onSubmit={handleUpload} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>College</label>
            <select className="premium-input premium-select" value={uploadCollegeId} onChange={(e) => setUploadCollegeId(e.target.value)}>
              <option value="">Select college</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Hackathon</label>
            <select className="premium-input premium-select" value={uploadHackathonId} onChange={(e) => setUploadHackathonId(e.target.value)}>
              <option value="">Select hackathon</option>
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>CSV File</label>
            <input
              type="file"
              accept=".csv"
              className="premium-input"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>
          <button type="submit" disabled={uploading} className="btn btn-primary" style={{ padding: '10px 20px' }}>
            {uploading ? 'Uploading...' : 'Upload & Preview'}
          </button>
        </form>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
          Expected columns: email, name, department, payment_reference, amount. Export your spreadsheet as CSV first
          (File → Save As → CSV) if it's an .xlsx file.
        </p>
      </div>

      <div className="table-container fade-in" style={{ marginBottom: '40px' }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th>College</th>
              <th>Students Paid</th>
              <th>Amount Collected</th>
              <th>Commission %</th>
              <th>Commission Amount</th>
              <th>Net Due to Platform</th>
              <th>Settlement</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No institutions yet — add some under Institutions first.
                </td>
              </tr>
            ) : (
              ledgerRows.map((row) => {
                const commissionAmount = (row.amountCollected * row.commission_percent) / 100
                return (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                    <td>{row.studentsPaid}</td>
                    <td>₹{row.amountCollected.toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="premium-input"
                          style={{ width: '70px', padding: '6px 8px' }}
                          value={commissionEdits[row.id] ?? String(row.commission_percent)}
                          onChange={(e) => setCommissionEdits((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => handleSaveCommission(row.id)}
                          disabled={savingCommission === row.id}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        >
                          {savingCommission === row.id ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </td>
                    <td>₹{commissionAmount.toFixed(2)}</td>
                    <td style={{ fontWeight: 600 }}>₹{commissionAmount.toFixed(2)}</td>
                    <td>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: row.settlement_status === 'settled' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: row.settlement_status === 'settled' ? 'var(--success)' : 'var(--warning)',
                        }}
                      >
                        {row.settlement_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleMarkSettled(row)}
                        disabled={settling === row.id || row.settlement_status === 'settled' || commissionAmount <= 0}
                        className="btn btn-success"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        {settling === row.id ? 'Saving...' : 'Mark Settled'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', fontFamily: 'var(--font-display)' }}>Recent Imports</h2>
        <div className="table-container">
          <table className="premium-table" style={{ fontSize: '13px' }}>
            <thead>
              <tr>
                <th>File</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Matched</th>
                <th>Unmatched</th>
              </tr>
            </thead>
            <tbody>
              {recentImports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No imports yet.</td>
                </tr>
              ) : (
                recentImports.map((imp) => (
                  <tr key={imp.id}>
                    <td>{imp.file_name}</td>
                    <td>{new Date(imp.uploaded_at).toLocaleString()}</td>
                    <td style={{ textTransform: 'capitalize' }}>{imp.status}</td>
                    <td>{imp.total_rows}</td>
                    <td>{imp.matched_count}</td>
                    <td>{imp.unmatched_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '95%', maxWidth: '780px', padding: '32px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Review Import</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              {preview.import.matched_count} matched, {preview.import.unmatched_count} unmatched out of{' '}
              {preview.import.total_rows} rows. Nothing has been saved yet — only committing marks students paid.
            </p>
            <div className="table-container" style={{ marginBottom: '24px' }}>
              <table className="premium-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.email}</td>
                      <td>{row.student_name || '-'}</td>
                      <td>{row.amount != null ? `₹${row.amount}` : '-'}</td>
                      <td>
                        {row.match_status === 'matched' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
                            <CheckCircle2 size={14} /> Matched
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger)' }}>
                            <AlertTriangle size={14} /> Unmatched
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPreview(null)} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button onClick={handleCommit} disabled={committing || preview.import.matched_count === 0} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                {committing ? 'Committing...' : `Commit — Mark ${preview.import.matched_count} Students Paid`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
