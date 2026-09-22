'use client'

import { useEffect, useState } from 'react'
import { Briefcase, Copy, Plus, RefreshCw } from 'lucide-react'
import { postJson } from '@/lib/apiFetch'
import { parseFormConfig, draftsToQuestions, newDraft, toDraft, type DraftQuestion, type FixedFieldConfig } from '@/lib/internshipForm'
import { parseAssessmentQuestions, draftsToAssessmentQuestions, newAssessmentDraft, toAssessmentDraft, type DraftAssessmentQuestion } from '@/lib/internshipAssessment'
import FixedFieldsPicker from '@/components/internship/FixedFieldsPicker'
import QuestionBuilder from '@/components/internship/QuestionBuilder'
import AssessmentBuilder from '@/components/internship/AssessmentBuilder'

const emptyForm = {
  title: '', topic: '', description: '', category: '', skillsRequiredText: '',
  eligibilityText: '', durationText: '', mode: 'online' as 'online' | 'offline' | 'hybrid',
  startDate: '', endDate: '', applicationDeadline: '', seatsTotal: '',
  isPaid: false, fee: '',
  assessmentEnabled: false, assessmentPassingScorePercent: '60', assessmentTimeLimitMinutes: '',
  bannerUrl: '',
  emailSubject: '', emailHeading: '', emailBody: '', emailCtaText: '', emailCtaLink: '', emailInstructions: '', emailSupportContact: '',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'rgba(107,114,128,0.15)', color: 'var(--text-secondary)' },
  published: { bg: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
  closed: { bg: 'rgba(239,68,68,0.15)', color: 'var(--danger)' },
  archived: { bg: 'rgba(148,163,184,0.2)', color: 'var(--text-muted)' },
}

