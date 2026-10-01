'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Send, Search, Code, Video, FileText, ArrowUpRight } from 'lucide-react'
import { useRowSelection } from '@/components/admin/useRowSelection'
import { AdminTableToolbar, SelectCheckbox } from '@/components/admin/AdminTableToolbar'
import { postJson } from '@/lib/apiFetch'
import { xlsxFilename, type XlsxColumn } from '@/lib/exportXlsx'

interface JoinedSubmission {
  id: string
  teamName: string
  hackathonName: string
  project_title?: string
  solution?: string
  problem_statement?: string
  repo_link?: string
  demo_video_url?: string
  ppt?: string
  pdf?: string
  submitted_at: string
  round?: number
}

const columns: XlsxColumn<JoinedSubmission>[] = [
  { header: 'Team', value: (r) => r.teamName },
  { header: 'Hackathon', value: (r) => r.hackathonName },
  { header: 'Project Title', value: (r) => r.project_title || '' },
  { header: 'Round', value: (r) => r.round ?? '' },
  { header: 'Repository', value: (r) => r.repo_link || '' },
  { header: 'Demo Video', value: (r) => r.demo_video_url || '' },
  { header: 'PPT', value: (r) => r.ppt || '' },
  { header: 'PDF', value: (r) => r.pdf || '' },
  { header: 'Submitted At', value: (r) => new Date(r.submitted_at).toLocaleString() },
]

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadSubmissions()
  }, [])

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      const [subsRes, teamsRes, hacksRes] = await Promise.all([
        supabase.from('submissions').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('hackathons').select('*').is('deleted_at', null)
      ])

      const subsData = subsRes.data || []
      const teamsData = teamsRes.data || []
      const hacksData = hacksRes.data || []

      const joined = subsData.map(sub => {
        const team = teamsData.find((t: any) => t.id === sub.team_id)
        const hackathon = hacksData.find((h: any) => h.id === sub.hackathon_id || h.id === team?.hackathon_id)

        return {
          ...sub,
          teamName: team ? team.team_name : 'Unknown Team',
          hackathonName: hackathon ? hackathon.name : 'Unknown Hackathon',
          ppt: sub.ppt_url || '',
          pdf: sub.report_pdf_url || ''
        }
      })

      setSubmissions(joined)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = submissions.filter(sub =>
    sub.project_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.teamName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.hackathonName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selection = useRowSelection(filtered, (s) => s.id)

  const deleteSubmissions = async (rows: JoinedSubmission[]) => {
    const res = await postJson('/api/admin/submissions/bulk-delete', { ids: rows.map((r) => r.id) })
    return { success: res.success, message: res.message }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Submissions...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>🚀 Project Submissions</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Review hackathon submissions, access repositories, and inspect uploaded files.</p>
      </div>

      <div style={{ marginBottom: '20px', position: 'relative', maxWidth: '480px' }}>
        <input
          placeholder="Search by team, project title, or hackathon..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="premium-input"
          style={{ paddingLeft: '44px' }}
        />
        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <Search size={18} />
        </div>
      </div>

      <AdminTableToolbar
        selectedCount={selection.selectedCount}
        rowsForExport={selection.rowsForExport}
        selectedRows={selection.selectedRows}
        columns={columns}
        filename={xlsxFilename('submissions', filtered[0]?.hackathonName)}
        rowLabel={(r) => `${r.teamName} — ${r.project_title || 'Untitled'}`}
        deleteNoun="submission"
        onDeleteSelected={deleteSubmissions}
        onDeleted={() => { selection.clear(); loadSubmissions() }}
      />

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th style={{ padding: 0 }}>
                <SelectCheckbox checked={selection.isAllSelected} indeterminate={selection.isSomeSelected} onChange={selection.toggleAll} label="Select all submissions" />
              </th>
              <th>Team & Hackathon</th>
              <th>Project Details</th>
              <th>Links & Attachments</th>
              <th>Submitted Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No submissions found.</td>
              </tr>
            ) : (
              filtered.map((sub) => (
                <tr key={sub.id}>
                  <td style={{ padding: 0 }}>
                    <SelectCheckbox checked={selection.selectedIds.has(sub.id)} onChange={() => selection.toggle(sub.id)} label={`Select ${sub.teamName}`} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sub.teamName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub.hackathonName}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{sub.project_title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '400px', wordBreak: 'break-word' }}>
                      {sub.solution || sub.problem_statement || 'No description'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      {sub.repo_link && (
                        <a href={sub.repo_link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', textDecoration: 'none' }}>
                          <Code size={14} /> Repository <ArrowUpRight size={12} color="var(--text-muted)" />
                        </a>
                      )}
                      {sub.demo_video_url && (
                        <a href={sub.demo_video_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', textDecoration: 'none' }}>
                          <Video size={14} /> Demo Video <ArrowUpRight size={12} color="var(--text-muted)" />
                        </a>
                      )}
                      {sub.ppt && (
                        <a href={sub.ppt} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', textDecoration: 'none' }}>
                          <FileText size={14} /> PPT Slides <ArrowUpRight size={12} color="var(--text-muted)" />
                        </a>
                      )}
                      {sub.pdf && (
                        <a href={sub.pdf} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', textDecoration: 'none' }}>
                          <FileText size={14} /> PDF Document <ArrowUpRight size={12} color="var(--text-muted)" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td>{new Date(sub.submitted_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
