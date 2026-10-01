'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postJson, putJson } from '@/lib/apiFetch'
import { formatDateTimeDMY_IST } from '@/lib/dates'
import { ArrowLeft, Trophy, Video, FileText, Lock, CheckCircle2, ExternalLink, Download } from 'lucide-react'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { downloadXlsx, xlsxFilename, type XlsxColumn } from '@/lib/exportXlsx'

const inputStyle = 'premium-input'
const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' } as const

type Tab = 'round1' | 'round2' | 'winners'

/**
 * Consolidated admin Results flow — replaces both the old /admin/rounds page (shortlist +
 * Round 2 scoring + publish, all for one hackathon at a time) and the "View Standings" picker
 * that used to live at /admin/results (now just a hackathon picker linking here). Reuses the
 * existing 0031 tables (team_round_status, pitch_sessions, pitch_slots, submissions, winners)
 * plus 0033's round_judge_scores/admin_audit_log — no new tables for anything this page shows.
 * Payments/auth/team-management/the jury scoring UI are untouched; judge scores are read-only
 * here (per-judge write path is app/api/rounds/score/[teamId], used by the new jury page).
 */
export default function AdminResultsHackathonPage({ params }: { params: { hackathonId: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const hackathonId = params.hackathonId

  const [hackathon, setHackathon] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('round1')

  const loadHackathon = async () => {
    const { data } = await supabase.from('hackathons').select('*').eq('id', hackathonId).maybeSingle()
    setHackathon(data)
    setLoading(false)
  }

  useEffect(() => {
    loadHackathon()
  }, [hackathonId])

  if (loading) return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading…</div>
  if (!hackathon) {
    return (
      <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ marginBottom: '20px' }}>Hackathon not found.</p>
          <button onClick={() => router.push('/admin/results')} className="btn btn-primary" style={{ padding: '10px 24px' }}>Back</button>
        </div>
      </div>
    )
  }

  const round1Published = !!hackathon.results_published_round1
  const round2Locked = !round1Published
  const winnersLocked = !round1Published

  return (
    <div className="premium-container fade-in">
      <button
        onClick={() => router.push('/admin/results')}
        className="btn btn-secondary"
        style={{ marginBottom: '20px', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
      >
        <ArrowLeft size={16} /> Back to Hackathons
      </button>

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={28} /> {hackathon.name} — Results
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Round 1 shortlist, Round 2 demo meeting, and winners — one flow, in order.</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <button onClick={() => setTab('round1')} className={tab === 'round1' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ padding: '10px 20px' }}>
          <FileText size={14} /> Round 1 Shortlist
        </button>
        <button onClick={() => !round2Locked && setTab('round2')} disabled={round2Locked} className={tab === 'round2' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ padding: '10px 20px', opacity: round2Locked ? 0.5 : 1 }}>
          {round2Locked && <Lock size={12} />} <Video size={14} /> Round 2 Demo Meeting
        </button>
        <button onClick={() => !winnersLocked && setTab('winners')} disabled={winnersLocked} className={tab === 'winners' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ padding: '10px 20px', opacity: winnersLocked ? 0.5 : 1 }}>
          {winnersLocked && <Lock size={12} />} <Trophy size={14} /> Winners
        </button>
      </div>

      {tab === 'round1' && <Round1Tab hackathonId={hackathonId} hackathon={hackathon} onPublishChange={loadHackathon} />}
      {tab === 'round2' && !round2Locked && <Round2Tab hackathonId={hackathonId} hackathon={hackathon} />}
      {tab === 'winners' && !winnersLocked && <WinnersTab hackathonId={hackathonId} hackathon={hackathon} onAnnounce={loadHackathon} />}
    </div>
  )
}

// ─────────────────────────── Tab 1: Round 1 Shortlist ───────────────────────────

