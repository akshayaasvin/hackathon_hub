'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Video, Trophy, Send, CheckCircle2, ExternalLink } from 'lucide-react'
import { formatDateTimeDMY_IST } from '@/lib/dates'

const inputStyle = 'premium-input'
const label = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' } as const

// Phase 4: pitch session scheduling, Round 1 shortlisting, Round 2 scoring/positions, and
// both "publish" actions, all for one hackathon at a time. New page rather than folding into
// the existing hackathon edit form/submissions list — those stay as they were.
export default function AdminRoundsPage() {
  const supabase = createClient()
  const [hackathons, setHackathons] = useState<any[]>([])
  const [hackathonId, setHackathonId] = useState('')
  const [loading, setLoading] = useState(true)

  const [sessions, setSessions] = useState<any[]>([])
  const [sessionForm, setSessionForm] = useState({ title: '', meetUrl: '', startsAt: '', durationMinutes: '30', notes: '' })
  const [savingSession, setSavingSession] = useState(false)

  const [round1Teams, setRound1Teams] = useState<any[]>([])
  const [round2Teams, setRound2Teams] = useState<any[]>([])
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('hackathons').select('id, name').is('deleted_at', null).order('created_at', { ascending: false })
      setHackathons(data || [])
      if (data && data.length > 0) setHackathonId(data[0].id)
      setLoading(false)
    })()
  }, [])

  const loadAll = async () => {
    if (!hackathonId) return
    const [sessionsRes, round1Res, round2Res] = await Promise.all([
      fetch(`/api/admin/hackathons/${hackathonId}/pitch-sessions`).then((r) => r.json()),
      fetch(`/api/admin/hackathons/${hackathonId}/round1`).then((r) => r.json()),
      fetch(`/api/admin/hackathons/${hackathonId}/round2`).then((r) => r.json()),
    ])
    setSessions(sessionsRes?.success ? sessionsRes.data.sessions : [])
    setRound1Teams(round1Res?.success ? round1Res.data.teams : [])
    setRound2Teams(round2Res?.success ? round2Res.data.teams : [])
  }

  useEffect(() => {
    loadAll()
  }, [hackathonId])

  const createSession = async () => {
    setSavingSession(true)
    const res = await postJson(`/api/admin/hackathons/${hackathonId}/pitch-sessions`, {
      title: sessionForm.title,
      meetUrl: sessionForm.meetUrl,
      startsAt: sessionForm.startsAt ? new Date(sessionForm.startsAt).toISOString() : '',
      durationMinutes: Number(sessionForm.durationMinutes),
      notes: sessionForm.notes,
    })
    setSavingSession(false)
    if (!res.success) return alert(res.message)
    alert(res.message)
    setSessionForm({ title: '', meetUrl: '', startsAt: '', durationMinutes: '30', notes: '' })
    await loadAll()
  }

  const sendInvites = async (sessionId: string, onlyTeamId?: string) => {
    const autoAssign = confirm('Auto-assign a sequential time slot per team? Cancel to invite everyone to the same session time.')
    const res = await postJson(`/api/admin/pitch-sessions/${sessionId}/invite`, { onlyTeamId, autoAssignSlots: autoAssign })
    if (!res.success) return alert(res.message)
    alert(res.message)
    await loadAll()
  }

  const updateRound1 = async (teamId: string, patch: Record<string, unknown>) => {
    const res = await postJson(`/api/admin/round1/${teamId}`, patch)
    if (!res.success) return alert(res.message)
    await loadAll()
  }

  const updateRound2 = async (teamId: string, patch: Record<string, unknown>) => {
    const res = await postJson(`/api/admin/round2/${teamId}`, patch)
    if (!res.success) return alert(res.message)
    await loadAll()
  }

  const publishRound1 = async () => {
    setPublishing(true)
    const res = await postJson(`/api/admin/hackathons/${hackathonId}/round1/publish`, {})
    setPublishing(false)
    if (!res.success) return alert(res.message)
    alert(res.message)
    await loadAll()
  }

  const publishFinal = async () => {
    setPublishing(true)
    const res = await postJson(`/api/admin/hackathons/${hackathonId}/round2/publish`, {})
    setPublishing(false)
    if (!res.success) return alert(res.message)
    alert(res.message)
    await loadAll()
  }

  if (loading) return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading...</div>

  return (
    <div className="premium-container fade-in">
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={28} /> Rounds &amp; Shortlisting
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Round 1 pitch scheduling, shortlisting, Round 2 scoring, and publishing results.</p>
      </div>

      <div style={{ marginBottom: '28px', maxWidth: '420px' }}>
        <label style={label}>Hackathon</label>
        <select value={hackathonId} onChange={(e) => setHackathonId(e.target.value)} className={inputStyle}>
          {hackathons.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {/* ── Pitch sessions ── */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Video size={18} /> Pitch Sessions</h2>

        <div className="responsive-grid-2" style={{ marginBottom: '16px', gap: '12px' }}>
          <div>
            <label style={label}>Title</label>
            <input className={inputStyle} value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} placeholder="Round 1 Live Pitches" />
          </div>
          <div>
            <label style={label}>Google Meet Link</label>
            <input className={inputStyle} value={sessionForm.meetUrl} onChange={(e) => setSessionForm({ ...sessionForm, meetUrl: e.target.value })} placeholder="https://meet.google.com/xxx-xxxx-xxx" />
          </div>
          <div>
            <label style={label}>Date &amp; Time</label>
            <input type="datetime-local" className={inputStyle} value={sessionForm.startsAt} onChange={(e) => setSessionForm({ ...sessionForm, startsAt: e.target.value })} />
          </div>
          <div>
            <label style={label}>Duration (minutes)</label>
            <input type="number" min="1" className={inputStyle} value={sessionForm.durationMinutes} onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: e.target.value })} />
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={label}>Notes (optional)</label>
          <textarea className={inputStyle} rows={2} value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} />
        </div>
        <button onClick={createSession} disabled={savingSession || !sessionForm.title || !sessionForm.meetUrl || !sessionForm.startsAt} className="btn btn-primary" style={{ padding: '10px 24px', marginBottom: '20px' }}>
          {savingSession ? 'Creating…' : 'Create Session'}
        </button>

        {sessions.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No pitch sessions yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {sessions.map((s) => (
              <div key={s.id} style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '6px' }}>
                  <strong>{s.title}</strong>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateTimeDMY_IST(s.starts_at)} IST · {s.duration_minutes} min</span>
                </div>
                <a href={s.meet_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {s.meet_url} <ExternalLink size={12} />
                </a>
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {(s.pitch_slots || []).length} invited so far
                </div>
                <button onClick={() => sendInvites(s.id)} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', marginTop: '10px' }}>
                  <Send size={12} /> Send Invites to Eligible Teams
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Round 1 shortlist ── */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px' }}>Round 1 — Shortlisting</h2>
          <button onClick={publishRound1} disabled={publishing} className="btn btn-success" style={{ padding: '8px 20px' }}>
            <CheckCircle2 size={14} /> {publishing ? 'Publishing…' : 'Publish Round 1 Results'}
          </button>
        </div>
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Team</th><th>PPT</th><th>Slot</th><th>Attendance</th><th>Score</th><th>Remarks</th><th>Shortlisted</th>
              </tr>
            </thead>
            <tbody>
              {round1Teams.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No teams yet.</td></tr>
              ) : round1Teams.map((t) => (
                <tr key={t.teamId}>
                  <td>{t.teamName}</td>
                  <td>{t.submission?.presentation_url ? <a href={t.submission.presentation_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>View</a> : '—'}</td>
                  <td style={{ fontSize: '12px' }}>{t.slot?.slot_time ? formatDateTimeDMY_IST(t.slot.slot_time) : t.slot ? 'No fixed slot' : '—'}</td>
                  <td>
                    <select
                      className="premium-input"
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      value={t.status?.attendance || 'scheduled'}
                      onChange={(e) => updateRound1(t.teamId, { attendance: e.target.value })}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="presented">Presented</option>
                      <option value="absent">Absent</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number" min="0" max="100" style={{ width: '64px' }} className="premium-input"
                      defaultValue={t.status?.score ?? ''}
                      onBlur={(e) => e.target.value !== '' && updateRound1(t.teamId, { score: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      style={{ width: '140px' }} className="premium-input"
                      defaultValue={t.status?.remarks ?? ''}
                      onBlur={(e) => updateRound1(t.teamId, { remarks: e.target.value })}
                    />
                  </td>
                  <td>
                    <input type="checkbox" checked={!!t.status?.shortlisted} onChange={(e) => updateRound1(t.teamId, { shortlisted: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Round 2 / Winners ── */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px' }}>Round 2 — Scoring &amp; Winners</h2>
          <button onClick={publishFinal} disabled={publishing} className="btn btn-success" style={{ padding: '8px 20px' }}>
            <CheckCircle2 size={14} /> {publishing ? 'Publishing…' : 'Publish Final Results'}
          </button>
        </div>
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr><th>Team</th><th>Links</th><th>Score</th><th>Remarks</th><th>Position</th><th>Special Mention</th></tr>
            </thead>
            <tbody>
              {round2Teams.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No shortlisted teams have submitted yet.</td></tr>
              ) : round2Teams.map((t) => (
                <tr key={t.teamId}>
                  <td>{t.teamName}</td>
                  <td style={{ fontSize: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {t.submission?.repo_link && <a href={t.submission.repo_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>GitHub</a>}
                      {t.submission?.live_demo_url && <a href={t.submission.live_demo_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Live Demo</a>}
                      {t.submission?.demo_video_url && <a href={t.submission.demo_video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Video</a>}
                      {!t.submission && '—'}
                    </div>
                  </td>
                  <td>
                    <input
                      type="number" min="0" max="100" style={{ width: '64px' }} className="premium-input"
                      defaultValue={t.status?.score ?? ''}
                      onBlur={(e) => e.target.value !== '' && updateRound2(t.teamId, { score: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      style={{ width: '140px' }} className="premium-input"
                      defaultValue={t.status?.remarks ?? ''}
                      onBlur={(e) => updateRound2(t.teamId, { remarks: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="1" style={{ width: '60px' }} className="premium-input"
                      defaultValue={t.status?.position ?? ''}
                      onBlur={(e) => updateRound2(t.teamId, { position: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="checkbox" checked={!!t.status?.special_mention} onChange={(e) => updateRound2(t.teamId, { specialMention: e.target.checked })} />
                      <input
                        placeholder="label" style={{ width: '100px' }} className="premium-input"
                        defaultValue={t.status?.special_mention_label ?? ''}
                        onBlur={(e) => updateRound2(t.teamId, { specialMentionLabel: e.target.value })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
