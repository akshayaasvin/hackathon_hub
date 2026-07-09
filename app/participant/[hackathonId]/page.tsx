'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { ArrowLeft, Calendar, Users, Trophy, ShieldCheck } from 'lucide-react'
import { HackathonStepper } from '@/components/participant/HackathonStepper'
import { RegistrationStatusChip, type RegistrationStatusValue } from '@/components/participant/RegistrationStatusChip'
import { openRazorpayCheckout, type RazorpayOrder } from '@/components/RazorpayCheckout'
import { SubmissionModal, type SubmissionFormValues } from '@/components/participant/SubmissionModal'

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
  const [submission, setSubmission] = useState<any>(null)

  const [actionLoading, setActionLoading] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [showManageModal, setShowManageModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [showSubmissionModal, setShowSubmissionModal] = useState(false)
  const [showPayPanel, setShowPayPanel] = useState(false)
  const [paymentReference, setPaymentReference] = useState('')
  const [verifying, setVerifying] = useState(false)

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

        const { data: submissionData } = await supabase.from('submissions').select('*').eq('team_id', registrationData.team_id).maybeSingle()
        setSubmission(submissionData)
      } else {
        setTeam(null)
        setTeamMembers([])
        setSubmission(null)
      }
    } catch (err) {
      console.error('Error loading hackathon detail:', err)
    } finally {
      setLoading(false)
    }
  }

  const status: RegistrationStatusValue = registration?.status || 'not_registered'

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

  const pollForPaymentOutcome = async (registrationId: string) => {
    setVerifying(true)
    const timeoutMs = 30000
    const intervalMs = 2500
    const start = Date.now()
    let resolvedStatus: string | null = null
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const { data } = await supabase.from('registrations').select('status').eq('id', registrationId).single()
      if (data && data.status !== 'payment_pending') {
        resolvedStatus = data.status
        break
      }
    }
    setVerifying(false)
    // Webhook resolved the payment one way or the other — drop the stale
    // pay panel so it doesn't linger alongside the new stage's UI (e.g. the
    // "Create Team" button once approved). Still showing 'payment_pending'
    // (timeout) keeps the panel up so the participant can retry.
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
        onSuccess: () => {
          pollForPaymentOutcome(registrationId)
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

  const handleConfirmPayment = async () => {
    if (!paymentReference.trim()) {
      alert('Please paste your payment/transaction reference.')
      return
    }
    setActionLoading(true)
    const result = await postJson(`/api/registrations/${registration.id}/confirm-payment`, { paymentReference })
    if (!result.success) {
      alert('Error: ' + result.message)
    } else {
      alert('Payment submitted for admin review.')
      setShowPayPanel(false)
      setPaymentReference('')
      await loadData()
    }
    setActionLoading(false)
  }

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

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email')
      return
    }
    const { data: invitedUser } = await supabase.from('users').select('id, email').eq('email', inviteEmail).single()
    if (!invitedUser) {
      alert('User not found. Ensure they registered on the portal.')
      return
    }
    if (teamMembers.some((m) => m.id === invitedUser.id)) {
      alert('User is already a member of this team.')
      return
    }
    await supabase.from('team_members').insert({ team_id: team.id, user_id: invitedUser.id })
    alert('Member added to team!')
    setInviteEmail('')
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

        <HackathonStepper status={status} />

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
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                Verifying your payment… this usually takes a few seconds.
              </p>
            ) : (
              <button
                onClick={handlePayNow}
                disabled={actionLoading}
                className="btn btn-primary"
                style={{ padding: '12px 28px', marginBottom: '16px' }}
              >
                {actionLoading
                  ? 'Opening...'
                  : `Pay${hackathon.registration_fee ? ` ₹${hackathon.registration_fee}` : ''} with Razorpay`}
              </button>
            )}
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Already paid but not reflected yet? Paste your payment reference here to notify the admin:
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                className="premium-input"
                style={{ flex: 1, minWidth: '220px' }}
                placeholder="Razorpay payment ID / transaction ref"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
              <button onClick={handleConfirmPayment} disabled={actionLoading} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                {actionLoading ? 'Submitting...' : 'Mark Payment Complete'}
              </button>
            </div>
          </div>
        )}

        {status === 'payment_submitted' && (
          <button disabled className="btn btn-secondary" style={{ padding: '12px 28px' }} title="An admin is reviewing your payment reference.">
            Payment Under Review
          </button>
        )}

        {status === 'approved' && (
          <button onClick={() => setShowTeamModal(true)} disabled={actionLoading} className="btn btn-success" style={{ padding: '12px 28px' }}>
            Create Team
          </button>
        )}

        {status === 'team_created' && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowSubmissionModal(true)} className="btn btn-primary" style={{ padding: '12px 28px' }}>
              Submit Project
            </button>
            <button onClick={() => setShowManageModal(true)} className="btn btn-secondary" style={{ padding: '12px 20px' }}>
              Manage Team
            </button>
          </div>
        )}

        {status === 'submitted' && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowSubmissionModal(true)} className="btn btn-secondary" style={{ padding: '12px 28px' }}>
              <ShieldCheck size={16} /> View Submission
            </button>
            <button onClick={() => setShowManageModal(true)} className="btn btn-secondary" style={{ padding: '12px 20px' }}>
              Manage Team
            </button>
          </div>
        )}
      </div>

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
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTeamModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
              <button onClick={handleCreateTeam} disabled={actionLoading} className="btn btn-primary" style={{ padding: '8px 20px' }}>
                {actionLoading ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Team Modal */}
      {showManageModal && team && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Manage Team: {team.team_name}</h2>
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
                <button onClick={handleInviteMember} className="btn btn-primary" style={{ padding: '0 20px' }}>Invite</button>
              </div>
            </div>
            <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>Active Members ({teamMembers.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', marginBottom: '24px' }}>
              {teamMembers.map((m) => (
                <div key={m.id} style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.full_name || 'No Name'}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{m.email}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowManageModal(false)} className="btn btn-secondary" style={{ padding: '10px 24px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

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