function Round1Tab({ hackathonId, hackathon, onPublishChange }: { hackathonId: string; hackathon: any; onPublishChange: () => void }) {
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [topN, setTopN] = useState('3')
  const [minScore, setMinScore] = useState('70')
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false)
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const res: any = await fetch(`/api/admin/hackathons/${hackathonId}/round1`).then((r) => r.json())
    const rows = res?.success ? res.data.teams : []
    setTeams(rows)
    const nextDraft: Record<string, boolean> = {}
    for (const t of rows) nextDraft[t.teamId] = !!t.status?.shortlisted
    setDraft(nextDraft)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [hackathonId])

  const updateField = async (teamId: string, patch: Record<string, unknown>) => {
    const res = await putJson(`/api/admin/round1/${teamId}`, patch)
    if (!res.success) alert(res.message)
    else await load()
  }

  const selectTopN = () => {
    const n = Number(topN)
    if (!Number.isFinite(n) || n <= 0) return
    // Ranked by average score, descending (matches the API's own sort); a team the admin
    // marked absent still gets ranked by score if scored, but ties/unscored teams sort last.
    const ranked = [...teams].sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1))
    const next: Record<string, boolean> = {}
    ranked.forEach((t, i) => {
      next[t.teamId] = i < n && t.status?.attendance !== 'absent'
    })
    setDraft(next)
  }

  const selectAllAbove = () => {
    const min = Number(minScore)
    if (!Number.isFinite(min)) return
    const next: Record<string, boolean> = {}
    for (const t of teams) {
      next[t.teamId] = t.averageScore != null && t.averageScore >= min && t.status?.attendance !== 'absent'
    }
    setDraft(next)
  }

  const saveDraft = async () => {
    setSavingDraft(true)
    const changed = teams.filter((t) => !!t.status?.shortlisted !== !!draft[t.teamId])
    for (const t of changed) {
      const res = await putJson(`/api/admin/round1/${t.teamId}`, { shortlisted: draft[t.teamId] })
      if (!res.success) alert(`${t.teamName}: ${res.message}`)
    }
    setSavingDraft(false)
    await load()
  }

  const doPublish = async () => {
    setConfirmPublishOpen(false)
    setPublishing(true)
    const res = await postJson(`/api/admin/hackathons/${hackathonId}/round1/publish`, {})
    setPublishing(false)
    if (!res.success) return alert(res.message)
    alert(res.message)
    onPublishChange()
  }

  const doUnpublish = async () => {
    setConfirmUnpublishOpen(false)
    const res = await postJson(`/api/admin/hackathons/${hackathonId}/round1/unpublish`, {})
    if (!res.success) return alert(res.message)
    alert(res.message)
    onPublishChange()
  }

  const exportColumns: XlsxColumn<any>[] = [
    { header: 'Team', value: (t) => t.teamName },
    { header: 'Leader', value: (t) => t.leaderName || '' },
    { header: 'Members', value: (t) => t.memberCount },
    { header: 'PPT Link', value: (t) => t.submission?.presentation_url || '' },
    { header: 'Attendance', value: (t) => t.status?.attendance || '' },
    { header: 'Scored / Assigned Judges', value: (t) => `${t.scoredJudgeCount}/${t.assignedJudgeCount}` },
    { header: 'Average Score', value: (t) => t.averageScore ?? '' },
    { header: 'Remarks', value: (t) => t.status?.remarks || '' },
    { header: 'Shortlisted', value: (t) => (t.status?.shortlisted ? 'Yes' : 'No') },
  ]

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>

  const published = !!hackathon.results_published_round1
  const selectedCount = teams.filter((t) => draft[t.teamId]).length

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px' }}>Round 1 — Shortlisting</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {published ? <span style={{ color: 'var(--success)' }}>Published</span> : 'Draft — not yet visible to participants'} · {selectedCount} of {teams.length} selected
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => downloadXlsx(teams, exportColumns, xlsxFilename('round1-shortlist', hackathon.name))} disabled={teams.length === 0} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            <Download size={14} /> Download XLSX
          </button>
          <button onClick={saveDraft} disabled={savingDraft} className="btn btn-secondary" style={{ padding: '8px 18px' }}>
            {savingDraft ? 'Saving…' : 'Save Draft'}
          </button>
          {published ? (
            <button onClick={() => setConfirmUnpublishOpen(true)} className="btn btn-secondary" style={{ padding: '8px 18px' }}>Unpublish</button>
          ) : (
            <button onClick={() => setConfirmPublishOpen(true)} disabled={publishing} className="btn btn-success" style={{ padding: '8px 20px' }}>
              <CheckCircle2 size={14} /> {publishing ? 'Publishing…' : 'Publish Round 1 Results'}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmPublishOpen}
        title="Publish Round 1 results?"
        message={(() => {
          const selected = teams.filter((t) => draft[t.teamId]).length
          const notSelected = teams.length - selected
          const unscored = teams.filter((t) => t.scoredJudgeCount === 0).length
          return `${selected} team${selected === 1 ? '' : 's'} selected for Round 2.\n${notSelected} team${notSelected === 1 ? '' : 's'} not selected.${unscored > 0 ? `\n\n⚠ ${unscored} team${unscored === 1 ? ' has' : 's have'} no judge scores yet.` : ''}\n\nParticipants will be notified by dashboard notification and email.`
        })()}
        confirmLabel="Publish"
        loading={publishing}
        onConfirm={doPublish}
        onCancel={() => setConfirmPublishOpen(false)}
      />
      <ConfirmDialog
        open={confirmUnpublishOpen}
        title="Unpublish Round 1 results?"
        message="Only possible if no Round 2 invites have been sent yet. Participants will no longer see the Round 1 outcome."
        confirmLabel="Unpublish"
        danger
        onConfirm={doUnpublish}
        onCancel={() => setConfirmUnpublishOpen(false)}
      />

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', padding: '12px', background: 'rgba(2, 132, 199, 0.04)', borderRadius: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Bulk select:</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px' }}>Top</span>
          <input type="number" min="1" className={inputStyle} style={{ width: '60px', padding: '6px 8px' }} value={topN} onChange={(e) => setTopN(e.target.value)} />
          <button onClick={selectTopN} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>Select Top N</button>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px' }}>Score ≥</span>
          <input type="number" min="0" max="100" className={inputStyle} style={{ width: '60px', padding: '6px 8px' }} value={minScore} onChange={(e) => setMinScore(e.target.value)} />
          <button onClick={selectAllAbove} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>Select All ≥ X</button>
        </div>
      </div>

      <div className="table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Team</th><th>Leader</th><th>Members</th><th>PPT</th><th>Attendance</th><th>Judge Scores</th><th>Avg</th><th>Remarks</th><th>Shortlist</th>
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No Round 1 submissions yet.</td></tr>
            ) : teams.map((t) => (
              <tr key={t.teamId}>
                <td>{t.teamName}{t.isSolo && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}> (solo)</span>}</td>
                <td style={{ fontSize: '13px' }}>{t.leaderName || '—'}</td>
                <td style={{ textAlign: 'center' }}>{t.memberCount}</td>
                <td>
                  {t.submission?.presentation_url ? (
                    <a href={t.submission.presentation_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      View <ExternalLink size={11} />
                    </a>
                  ) : '—'}
                </td>
                <td>
                  <select
                    className={inputStyle} style={{ padding: '4px 8px', fontSize: '12px' }}
                    value={t.status?.attendance || 'scheduled'}
                    onChange={(e) => updateField(t.teamId, { attendance: e.target.value })}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="presented">Presented</option>
                    <option value="absent">Absent</option>
                  </select>
                </td>
                <td style={{ fontSize: '12px' }}>
                  {t.judgeScores.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>{t.assignedJudgeCount > 0 ? `0/${t.assignedJudgeCount} scored` : 'No judges assigned'}</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {t.judgeScores.map((js: any) => (
                        <span key={js.judgeId}>{js.judgeName}: <strong>{js.score}</strong></span>
                      ))}
                      {t.assignedJudgeCount > t.scoredJudgeCount && (
                        <span style={{ color: 'var(--warning)' }}>{t.scoredJudgeCount}/{t.assignedJudgeCount} scored</span>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{t.averageScore != null ? t.averageScore.toFixed(1) : '—'}</td>
                <td>
                  <input
                    style={{ width: '130px' }} className={inputStyle}
                    defaultValue={t.status?.remarks ?? ''}
                    onBlur={(e) => updateField(t.teamId, { remarks: e.target.value })}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!draft[t.teamId]}
                    onChange={(e) => setDraft({ ...draft, [t.teamId]: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────── Tab 2: Round 2 Demo Meeting ───────────────────────────

function Round2Tab({ hackathonId, hackathon }: { hackathonId: string; hackathon: any }) {
  const [sessions, setSessions] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionForm, setSessionForm] = useState({ title: 'Round 2 — Demo Meeting', meetUrl: '', startsAt: '', durationMinutes: '30', notes: '' })
  const [savingSession, setSavingSession] = useState(false)
  const [inviteChoice, setInviteChoice] = useState<{ sessionId: string; onlyTeamId?: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const [sessionsRes, teamsRes]: any[] = await Promise.all([
      fetch(`/api/admin/hackathons/${hackathonId}/pitch-sessions?round=2`).then((r) => r.json()),
      fetch(`/api/admin/hackathons/${hackathonId}/round2`).then((r) => r.json()),
    ])
    setSessions(sessionsRes?.success ? sessionsRes.data.sessions : [])
    setTeams(teamsRes?.success ? teamsRes.data.teams : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [hackathonId])

  const createSession = async () => {
    setSavingSession(true)
    const res = await postJson(`/api/admin/hackathons/${hackathonId}/pitch-sessions`, {
      title: sessionForm.title,
      meetUrl: sessionForm.meetUrl,
      startsAt: sessionForm.startsAt ? new Date(sessionForm.startsAt).toISOString() : '',
      durationMinutes: Number(sessionForm.durationMinutes),
      notes: sessionForm.notes,
      round: 2,
    })
    setSavingSession(false)
    if (!res.success) return alert(res.message)
    alert(res.message)
    setSessionForm({ title: 'Round 2 — Demo Meeting', meetUrl: '', startsAt: '', durationMinutes: '30', notes: '' })
    await load()
  }

  // A single team's "Resend/Invite" never auto-assigns (they already have, or are getting,
  // one specific slot) — only the bulk "Send Round 2 Invites" needs to ask how slot times
  // should be assigned, so it's the only path that opens the choice dialog below.
  const sendInvites = async (sessionId: string, onlyTeamId?: string) => {
    if (onlyTeamId) {
      await doSendInvites(sessionId, onlyTeamId, false)
    } else {
      setInviteChoice({ sessionId })
    }
  }

  const doSendInvites = async (sessionId: string, onlyTeamId: string | undefined, autoAssign: boolean) => {
    setInviteChoice(null)
    const res = await postJson(`/api/admin/pitch-sessions/${sessionId}/invite`, { onlyTeamId, autoAssignSlots: autoAssign })
    if (!res.success) return alert(res.message)
    alert(res.message)
    await load()
  }

  const exportColumns: XlsxColumn<any>[] = [
    { header: 'Team', value: (t) => t.teamName },
    { header: 'Slot Time', value: (t) => (t.slotTime ? formatDateTimeDMY_IST(t.slotTime) : '') },
    { header: 'GitHub', value: (t) => t.submission?.repo_link || '' },
    { header: 'Live Demo', value: (t) => t.submission?.live_demo_url || '' },
    { header: 'Demo Video', value: (t) => t.submission?.demo_video_url || '' },
    { header: 'Submitted', value: (t) => (t.submission ? 'Yes' : 'No') },
    { header: 'Invite Sent', value: (t) => (t.inviteSent ? 'Yes' : 'No') },
  ]

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>

  const latestSession = sessions[sessions.length - 1]

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div className="glass-card">
        <h2 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Video size={18} /> Round 2 Sessions</h2>
        <div className="responsive-grid-2" style={{ marginBottom: '16px', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input className={inputStyle} value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Google Meet Link</label>
            <input className={inputStyle} value={sessionForm.meetUrl} onChange={(e) => setSessionForm({ ...sessionForm, meetUrl: e.target.value })} placeholder="https://meet.google.com/xxx-xxxx-xxx" />
          </div>
          <div>
            <label style={labelStyle}>Date &amp; Time</label>
            <input type="datetime-local" className={inputStyle} value={sessionForm.startsAt} onChange={(e) => setSessionForm({ ...sessionForm, startsAt: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Duration (minutes)</label>
            <input type="number" min="1" className={inputStyle} value={sessionForm.durationMinutes} onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: e.target.value })} />
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea className={inputStyle} rows={2} value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} />
        </div>
        <button onClick={createSession} disabled={savingSession || !sessionForm.title || !sessionForm.meetUrl || !sessionForm.startsAt} className="btn btn-primary" style={{ padding: '10px 24px', marginBottom: '20px' }}>
          {savingSession ? 'Creating…' : 'Create Round 2 Session'}
        </button>

        {sessions.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No Round 2 sessions yet.</p>
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
                  {(s.pitch_slots || []).filter((sl: any) => sl.invite_sent_at).length} invited so far
                </div>
                <button onClick={() => sendInvites(s.id)} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', marginTop: '10px' }}>
                  Send Round 2 Invites to Shortlisted Teams
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px' }}>Shortlisted Teams</h2>
          <button onClick={() => downloadXlsx(teams, exportColumns, xlsxFilename('round2-demo-meeting', hackathon.name))} disabled={teams.length === 0} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            <Download size={14} /> Download XLSX
          </button>
        </div>
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr><th>Team</th><th>Slot</th><th>GitHub</th><th>Demo</th><th>Video</th><th>Submitted</th><th>Invite</th><th></th></tr>
            </thead>
            <tbody>
              {teams.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No teams shortlisted yet — go back to Tab 1.</td></tr>
              ) : teams.map((t) => (
                <tr key={t.teamId}>
                  <td>{t.teamName}</td>
                  <td style={{ fontSize: '12px' }}>{t.slotTime ? formatDateTimeDMY_IST(t.slotTime) : t.inviteSent ? 'Session time' : '—'}</td>
                  <td>{t.submission?.repo_link ? <a href={t.submission.repo_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Link</a> : '—'}</td>
                  <td>{t.submission?.live_demo_url ? <a href={t.submission.live_demo_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Link</a> : '—'}</td>
                  <td>{t.submission?.demo_video_url ? <a href={t.submission.demo_video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Link</a> : '—'}</td>
                  <td style={{ fontSize: '12px', color: t.submission ? 'var(--success)' : 'var(--text-muted)' }}>{t.submission ? 'Yes' : 'No'}</td>
                  <td style={{ fontSize: '12px', color: t.inviteSent ? 'var(--success)' : 'var(--text-muted)' }}>{t.inviteSent ? 'Sent' : 'Not sent'}</td>
                  <td>
                    {latestSession && (
                      <button onClick={() => sendInvites(latestSession.id, t.teamId)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                        {t.inviteSent ? 'Resend' : 'Invite'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions.length > 1 && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>Resend/Invite above targets the most recently created session ({latestSession?.title}).</p>
        )}
      </div>

      {inviteChoice && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="glass-card fade-in" style={{ maxWidth: '480px', width: '100%', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--text-primary)' }}>How should team slots be assigned?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              Auto-assign gives each newly-invited team its own sequential time slot. Otherwise every team is invited to the same session start time.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', flexWrap: 'wrap' }}>
              <button onClick={() => setInviteChoice(null)} className="btn btn-secondary" style={{ padding: '10px 18px' }}>Cancel</button>
              <button onClick={() => doSendInvites(inviteChoice.sessionId, undefined, false)} className="btn btn-secondary" style={{ padding: '10px 18px' }}>Same time for all</button>
              <button onClick={() => doSendInvites(inviteChoice.sessionId, undefined, true)} className="btn btn-primary" style={{ padding: '10px 18px' }}>Auto-assign slots</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Tab 3: Winners ───────────────────────────

const POSITION_OPTIONS = [
  { value: '', label: 'None' },
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: 'special', label: 'Special Mention' },
]

function WinnersTab({ hackathonId, hackathon, onAnnounce }: { hackathonId: string; hackathon: any; onAnnounce: () => void }) {
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Record<string, { position: string; specialMentionLabel: string; remarks: string }>>({})
  const [savingDraft, setSavingDraft] = useState(false)
  const [announcing, setAnnouncing] = useState(false)
  const [confirmAnnounceOpen, setConfirmAnnounceOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const res: any = await fetch(`/api/admin/hackathons/${hackathonId}/round2`).then((r) => r.json())
    const rows = res?.success ? res.data.teams : []
    setTeams(rows)
    const nextDraft: Record<string, { position: string; specialMentionLabel: string; remarks: string }> = {}
    for (const t of rows) {
      nextDraft[t.teamId] = {
        position: t.status?.special_mention ? 'special' : t.status?.position ? String(t.status.position) : '',
        specialMentionLabel: t.status?.special_mention_label || '',
        remarks: t.status?.remarks || '',
      }
    }
    setDraft(nextDraft)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [hackathonId])

  const suggestFromAverage = () => {
    const ranked = [...teams].filter((t) => t.averageScore != null).sort((a, b) => b.averageScore - a.averageScore)
    const next = { ...draft }
    ranked.slice(0, 3).forEach((t, i) => {
      next[t.teamId] = { ...next[t.teamId], position: String(i + 1) }
    })
    setDraft(next)
  }

  const setPosition = (teamId: string, value: string) => {
    // Client-side duplicate guard — the server (unique index) is the real enforcement, but
    // clearing the other team's slot here avoids a round-trip failure for the common case.
    if (value === '1' || value === '2' || value === '3') {
      const next = { ...draft }
      for (const id of Object.keys(next)) {
        if (id !== teamId && next[id].position === value) next[id] = { ...next[id], position: '' }
      }
      next[teamId] = { ...next[teamId], position: value }
      setDraft(next)
    } else {
      setDraft({ ...draft, [teamId]: { ...draft[teamId], position: value } })
    }
  }

  const saveDraft = async () => {
    setSavingDraft(true)
    for (const t of teams) {
      const d = draft[t.teamId]
      const wasSpecial = !!t.status?.special_mention
      const wasPosition = t.status?.position ?? null
      const wasLabel = t.status?.special_mention_label || ''
      const wasRemarks = t.status?.remarks || ''
      const isSpecial = d.position === 'special'
      const isPosition = d.position && d.position !== 'special' ? Number(d.position) : null
      if (isSpecial === wasSpecial && isPosition === wasPosition && d.specialMentionLabel === wasLabel && d.remarks === wasRemarks) continue

      const res = await putJson(`/api/admin/round2/${t.teamId}`, {
        position: isPosition,
        specialMention: isSpecial,
        specialMentionLabel: isSpecial ? d.specialMentionLabel : null,
        remarks: d.remarks,
      })
      if (!res.success) alert(`${t.teamName}: ${res.message}`)
    }
    setSavingDraft(false)
    await load()
  }

  const doAnnounce = async () => {
    setConfirmAnnounceOpen(false)
    setAnnouncing(true)
    const res = await postJson(`/api/admin/hackathons/${hackathonId}/round2/publish`, {})
    setAnnouncing(false)
    if (!res.success) return alert(res.message)
    alert(res.message)
    onAnnounce()
  }

  const exportColumns: XlsxColumn<any>[] = [
    { header: 'Team', value: (t) => t.teamName },
    { header: 'Attendance', value: (t) => t.status?.attendance || '' },
    { header: 'GitHub', value: (t) => t.submission?.repo_link || '' },
    { header: 'Live Demo', value: (t) => t.submission?.live_demo_url || '' },
    { header: 'Demo Video', value: (t) => t.submission?.demo_video_url || '' },
    { header: 'Average Score', value: (t) => t.averageScore ?? '' },
    { header: 'Remarks', value: (t) => t.status?.remarks || '' },
    { header: 'Position', value: (t) => t.status?.position ?? '' },
    { header: 'Special Mention', value: (t) => (t.status?.special_mention ? t.status?.special_mention_label || 'Yes' : '') },
  ]

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>

  const announced = !!hackathon.results_published_final

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px' }}>Winners</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{announced ? <span style={{ color: 'var(--success)' }}>Announced</span> : 'Draft — not yet visible to participants'}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => downloadXlsx(teams, exportColumns, xlsxFilename('winners', hackathon.name))} disabled={teams.length === 0} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            <Download size={14} /> Download XLSX
          </button>
          <button onClick={suggestFromAverage} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>Suggest Top 3 from Average</button>
          <button onClick={saveDraft} disabled={savingDraft} className="btn btn-secondary" style={{ padding: '8px 18px' }}>{savingDraft ? 'Saving…' : 'Save Draft'}</button>
          <button onClick={() => setConfirmAnnounceOpen(true)} disabled={announcing} className="btn btn-success" style={{ padding: '8px 20px' }}>
            <CheckCircle2 size={14} /> {announcing ? 'Announcing…' : 'Announce Winners'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmAnnounceOpen}
        title="Announce final winners?"
        message={(() => {
          const placedCount = teams.filter((t) => draft[t.teamId]?.position).length
          return `${placedCount} team${placedCount === 1 ? '' : 's'} placed. This publishes results and certificates to all participants and sends notifications/emails — save your draft first if you haven't.`
        })()}
        confirmLabel="Announce"
        loading={announcing}
        onConfirm={doAnnounce}
        onCancel={() => setConfirmAnnounceOpen(false)}
      />

      <div className="table-container">
        <table className="premium-table">
          <thead>
            <tr><th>Team</th><th>Attendance</th><th>Links</th><th>Judge Scores</th><th>Avg</th><th>Remarks</th><th>Position</th><th>Mention Title</th></tr>
          </thead>
          <tbody>
            {teams.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No shortlisted teams.</td></tr>
            ) : teams.map((t) => (
              <tr key={t.teamId}>
                <td>{t.teamName}</td>
                <td style={{ fontSize: '12px' }}>{t.status?.attendance || '—'}</td>
                <td style={{ fontSize: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {t.submission?.repo_link && <a href={t.submission.repo_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>GitHub</a>}
                    {t.submission?.live_demo_url && <a href={t.submission.live_demo_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Demo</a>}
                    {t.submission?.demo_video_url && <a href={t.submission.demo_video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Video</a>}
                    {!t.submission && '—'}
                  </div>
                </td>
                <td style={{ fontSize: '12px' }}>
                  {t.judgeScores.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>None yet</span> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {t.judgeScores.map((js: any) => <span key={js.judgeId}>{js.judgeName}: <strong>{js.score}</strong></span>)}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{t.averageScore != null ? t.averageScore.toFixed(1) : '—'}</td>
                <td>
                  <input
                    style={{ width: '120px' }} className={inputStyle}
                    value={draft[t.teamId]?.remarks ?? ''}
                    onChange={(e) => setDraft({ ...draft, [t.teamId]: { ...draft[t.teamId], remarks: e.target.value } })}
                  />
                </td>
                <td>
                  <select
                    className={inputStyle} style={{ padding: '4px 8px', fontSize: '12px' }}
                    value={draft[t.teamId]?.position ?? ''}
                    onChange={(e) => setPosition(t.teamId, e.target.value)}
                  >
                    {POSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td>
                  {draft[t.teamId]?.position === 'special' && (
                    <input
                      placeholder="e.g. Best UI" style={{ width: '110px' }} className={inputStyle}
                      value={draft[t.teamId]?.specialMentionLabel ?? ''}
                      onChange={(e) => setDraft({ ...draft, [t.teamId]: { ...draft[t.teamId], specialMentionLabel: e.target.value } })}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
