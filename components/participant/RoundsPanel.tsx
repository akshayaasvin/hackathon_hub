'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Video, FileText, Trophy, ExternalLink } from 'lucide-react'
import { formatDateTimeDMY_IST } from '@/lib/dates'

const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' } as const

/**
 * Round 1 (PPT link + live pitch), shortlist result, Round 2 (demo), and final result — all for
 * ONE team, self-contained so app/participant/[hackathonId]/page.tsx doesn't have to carry all
 * of this fetching/state itself. Every gate here (shortlisted-only Round 2, "before publish
 * participants must not see status") is enforced server-side too (RLS on team_round_status,
 * and app/api/submissions/round2 re-checks shortlisted independently) — this component hiding
 * something is a UX nicety, not the actual security boundary.
 */
export default function RoundsPanel({
  hackathonId,
  hackathon,
  team,
  isLeader,
}: {
  hackathonId: string
  hackathon: any
  team: any
  isLeader: boolean
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [round1Submission, setRound1Submission] = useState<any>(null)
  const [round1Status, setRound1Status] = useState<any>(null)
  const [round2Submission, setRound2Submission] = useState<any>(null)
  const [round2Status, setRound2Status] = useState<any>(null)
  const [pitchSlot, setPitchSlot] = useState<any>(null)
  const [pitchSession, setPitchSession] = useState<any>(null)

  const [presentationUrl, setPresentationUrl] = useState('')
  const [savingRound1, setSavingRound1] = useState(false)
  const [round1Error, setRound1Error] = useState<string | null>(null)

  const [githubUrl, setGithubUrl] = useState('')
  const [liveDemoUrl, setLiveDemoUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [savingRound2, setSavingRound2] = useState(false)
  const [round2FieldErrors, setRound2FieldErrors] = useState<Record<string, string>>({})
  const [round2FormError, setRound2FormError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [{ data: r1 }, { data: r2 }, { data: s1 }, { data: s2 }, { data: slot }] = await Promise.all([
      supabase.from('submissions').select('*').eq('team_id', team.id).eq('round', 1).maybeSingle(),
      supabase.from('submissions').select('*').eq('team_id', team.id).eq('round', 2).maybeSingle(),
      supabase.from('team_round_status').select('*').eq('team_id', team.id).eq('round', 1).maybeSingle(),
      supabase.from('team_round_status').select('*').eq('team_id', team.id).eq('round', 2).maybeSingle(),
      supabase.from('pitch_slots').select('*').eq('team_id', team.id).maybeSingle(),
    ])
    setRound1Submission(r1)
    setRound2Submission(r2)
    setRound1Status(s1)
    setRound2Status(s2)
    setPitchSlot(slot)
    setPresentationUrl(r1?.presentation_url || '')
    setGithubUrl(r2?.repo_link || '')
    setLiveDemoUrl(r2?.live_demo_url || '')
    setVideoUrl(r2?.demo_video_url || '')
    setNotes(r2?.notes || '')

    if (slot?.session_id) {
      const { data: session } = await supabase.from('pitch_sessions').select('*').eq('id', slot.session_id).maybeSingle()
      setPitchSession(session)
    } else {
      setPitchSession(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [team?.id])

  if (loading) return null

  const round1Locked = hackathon?.round1_deadline && new Date(hackathon.round1_deadline).getTime() < Date.now()
  const round2Locked = hackathon?.round2_deadline && new Date(hackathon.round2_deadline).getTime() < Date.now()
  const round1Published = !!hackathon?.results_published_round1
  const round2Published = !!hackathon?.results_published_final
  const shortlisted = !!round1Status?.shortlisted

  const submitRound1 = async () => {
    setRound1Error(null)
    setSavingRound1(true)
    const res: any = await postJson('/api/submissions/round1', { hackathonId, presentationUrl })
    setSavingRound1(false)
    if (!res.success) {
      setRound1Error(res.message)
      return
    }
    alert(res.message)
    await load()
  }

  const submitRound2 = async () => {
    setRound2FormError(null)
    setRound2FieldErrors({})
    setSavingRound2(true)
    const res: any = await postJson('/api/submissions/round2', { hackathonId, githubUrl, liveDemoUrl, videoUrl, notes })
    setSavingRound2(false)
    if (!res.success) {
      if (res.fieldErrors) setRound2FieldErrors(res.fieldErrors)
      else setRound2FormError(res.message)
      return
    }
    alert(res.message)
    await load()
  }

  return (
    <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
      {/* ── Round 1: PPT link ── */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={16} /> Round 1 — Presentation Link</h3>
        {isLeader ? (
          <>
            <label style={labelStyle}>PPT / Slides link</label>
            <input
              className="premium-input"
              placeholder="https://drive.google.com/… or Google Slides / OneDrive / Canva / Dropbox"
              value={presentationUrl}
              onChange={(e) => setPresentationUrl(e.target.value)}
              disabled={!!round1Locked}
              style={{ marginBottom: '8px' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Set sharing to &quot;Anyone with the link can view&quot; before submitting.
            </p>
            {round1Error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{round1Error}</p>}
            {round1Locked ? (
              <p style={{ color: 'var(--warning)', fontSize: '13px' }}>The Round 1 deadline has passed — this link is locked.</p>
            ) : (
              <button onClick={submitRound1} disabled={savingRound1 || !presentationUrl.trim()} className="btn btn-primary" style={{ padding: '10px 22px' }}>
                {savingRound1 ? 'Saving…' : round1Submission ? 'Update Link' : 'Submit Link'}
              </button>
            )}
          </>
        ) : round1Submission?.presentation_url ? (
          <a href={round1Submission.presentation_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            View submitted link <ExternalLink size={14} />
          </a>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your team leader hasn&apos;t submitted a presentation link yet.</p>
        )}
      </div>

      {/* ── Your pitch (only once invited) ── */}
      {pitchSlot && pitchSession && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}><Video size={16} /> Your Pitch</h3>
          <p style={{ fontSize: '14px', marginBottom: '4px' }}>
            <strong>{pitchSession.title}</strong>
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            {formatDateTimeDMY_IST(pitchSlot.slot_time || pitchSession.starts_at)} IST {pitchSlot.slot_time ? '(your slot)' : '(session start)'}
          </p>
          <a href={pitchSession.meet_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex' }}>
            Join Google Meet <ExternalLink size={12} style={{ marginLeft: '6px' }} />
          </a>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>Please join 5 minutes early.</p>
        </div>
      )}

      {/* ── Round 1 results (only once published) ── */}
      {round1Published && round1Status && (
        <div className="glass-card" style={{ borderLeft: `4px solid ${shortlisted ? 'var(--success)' : 'var(--danger)'}` }}>
          <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Round 1 Result</h3>
          <p style={{ fontSize: '15px', fontWeight: 600, color: shortlisted ? 'var(--success)' : 'var(--danger)' }}>
            {shortlisted ? 'Shortlisted for Round 2 🎉' : 'Not shortlisted for Round 2'}
          </p>
          {round1Status.remarks && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>{round1Status.remarks}</p>}
        </div>
      )}

      {/* ── Round 2: demo submission — shortlisted only ── */}
      {round1Published && (
        <div className="glass-card">
          <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Round 2 — Demo Submission</h3>
          {!shortlisted ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Not shortlisted for Round 2.</p>
          ) : isLeader ? (
            <>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>GitHub repo URL *</label>
                <input className="premium-input" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/…" disabled={!!round2Locked} />
                {round2FieldErrors.githubUrl && <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{round2FieldErrors.githubUrl}</p>}
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Live demo URL *</label>
                <input className="premium-input" value={liveDemoUrl} onChange={(e) => setLiveDemoUrl(e.target.value)} placeholder="https://your-app.example.com" disabled={!!round2Locked} />
                {round2FieldErrors.liveDemoUrl && <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{round2FieldErrors.liveDemoUrl}</p>}
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Demo video URL (optional)</label>
                <input className="premium-input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" disabled={!!round2Locked} />
                {round2FieldErrors.videoUrl && <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{round2FieldErrors.videoUrl}</p>}
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>README / notes (optional)</label>
                <textarea className="premium-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!!round2Locked} />
              </div>
              {round2FormError && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{round2FormError}</p>}
              {round2Locked ? (
                <p style={{ color: 'var(--warning)', fontSize: '13px' }}>The Round 2 deadline has passed — submissions are locked.</p>
              ) : (
                <button onClick={submitRound2} disabled={savingRound2 || !githubUrl.trim() || !liveDemoUrl.trim()} className="btn btn-primary" style={{ padding: '10px 22px' }}>
                  {savingRound2 ? 'Saving…' : round2Submission ? 'Update Submission' : 'Submit'}
                </button>
              )}
            </>
          ) : round2Submission ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your team leader has submitted Round 2. Ask them to make changes if needed.</p>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Waiting for your team leader to submit Round 2.</p>
          )}
        </div>
      )}

      {/* ── Final results (only once published) ── */}
      {round2Published && round2Status && (round2Status.position || round2Status.special_mention) && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><Trophy size={16} /> Final Result</h3>
          {round2Status.position && <p style={{ fontSize: '15px', fontWeight: 600 }}>Placed #{round2Status.position}!</p>}
          {round2Status.special_mention && <p style={{ fontSize: '15px', fontWeight: 600 }}>Special Mention{round2Status.special_mention_label ? `: ${round2Status.special_mention_label}` : ''}</p>}
        </div>
      )}
    </div>
  )
}