const label = { display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' } as const

export default function AdminInternshipsPage() {
  const [internships, setInternships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [fixedFields, setFixedFields] = useState<FixedFieldConfig[]>([])
  const [questionDrafts, setQuestionDrafts] = useState<DraftQuestion[]>([])
  const [assessmentDrafts, setAssessmentDrafts] = useState<DraftAssessmentQuestion[]>([])

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const listRes = await fetch('/api/admin/internships', { cache: 'no-store' })
    const listJson = await listRes.json()
    setInternships(listJson?.success ? listJson.data.internships : [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFixedFields([])
    setQuestionDrafts([])
    setAssessmentDrafts([])
    setShowForm(true)
  }

  const openEdit = async (id: string) => {
    const res = await fetch(`/api/admin/internships/${id}`, { cache: 'no-store' })
    const json = await res.json()
    if (!json?.success) {
      alert('Error: ' + json?.message)
      return
    }
    const i = json.data.internship
    setEditingId(i.id)
    setForm({
      title: i.title || '',
      topic: i.topic || '',
      description: i.description || '',
      category: i.category || '',
      skillsRequiredText: (i.skills_required || []).join(', '),
      eligibilityText: i.eligibility_text || '',
      durationText: i.duration_text || '',
      mode: i.mode,
      startDate: i.start_date || '',
      endDate: i.end_date || '',
      applicationDeadline: i.application_deadline || '',
      seatsTotal: i.seats_total != null ? String(i.seats_total) : '',
      isPaid: i.is_paid,
      fee: i.fee != null ? String(i.fee) : '',
      assessmentEnabled: i.assessment_enabled,
      assessmentPassingScorePercent: String(i.assessment_passing_score_percent ?? 60),
      assessmentTimeLimitMinutes: i.assessment_time_limit_minutes != null ? String(i.assessment_time_limit_minutes) : '',
      bannerUrl: i.banner_url || '',
      emailSubject: i.email_subject || '',
      emailHeading: i.email_heading || '',
      emailBody: i.email_body || '',
      emailCtaText: i.email_cta_text || '',
      emailCtaLink: i.email_cta_link || '',
      emailInstructions: i.email_instructions || '',
      emailSupportContact: i.email_support_contact || '',
    })
    const fc = parseFormConfig(i.form_config)
    setFixedFields(fc.fixedFields)
    setQuestionDrafts(fc.questions.map(toDraft))
    setAssessmentDrafts(parseAssessmentQuestions(i.assessment_questions).map(toAssessmentDraft))
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const duplicate = async (id: string) => {
    await openEdit(id)
    setEditingId(null) // save will POST (create) instead of PUT
    setForm((f) => ({ ...f, title: f.title + ' (Copy)' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const questions = draftsToQuestions(questionDrafts)
    if (questions.ok === false) return alert(questions.message)
    const assessmentQuestions = draftsToAssessmentQuestions(assessmentDrafts)
    if (assessmentQuestions.ok === false) return alert(assessmentQuestions.message)

    setSaving(true)
    const payload = {
      title: form.title,
      topic: form.topic,
      description: form.description,
      category: form.category,
      skillsRequired: form.skillsRequiredText.split(',').map((s) => s.trim()).filter(Boolean),
      eligibilityText: form.eligibilityText,
      durationText: form.durationText,
      mode: form.mode,
      startDate: form.startDate,
      endDate: form.endDate,
      applicationDeadline: form.applicationDeadline,
      seatsTotal: form.seatsTotal ? Number(form.seatsTotal) : undefined,
      isPaid: form.isPaid,
      fee: form.isPaid ? Number(form.fee || 0) : 0,
      assessmentEnabled: form.assessmentEnabled,
      assessmentPassingScorePercent: Number(form.assessmentPassingScorePercent || 60),
      assessmentTimeLimitMinutes: form.assessmentTimeLimitMinutes ? Number(form.assessmentTimeLimitMinutes) : undefined,
      assessmentDrafts,
      fixedFields,
      questionDrafts,
      bannerUrl: form.bannerUrl,
      emailSubject: form.emailSubject,
      emailHeading: form.emailHeading,
      emailBody: form.emailBody,
      emailCtaText: form.emailCtaText,
      emailCtaLink: form.emailCtaLink,
      emailInstructions: form.emailInstructions,
      emailSupportContact: form.emailSupportContact,
    }

    const res = editingId
      ? await fetch(`/api/admin/internships/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.json())
      : await fetch('/api/admin/internships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.json())

    setSaving(false)
    if (!res.success) {
      alert('Error: ' + res.message)
      return
    }
    setShowForm(false)
    setEditingId(null)
    await load()
  }

  const quickStatus = async (i: any, status: string) => {
    const res = await fetch(`/api/admin/internships/${i.id}`, { cache: 'no-store' })
    const json = await res.json()
    if (!json?.success) return alert('Error: ' + json?.message)
    const full = json.data.internship
    const fc = parseFormConfig(full.form_config)
    const payload = {
      title: full.title, topic: full.topic, description: full.description, category: full.category,
      skillsRequired: full.skills_required, eligibilityText: full.eligibility_text, durationText: full.duration_text,
      mode: full.mode, startDate: full.start_date, endDate: full.end_date, applicationDeadline: full.application_deadline,
      seatsTotal: full.seats_total ?? undefined, isPaid: full.is_paid, fee: full.fee,
      assessmentEnabled: full.assessment_enabled, assessmentPassingScorePercent: full.assessment_passing_score_percent,
      assessmentTimeLimitMinutes: full.assessment_time_limit_minutes ?? undefined,
      assessmentDrafts: parseAssessmentQuestions(full.assessment_questions).map(toAssessmentDraft),
      fixedFields: fc.fixedFields, questionDrafts: fc.questions.map(toDraft),
      bannerUrl: full.banner_url, emailSubject: full.email_subject, emailHeading: full.email_heading, emailBody: full.email_body,
      emailCtaText: full.email_cta_text, emailCtaLink: full.email_cta_link, emailInstructions: full.email_instructions,
      emailSupportContact: full.email_support_contact, status,
    }
    const updateRes = await fetch(`/api/admin/internships/${i.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const updateJson = await updateRes.json()
    if (!updateJson.success) return alert('Error: ' + updateJson.message)
    await load()
  }

  const syncPayments = async () => {
    setSyncing(true)
    const res = await postJson<{ checked: number; results: Record<string, number>; errors: number }>('/api/admin/payments/reconcile', {})
    setSyncing(false)
    if (!res.success || !res.data) return alert('Sync failed: ' + res.message)
    const settled = res.data.results.settled ?? 0
    alert(`Checked ${res.data.checked} unpaid order(s) — ${settled} newly confirmed.`)
  }

  if (loading) return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading internships...</div>

  return (
    <div className="premium-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Briefcase size={28} /> Internships
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Create and manage internships. Published internships appear on <code>/internship</code>.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={syncPayments} disabled={syncing} className="btn btn-secondary">
            <RefreshCw size={16} /> {syncing ? 'Syncing…' : 'Sync payments'}
          </button>
          <button onClick={() => (showForm ? setShowForm(false) : openCreate())} className="btn btn-primary">
            {showForm ? 'Cancel' : (<><Plus size={18} /> Create Internship</>)}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card fade-in" style={{ marginBottom: '32px', borderLeft: '4px solid var(--primary)' }}>
          <h2 style={{ marginBottom: '20px', fontSize: '22px' }}>{editingId ? 'Edit Internship' : 'New Internship'}</h2>

          {/* ── Details ── */}
          <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>Details</h3>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Title *</label>
            <input className="premium-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. AI Product Development Internship" />
          </div>
          <div className="responsive-grid-2" style={{ marginBottom: '16px' }}>
            <div>
              <label style={label}>Topic</label>
              <input className="premium-input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </div>
            <div>
              <label style={label}>Category</label>
              <input className="premium-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Description</label>
            <textarea className="premium-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Skills Required (comma-separated)</label>
            <input className="premium-input" value={form.skillsRequiredText} onChange={(e) => setForm({ ...form, skillsRequiredText: e.target.value })} placeholder="Python, React, SQL" />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Eligibility Criteria (text shown to applicants)</label>
            <textarea className="premium-input" rows={2} value={form.eligibilityText} onChange={(e) => setForm({ ...form, eligibilityText: e.target.value })} placeholder="Students / Freshers" />
          </div>
          <div className="responsive-grid-3" style={{ marginBottom: '16px' }}>
            <div>
              <label style={label}>Duration</label>
              <input className="premium-input" value={form.durationText} onChange={(e) => setForm({ ...form, durationText: e.target.value })} placeholder="2 Months" />
            </div>
            <div>
              <label style={label}>Mode</label>
              <select className="premium-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as any })}>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label style={label}>Available Seats</label>
              <input type="number" min="1" className="premium-input" value={form.seatsTotal} onChange={(e) => setForm({ ...form, seatsTotal: e.target.value })} placeholder="Unlimited" />
            </div>
          </div>
          <div className="responsive-grid-3" style={{ marginBottom: '20px' }}>
            <div>
              <label style={label}>Start Date</label>
              <input type="date" className="premium-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={label}>End Date</label>
              <input type="date" className="premium-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div>
              <label style={label}>Application Deadline</label>
              <input type="date" className="premium-input" value={form.applicationDeadline} onChange={(e) => setForm({ ...form, applicationDeadline: e.target.value })} />
            </div>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={label}>Banner Image URL</label>
            <input className="premium-input" value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} placeholder="https://…" />
          </div>

          {/* ── Paid / Unpaid ── */}
          <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>Fee</h3>
          <div className="responsive-grid-2" style={{ marginBottom: '24px' }}>
            <div>
              <label style={label}>Type</label>
              <select className="premium-input" value={form.isPaid ? 'paid' : 'unpaid'} onChange={(e) => setForm({ ...form, isPaid: e.target.value === 'paid' })}>
                <option value="unpaid">Unpaid Internship</option>
                <option value="paid">Paid Internship</option>
              </select>
            </div>
            {form.isPaid && (
              <div>
                <label style={label}>Fee (₹)</label>
                <input type="number" min="0" step="1" className="premium-input" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} placeholder="4999" />
              </div>
            )}
          </div>

          {/* ── Eligibility Assessment ── */}
          <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>Eligibility Assessment</h3>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.assessmentEnabled} onChange={(e) => setForm({ ...form, assessmentEnabled: e.target.checked })} /> Enable eligibility assessment for this internship
          </label>
          {form.assessmentEnabled && (
            <>
              <div className="responsive-grid-2" style={{ marginBottom: '18px' }}>
                <div>
                  <label style={label}>Passing Score (%)</label>
                  <input type="number" min="0" max="100" className="premium-input" value={form.assessmentPassingScorePercent} onChange={(e) => setForm({ ...form, assessmentPassingScorePercent: e.target.value })} />
                </div>
                <div>
                  <label style={label}>Time Limit (minutes, optional)</label>
                  <input type="number" min="1" className="premium-input" value={form.assessmentTimeLimitMinutes} onChange={(e) => setForm({ ...form, assessmentTimeLimitMinutes: e.target.value })} placeholder="No limit" />
                </div>
              </div>
              <AssessmentBuilder value={assessmentDrafts} onChange={setAssessmentDrafts} />
            </>
          )}

          <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

          {/* ── Registration Form ── */}
          <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Registration Form</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Full name, email and mobile number are always asked. Choose any other standard fields, and add custom questions below.
          </p>
          <div style={{ marginBottom: '20px' }}>
            <FixedFieldsPicker value={fixedFields} onChange={setFixedFields} />
          </div>
          <QuestionBuilder value={questionDrafts} onChange={setQuestionDrafts} />

          <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

          {/* ── Email Content ── */}
          <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Confirmation Email</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Sent automatically once registration is confirmed. Use {'{{student_name}}'}, {'{{internship_name}}'}, {'{{registration_id}}'},{' '}
            {'{{payment_status}}'}, {'{{eligibility_status}}'}, {'{{assessment_status}}'}, {'{{assessment_score}}'}, {'{{start_date}}'}, {'{{duration}}'},{' '}
            {'{{next_steps}}'}. Basic formatting: **bold**, blank-line paragraphs, "- " bullet lists, [text](url) links.
          </p>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Email Subject</label>
            <input className="premium-input" value={form.emailSubject} onChange={(e) => setForm({ ...form, emailSubject: e.target.value })} placeholder="Internship Registration Confirmed – {{internship_name}}" />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Email Heading</label>
            <input className="premium-input" value={form.emailHeading} onChange={(e) => setForm({ ...form, emailHeading: e.target.value })} placeholder="You're registered, {{student_name}}!" />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Email Body</label>
            <textarea className="premium-input" rows={5} value={form.emailBody} onChange={(e) => setForm({ ...form, emailBody: e.target.value })} placeholder={"Your registration for **{{internship_name}}** is confirmed.\n\nRegistration ID: {{registration_id}}"} />
          </div>
          <div className="responsive-grid-2" style={{ marginBottom: '16px' }}>
            <div>
              <label style={label}>CTA Button Text</label>
              <input className="premium-input" value={form.emailCtaText} onChange={(e) => setForm({ ...form, emailCtaText: e.target.value })} placeholder="View Internship" />
            </div>
            <div>
              <label style={label}>CTA Button Link</label>
              <input className="premium-input" value={form.emailCtaLink} onChange={(e) => setForm({ ...form, emailCtaLink: e.target.value })} placeholder="https://hackathon.adz4needz.com/internship/…" />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Instructions</label>
            <textarea className="premium-input" rows={3} value={form.emailInstructions} onChange={(e) => setForm({ ...form, emailInstructions: e.target.value })} />
          </div>
          <div style={{ marginBottom: '28px' }}>
            <label style={label}>Support Contact</label>
            <input className="premium-input" value={form.emailSupportContact} onChange={(e) => setForm({ ...form, emailSupportContact: e.target.value })} placeholder="support@adz4needz.com" />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Internship'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Discard</button>
          </div>
        </form>
      )}

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Internship</th>
              <th>Type</th>
              <th>Assessment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {internships.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No internships yet.</td></tr>
            ) : (
              internships.map((i) => {
                const s = STATUS_STYLE[i.status] || STATUS_STYLE.draft
                return (
                  <tr key={i.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{i.title}</div>
                      {i.topic && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{i.topic}</div>}
                    </td>
                    <td>{i.is_paid ? `₹${i.fee}` : 'Unpaid'}</td>
                    <td>{i.assessment_enabled ? `${i.assessment_passing_score_percent}% to pass` : '—'}</td>
                    <td><span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color }}>{String(i.status).toUpperCase()}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {i.status !== 'published' && <button onClick={() => quickStatus(i, 'published')} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--success)' }}>Publish</button>}
                        {i.status === 'published' && <button onClick={() => quickStatus(i, 'closed')} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--danger)' }}>Close</button>}
                        {i.status !== 'archived' && <button onClick={() => quickStatus(i, 'archived')} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>Archive</button>}
                        <button onClick={() => openEdit(i.id)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>Edit</button>
                        <button onClick={() => duplicate(i.id)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', gap: '4px' }}><Copy size={12} /> Duplicate</button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
