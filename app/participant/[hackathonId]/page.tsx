'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { ArrowLeft, Calendar, Users, Trophy, ShieldCheck } from 'lucide-react'
import { HackathonStepper, type RoundProgress } from '@/components/participant/HackathonStepper'
import { RegistrationStatusChip, type RegistrationStatusValue } from '@/components/participant/RegistrationStatusChip'
import { openRazorpayCheckout, verifyPaymentOnServer, type RazorpayCheckoutResult } from '@/components/RazorpayCheckout'
import { SubmissionModal, type SubmissionFormValues } from '@/components/participant/SubmissionModal'
import RoundsPanel from '@/components/participant/RoundsPanel'
import HackathonInstructions from '@/components/participant/HackathonInstructions'

export default function HackathonDetailPage() {
  const params = useParams()
  const router = useRouter()
  const hackathonId = params.hackathonId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [hackathon, setHackathon] = useState<any>(null)
  const [registration, setRegistration] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [submission, setSubmission] = useState<any>(null)
  const [roundProgress, setRoundProgress] = useState<RoundProgress | undefined>(undefined)

  const [actionLoading, setActionLoading] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [nameAvailability, setNameAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const nameCheckSeq = useRef(0)
  const [showManageModal, setShowManageModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [showSubmissionModal, setShowSubmissionModal] = useState(false)
  const [showPayPanel, setShowPayPanel] = useState(false)
  const [verifying, setVerifying] = useState(false)
  // Real inline confirmations (Phase 3) — window.confirm is overridden app-wide to always
  // auto-return true (see app/layout.tsx), so it can't be used to actually gate a destructive
  // action like disbanding a team.
  const [confirmDisband, setConfirmDisband] = useState(false)
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null)
  const [transferToUserId, setTransferToUserId] = useState('')

  // P1: Team step three-choice flow (Leader / Solo / Member-waiting) — 'waiting' is the only
  // one that needs its own local flag; Leader opens the existing Create Team modal, Solo calls
  // its own route immediately.
  const [teamChoice, setTeamChoice] = useState<'ask' | 'waiting'>('ask')
  const [myInvitesHere, setMyInvitesHere] = useState<any[]>([])
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null)
  const [switchPrompt, setSwitchPrompt] = useState<{
    inviteId: string
    newTeamName: string
    currentTeamName: string
    isSoloLeader: boolean
  } | null>(null)

  useEffect(() => {
    loadData()
  }, [hackathonId])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: hackathonData } = await supabase.from('hackathons').select('*').eq('id', hackathonId).single()
      if (!hackathonData) {
        setHackathon(null)
        setLoading(false)
        return
      }
      setHackathon(hackathonData)

      const { data: registrationData } = await supabase
        .from('registrations')
        .select('*')
        .eq('hackathon_id', hackathonId)
        .eq('user_id', user.id)
        .maybeSingle()
      setRegistration(registrationData)

      // Invites addressed to ME for THIS hackathon (Team step state A) — only relevant before
      // I have a team, but harmless to fetch regardless.
      let myInvitesRes: any = null
      try {
        const r = await fetch(`/api/team-invites/mine?hackathonId=${encodeURIComponent(hackathonId)}`)
        myInvitesRes = await r.json()
      } catch {
        myInvitesRes = null
      }
      setMyInvitesHere(myInvitesRes?.success ? myInvitesRes.data.invites : [])

      if (registrationData?.team_id) {
        const { data: teamData } = await supabase.from('teams').select('*').eq('id', registrationData.team_id).single()
        setTeam(teamData)

        const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', registrationData.team_id)
        if (members && members.length > 0) {
          const { data: usersData } = await supabase.from('users').select('id, email, full_name').in('id', members.map((m: any) => m.user_id))
          setTeamMembers(usersData || [])
        } else {
          setTeamMembers([])
        }

        // Pending invites for this team, WITH the invitee's name/email already resolved
        // server-side (P0 fix — see app/api/teams/[teamId]/invites/route.ts for why the old
        // two-query client-side version always rendered "Unknown"). 403s harmlessly for a
        // non-leader member, since only the leader's Manage Team view renders this list.
        let invitesRes: any = null
        try {
          const r = await fetch(`/api/teams/${registrationData.team_id}/invites`)
          invitesRes = await r.json()
        } catch {
          invitesRes = null
        }
        setPendingInvites(invitesRes?.success ? invitesRes.data.invites.map((i: any) => ({ ...i, user: i.invitee })) : [])

        // round: 1 explicitly — a team can now have up to two submissions rows (one per
        // round, migration 0031), so an unfiltered .maybeSingle() here would error once a
        // team has both. This `submission` state feeds the pre-Phase-4 generic
        // SubmissionModal/handleSubmitProject flow specifically, which always writes round 1.
        const { data: submissionData } = await supabase.from('submissions').select('*').eq('team_id', registrationData.team_id).eq('round', 1).maybeSingle()
        setSubmission(submissionData)

        // Round progress for the stepper only (RoundsPanel below does its own, fuller fetch
        // for the actual forms/cards) — round1Submitted here means "presentation_url set",
        // not just "a round-1 submissions row exists" (the pre-Phase-4 generic flow above also
        // writes a round=1 row with no presentation_url at all).
        const { data: r1 } = await supabase.from('submissions').select('presentation_url').eq('team_id', registrationData.team_id).eq('round', 1).maybeSingle()
        const { data: r2 } = await supabase.from('submissions').select('id').eq('team_id', registrationData.team_id).eq('round', 2).maybeSingle()
        const { data: rs1 } = await supabase.from('team_round_status').select('shortlisted').eq('team_id', registrationData.team_id).eq('round', 1).maybeSingle()
        setRoundProgress({
          round1Submitted: !!r1?.presentation_url,
          shortlisted: rs1 ? rs1.shortlisted : null,
          round2Submitted: !!r2,
          finalPublished: !!hackathonData.results_published_final,
        })
      } else {
        setTeam(null)
        setTeamMembers([])
        setPendingInvites([])
        setSubmission(null)
        setRoundProgress(undefined)
      }
    } catch (err) {
      console.error('Error loading hackathon detail:', err)
    } finally {
      setLoading(false)
    }
  }

  const status: RegistrationStatusValue = registration?.status || 'not_registered'
  // A hackathon "uses rounds" once the admin has set a Round 1 deadline (the admin edit form
  // field that turns the rounds flow on) — used only to decide whether the legacy generic
  // "Submit Project" button should still show alongside RoundsPanel, or hide in favor of it.
  const usesRounds = !!hackathon?.round1_deadline

  const handleRegister = async () => {
    setActionLoading(true)
    const { error } = await supabase.from('registrations').insert({
      hackathon_id: hackathonId,
      user_id: user?.id,
      registration_status: 'confirmed',
    })
    if (error) {
      alert('Registration failed: ' + error.message)
    } else {
      await loadData()
    }
    setActionLoading(false)
  }

  // A payment that is stuck in payment_pending (paid, then the tab was closed, and the
  // webhook was late) heals itself: the server asks Razorpay what happened to the order.
  useEffect(() => {
    if (!registration?.id || registration.status !== 'payment_pending') return
    let cancelled = false
    postJson<{ status: string }>(`/api/registrations/${registration.id}/sync-payment`, {}).then((res) => {
      if (!cancelled && res.success && res.data?.status && res.data.status !== 'payment_pending') loadData()
    })
    return () => {
      cancelled = true
    }
  }, [registration?.id, registration?.status])

  const pollForPaymentOutcome = async (registrationId: string, result?: RazorpayCheckoutResult) => {
    setVerifying(true)
    // 1) The server verifies the payment with Razorpay (signature + API fetch) and
    //    settles the registration itself — no reliance on the webhook alone.
    if (result) await verifyPaymentOnServer(result)
    // 2) Poll the server (which also re-checks Razorpay) until the status leaves
    //    payment_pending; covers 'authorized' -> 'captured' delays and webhook races.
    const timeoutMs = 60000
    const intervalMs = 2500
    const start = Date.now()
    let resolvedStatus: string | null = null
    while (Date.now() - start < timeoutMs) {
      const res = await postJson<{ status: string }>(`/api/registrations/${registrationId}/sync-payment`, {})
      if (res.success && res.data?.status && res.data.status !== 'payment_pending') {
        resolvedStatus = res.data.status
        break
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    setVerifying(false)
    // Payment resolved — drop the stale pay panel so it doesn't linger alongside
    // the new stage's UI (e.g. the "Create Team" button once approved). Still
    // 'payment_pending' (timeout) keeps the panel up; reopening this page re-checks.
    if (resolvedStatus && resolvedStatus !== 'payment_pending') {
      setShowPayPanel(false)
    }
    await loadData()
  }

  const handlePayNow = async () => {
    setActionLoading(true)
    try {
      const result = await postJson<{ order_id: string; amount: number; currency: string; key_id: string }>(
        `/api/registrations/${registration.id}/create-order`,
        {}
      )
      if (!result.success || !result.data) {
        alert('Error: ' + result.message)
        return
      }
      setShowPayPanel(true)
      const registrationId = registration.id
      await loadData()
      await openRazorpayCheckout(result.data, {
        email: user?.email,
        onSuccess: (checkoutResult) => {
          pollForPaymentOutcome(registrationId, checkoutResult)
        },
        onDismiss: () => {},
        onFailure: () => {
          alert('Payment failed. You can retry below.')
        },
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Debounced live availability check (Phase 2, section 2) — a convenience only; the create
  // call itself re-checks server-side regardless (see /api/teams and migration 0029's unique
  // index), so a stale "available" here can never actually let a duplicate through.
  useEffect(() => {
    if (!showTeamModal || !teamName.trim()) {
      setNameAvailability('idle')
      return
    }
    const mySeq = ++nameCheckSeq.current
    setNameAvailability('checking')
    const t = setTimeout(async () => {
      let res: any = null
      try {
        const r = await fetch(`/api/teams/check-name?hackathonId=${encodeURIComponent(hackathonId)}&name=${encodeURIComponent(teamName.trim())}`)
        res = await r.json()
      } catch {
        res = null
      }
      if (mySeq !== nameCheckSeq.current) return // a newer keystroke's check has superseded this one
      if (res?.success && res.data) setNameAvailability(res.data.available ? 'available' : 'taken')
      else setNameAvailability('idle')
    }, 400)
    return () => clearTimeout(t)
  }, [teamName, showTeamModal, hackathonId])

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      alert('Please enter a team name')
      return
    }
    setActionLoading(true)
    const result = await postJson('/api/teams', { hackathonId, teamName })
    if (!result.success) {
      alert('Error: ' + result.message)
    } else {
      alert('Team created successfully!')
      setShowTeamModal(false)
      setTeamName('')
      await loadData()
    }
    setActionLoading(false)
  }

  const handleParticipateSolo = async () => {
    setActionLoading(true)
    const result = await postJson('/api/teams/solo', { hackathonId })
    setActionLoading(false)
    if (!result.success) {
      alert(result.message)
      return
    }
    alert(result.message)
    await loadData()
  }

  const respondToInviteHere = async (inviteId: string, action: 'accept' | 'decline', forceLeaveCurrent = false) => {
    setRespondingInviteId(inviteId)
    const res: any = await postJson(`/api/team-invites/${inviteId}/${action}`, forceLeaveCurrent ? { forceLeaveCurrent: true } : {})
    setRespondingInviteId(null)
    if (!res.success) {
      if (res.code === 'ALREADY_ON_TEAM') {
        const invite = myInvitesHere.find((i) => i.id === inviteId)
        setSwitchPrompt({
          inviteId,
          newTeamName: invite?.team?.team_name || 'this team',
          currentTeamName: res.currentTeamName,
          isSoloLeader: !!res.isSoloLeader,
        })
        return
      }
      alert(res.message)
      return
    }
    alert(res.message)
    setSwitchPrompt(null)
    await loadData()
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email')
      return
    }
    setActionLoading(true)
    // Server-side: the browser's own session can never resolve someone else's email to a
    // user row (RLS correctly blocks that), so every eligibility check — account exists,
    // approved for this hackathon, not already on a team, team not full — runs there too.
    // See app/api/teams/[teamId]/invite/route.ts and migration 0028 for why.
    const result = await postJson(`/api/teams/${team.id}/invite`, { email: inviteEmail.trim() })
    setActionLoading(false)
    if (!result.success) {
      alert(result.message)
      return
    }
    alert(result.message)
    setInviteEmail('')
    await loadData()
  }

  const handleRevokeInvite = async (inviteId: string) => {
    setActionLoading(true)
    const result = await postJson(`/api/teams/${team.id}/invites/${inviteId}/revoke`, {})
    setActionLoading(false)
    if (!result.success) return alert(result.message)
    alert(result.message)
    await loadData()
  }

  const handleRemoveMember = async (userId: string) => {
    setActionLoading(true)
    const result: any = await postJson(`/api/teams/${team.id}/members/${userId}`, {})
    setActionLoading(false)
    setConfirmRemoveUserId(null)
    if (!result.success) return alert(result.message)
    alert(result.message)
    await loadData()
  }

  const handleTransferLeadership = async () => {
    if (!transferToUserId) return
    setActionLoading(true)
    const result = await postJson(`/api/teams/${team.id}/transfer-leadership`, { newLeaderId: transferToUserId })
    setActionLoading(false)
    if (!result.success) return alert(result.message)
    alert(result.message)
    setTransferToUserId('')
    await loadData()
  }

  const handleDisbandTeam = async () => {
    setActionLoading(true)
    const result = await postJson(`/api/teams/${team.id}/disband`, {})
    setActionLoading(false)
    setConfirmDisband(false)
    if (!result.success) return alert(result.message)
    alert(result.message)
    setShowManageModal(false)
    await loadData()
  }

  const handleLeaveTeam = async () => {
    setActionLoading(true)
    const result = await postJson(`/api/teams/${team.id}/leave`, {})
    setActionLoading(false)
    if (!result.success) return alert(result.message)
    alert(result.message)
    setShowManageModal(false)
    await loadData()
  }

  const handleSubmitProject = async (values: SubmissionFormValues) => {
    setActionLoading(true)
    const result = await postJson('/api/submissions', { hackathonId, ...values })
    if (!result.success) {
      alert('Error: ' + result.message)
    } else {
      alert('Project submitted successfully!')
      setShowSubmissionModal(false)
      await loadData()
    }
    setActionLoading(false)
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading hackathon...</div>
  }

  if (!hackathon) {
    return (
      <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <h2 style={{ marginBottom: '12px' }}>Hackathon not found</h2>
          <button onClick={() => router.push('/participant')} className="btn btn-primary" style={{ padding: '10px 24px' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="premium-container fade-in">
      <button
        onClick={() => router.push('/participant')}
        className="btn btn-secondary"
        style={{ padding: '8px 16px', marginBottom: '24px', fontSize: '13px' }}
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      {hackathon.banner_url && (
        <img
          src={hackathon.banner_url}
          alt={hackathon.name}
          style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', borderRadius: '16px', marginBottom: '24px' }}
        />
      )}

      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '28px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>{hackathon.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{hackathon.theme || 'Open Innovation'}</p>
          </div>
          <RegistrationStatusChip status={status} />
        </div>

        <HackathonStepper status={status} round={roundProgress} />

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '14px', color: 'var(--text-secondary)', margin: '24px 0', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} /> Deadline: {new Date(hackathon.registration_deadline).toLocaleDateString()}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} /> Max team size: {hackathon.max_team_size}
          </span>
          {hackathon.prize_details && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trophy size={14} /> {hackathon.prize_details}
            </span>
          )}
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-line', marginBottom: '16px' }}>
          {hackathon.description || 'No description provided.'}
        </p>
        {hackathon.rules && (
          <>
            <h4 style={{ fontSize: '15px', marginBottom: '6px' }}>Rules</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px', whiteSpace: 'pre-line' }}>{hackathon.rules}</p>
          </>
        )}
        {hackathon.eligibility && (
          <>
            <h4 style={{ fontSize: '15px', marginBottom: '6px' }}>Eligibility</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', whiteSpace: 'pre-line' }}>{hackathon.eligibility}</p>
          </>
        )}
      </div>

      <HackathonInstructions hackathon={hackathon} status={status} round={roundProgress} />

      {/* Primary action area */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Next Step</h3>

        {status === 'not_registered' && (
          <button onClick={handleRegister} disabled={actionLoading} className="btn btn-primary" style={{ padding: '12px 28px' }}>
            {actionLoading ? 'Registering...' : 'Register for Hackathon'}
          </button>
        )}

        {status === 'registered' && !showPayPanel && (
          <button onClick={handlePayNow} disabled={actionLoading || !hackathon.registration_fee} className="btn btn-primary" style={{ padding: '12px 28px' }}>
            {actionLoading ? 'Starting...' : hackathon.registration_fee ? `Pay Now (₹${hackathon.registration_fee})` : 'Registration fee not set'}
          </button>
        )}

        {(status === 'rejected') && !showPayPanel && (
          <button onClick={handlePayNow} disabled={actionLoading} className="btn btn-danger" style={{ padding: '12px 28px' }}>
            {actionLoading ? 'Starting...' : 'Payment Rejected — Retry'}
          </button>
        )}

        {(status === 'payment_pending' || showPayPanel) && (
          <div>
            {verifying ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Verifying your payment with Razorpay… this usually takes a few seconds. Once it is confirmed the
                next step unlocks automatically — no admin action needed. You can safely close this page; if you
                have paid, reopening it will confirm the payment.
              </p>
            ) : (
              <button
                onClick={handlePayNow}
                disabled={actionLoading}
                className="btn btn-primary"
                style={{ padding: '12px 28px' }}
              >
                {actionLoading
                  ? 'Opening...'
                  : `Pay${hackathon.registration_fee ? ` ₹${hackathon.registration_fee}` : ''} with Razorpay`}
              </button>
            )}
          </div>
        )}

        {status === 'payment_submitted' && (
          <button disabled className="btn btn-secondary" style={{ padding: '12px 28px' }} title="An admin is reviewing your payment reference.">
            Payment Under Review
          </button>
        )}

        {status === 'approved' && (
          myInvitesHere.length > 0 ? (
            // State A: has a pending invite (or several) for THIS hackathon.
            <div style={{ display: 'grid', gap: '12px' }}>
              {myInvitesHere.map((inv) => (
                <div key={inv.id} style={{ padding: '16px 18px', border: '1px solid var(--border-hover)', borderRadius: '10px', background: 'rgba(108,71,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '14px' }}>
                    <strong>{inv.inviter?.full_name || inv.inviter?.email || 'Someone'}</strong> invited you to join team{' '}
                    <strong>{inv.team?.team_name || 'their team'}</strong> for {hackathon.name}.
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => respondToInviteHere(inv.id, 'decline')} disabled={respondingInviteId === inv.id} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                      Decline
                    </button>
                    <button onClick={() => respondToInviteHere(inv.id, 'accept')} disabled={respondingInviteId === inv.id} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                      {respondingInviteId === inv.id ? 'Working…' : 'Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : teamChoice === 'waiting' ? (
            // State B, option 3: "I'm a Team Member" — nothing to create, just wait.
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
                Your team leader will invite you using your registered email <strong>{user?.email}</strong>. Invites will
                appear here and on your Dashboard.
              </p>
              <button onClick={() => setTeamChoice('ask')} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                Back
              </button>
            </div>
          ) : (
            // State B: no team, no invite yet — three choices.
            <div>
              <div className="responsive-grid-3" style={{ gap: '16px', marginBottom: '16px' }}>
                <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '15px' }}>I&apos;m the Team Leader</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>Create a team and invite members by their registered email.</p>
                  <button onClick={() => setShowTeamModal(true)} disabled={actionLoading} className="btn btn-success" style={{ padding: '10px 20px' }}>
                    Create Team
                  </button>
                </div>
                <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '15px' }}>Participate Solo</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>No team name needed — you compete under your own name.</p>
                  <button onClick={handleParticipateSolo} disabled={actionLoading} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
                    {actionLoading ? 'Starting…' : 'Participate Solo'}
                  </button>
                </div>
                <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '15px' }}>I&apos;m a Team Member</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>Waiting for your team leader to invite you.</p>
                  <button onClick={() => setTeamChoice('waiting')} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
                    Waiting for Invite
                  </button>
                </div>
              </div>
              {registration?.payment_reference && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Payment reference: <span style={{ fontFamily: 'monospace' }}>{registration.payment_reference}</span>
                </p>
              )}
            </div>
          )
        )}

        {status === 'team_created' && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Legacy generic submission — hidden once this hackathon uses the Round 1/Round 2
                flow (Round 1 deadline set), since the RoundsPanel below already replaces it and
                showing both would give participants two different "submit" buttons. */}
            {!usesRounds && (
              <button onClick={() => setShowSubmissionModal(true)} className="btn btn-primary" style={{ padding: '12px 28px' }}>
                Submit Project
              </button>
            )}
            <button onClick={() => setShowManageModal(true)} className="btn btn-secondary" style={{ padding: '12px 20px' }}>
              Manage Team
            </button>
          </div>
        )}

        {status === 'submitted' && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {!usesRounds && (
              <button onClick={() => setShowSubmissionModal(true)} className="btn btn-secondary" style={{ padding: '12px 28px' }}>
                <ShieldCheck size={16} /> View Submission
              </button>
            )}
            <button onClick={() => setShowManageModal(true)} className="btn btn-secondary" style={{ padding: '12px 20px' }}>
              Manage Team
            </button>
          </div>
        )}
      </div>

      {team && (status === 'team_created' || status === 'submitted') && (
        <RoundsPanel hackathonId={hackathonId} hackathon={hackathon} team={team} isLeader={team.team_lead_id === user?.id} />
      )}

      {switchPrompt && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>Switch teams?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
              You&apos;re already in <strong>{switchPrompt.currentTeamName}</strong> for this hackathon.
              {switchPrompt.isSoloLeader
                ? ` Since you're the only member, accepting will disband "${switchPrompt.currentTeamName}" and add you to "${switchPrompt.newTeamName}".`
                : ` Leave "${switchPrompt.currentTeamName}" and join "${switchPrompt.newTeamName}" instead?`}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setSwitchPrompt(null)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
              <button
                onClick={() => respondToInviteHere(switchPrompt.inviteId, 'accept', true)}
                disabled={respondingInviteId === switchPrompt.inviteId}
                className="btn btn-primary"
                style={{ padding: '8px 20px' }}
              >
                {respondingInviteId === switchPrompt.inviteId ? 'Switching…' : 'Leave & Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showTeamModal && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Create Hackathon Team</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Establish a new team for {hackathon.name}.</p>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Team Name</label>
              <input
                type="text"
                placeholder="e.g. Code Ninjas"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="premium-input"
              />
              {nameAvailability === 'checking' && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Checking availability…</p>
              )}
              {nameAvailability === 'taken' && (
                <p style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '6px' }}>Team name already taken in this hackathon.</p>
              )}
              {nameAvailability === 'available' && (
                <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '6px' }}>Available.</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowTeamModal(false); setTeamName(''); setNameAvailability('idle') }} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
              <button onClick={handleCreateTeam} disabled={actionLoading || nameAvailability === 'taken'} className="btn btn-primary" style={{ padding: '8px 20px' }}>
                {actionLoading ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Team Modal (Phase 3): leader gets invite/remove/revoke/transfer/disband;
          a regular member gets Leave. */}
      {showManageModal && team && (() => {
        const isLeader = team.team_lead_id === user?.id
        const otherMembers = teamMembers.filter((m) => m.id !== team.team_lead_id)
        return (
          <div className="modal-overlay">
            <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '32px', maxHeight: '85vh', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Manage Team: {team.team_name}</h2>

              {isLeader && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Nominate Member via Email</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="email"
                      placeholder="student@college.edu"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="premium-input"
                    />
                    <button onClick={handleInviteMember} disabled={actionLoading} className="btn btn-primary" style={{ padding: '0 20px' }}>Invite</button>
                  </div>
                </div>
              )}

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>Active Members ({teamMembers.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {teamMembers.map((m) => {
                  const memberIsLeader = m.id === team.team_lead_id
                  return (
                    <div
                      key={m.id}
                      style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}
                    >
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {m.full_name || 'No Name'}
                          {memberIsLeader && <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700 }}> · LEADER</span>}
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{m.email}</p>
                      </div>
                      {isLeader && !memberIsLeader && (
                        confirmRemoveUserId === m.id ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleRemoveMember(m.id)} disabled={actionLoading} className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '11px' }}>Confirm</button>
                            <button onClick={() => setConfirmRemoveUserId(null)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '11px' }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmRemoveUserId(m.id)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--danger)' }}>Remove</button>
                        )
                      )}
                    </div>
                  )
                })}
              </div>

              {isLeader && pendingInvites.length > 0 && (
                <>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>Pending Invites ({pendingInvites.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {pendingInvites.map((inv) => (
                      <div
                        key={inv.id}
                        style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid var(--warning-border)', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}
                      >
                        <div>
                          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.user?.full_name || inv.user?.email || 'Unknown'}</p>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Pending since {new Date(inv.created_at).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => handleRevokeInvite(inv.id)} disabled={actionLoading} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--danger)' }}>Revoke</button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isLeader && otherMembers.length > 0 && (
                <div style={{ marginBottom: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Transfer Leadership</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select value={transferToUserId} onChange={(e) => setTransferToUserId(e.target.value)} className="premium-input">
                      <option value="">Select a member…</option>
                      {otherMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                    </select>
                    <button onClick={handleTransferLeadership} disabled={!transferToUserId || actionLoading} className="btn btn-secondary" style={{ padding: '0 16px' }}>Transfer</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div>
                  {isLeader ? (
                    confirmDisband ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>Disband permanently?</span>
                        <button onClick={handleDisbandTeam} disabled={actionLoading} className="btn btn-danger" style={{ padding: '8px 14px', fontSize: '12px' }}>Yes, disband</button>
                        <button onClick={() => setConfirmDisband(false)} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDisband(true)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--danger)' }}>Disband Team</button>
                    )
                  ) : (
                    <button onClick={handleLeaveTeam} disabled={actionLoading} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--danger)' }}>Leave Team</button>
                  )}
                </div>
                <button
                  onClick={() => { setShowManageModal(false); setConfirmDisband(false); setConfirmRemoveUserId(null) }}
                  className="btn btn-secondary"
                  style={{ padding: '10px 24px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showSubmissionModal && (
        <SubmissionModal
          readOnly={status === 'submitted'}
          submitting={actionLoading}
          initialValues={submission || undefined}
          onSubmit={handleSubmitProject}
          onClose={() => setShowSubmissionModal(false)}
        />
      )}
    </div>
  )
}
